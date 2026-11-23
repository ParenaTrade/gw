"""KUponum OCR köprüsü: PaddleOCR + (opsiyonel) OpenCV perspektif düzeltme.

Sözleşme (src/lib/ocr/adapters/paddle-bridge.ts):
  POST /ocr  {"image": "<base64>", "mime": "image/jpeg"}
  →          {"text": "...", "confidence": 0..1}
  Authorization: Bearer <OCR_API_KEY>  (OCR_API_KEY tanımlıysa zorunlu)
"""
import base64
import hmac
import os

import cv2
import numpy as np
from fastapi import FastAPI, Header, HTTPException
from paddleocr import PaddleOCR
from pydantic import BaseModel

API_KEY = os.getenv("OCR_API_KEY", "").strip()
PERSPECTIVE = os.getenv("OCR_PERSPECTIVE", "1") != "0"
LANG = os.getenv("OCR_LANG", "latin")  # latin modeli Türkçe karakterleri kapsar
MAX_BYTES = int(os.getenv("OCR_MAX_BYTES", str(12 * 1024 * 1024)))

app = FastAPI(title="kuponum-ocr-bridge")
ocr = PaddleOCR(use_angle_cls=True, lang=LANG, show_log=False)


class Req(BaseModel):
    image: str
    mime: str | None = None


def order_points(pts: np.ndarray) -> np.ndarray:
    s = pts.sum(axis=1)
    d = np.diff(pts, axis=1).ravel()
    return np.array(
        [pts[np.argmin(s)], pts[np.argmin(d)], pts[np.argmax(s)], pts[np.argmax(d)]],
        dtype="float32",
    )


def correct_perspective(img: np.ndarray) -> np.ndarray:
    """Kupon (en büyük dörtgen kontur) görüntünün >=%25'ini kaplıyorsa düzleştirir.
    Bulunamazsa görüntüyü olduğu gibi döndürür (asla bozmaz)."""
    h, w = img.shape[:2]
    gray = cv2.GaussianBlur(cv2.cvtColor(img, cv2.COLOR_BGR2GRAY), (5, 5), 0)
    edges = cv2.dilate(cv2.Canny(gray, 50, 150), np.ones((3, 3), np.uint8))
    contours, _ = cv2.findContours(edges, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
    for c in sorted(contours, key=cv2.contourArea, reverse=True)[:5]:
        if cv2.contourArea(c) < 0.25 * w * h:
            break
        approx = cv2.approxPolyDP(c, 0.02 * cv2.arcLength(c, True), True)
        if len(approx) != 4:
            continue
        rect = order_points(approx.reshape(4, 2).astype("float32"))
        tl, tr, br, bl = rect
        out_w = int(max(np.linalg.norm(br - bl), np.linalg.norm(tr - tl)))
        out_h = int(max(np.linalg.norm(tr - br), np.linalg.norm(tl - bl)))
        if out_w < 200 or out_h < 200:
            continue
        dst = np.array([[0, 0], [out_w - 1, 0], [out_w - 1, out_h - 1], [0, out_h - 1]], dtype="float32")
        return cv2.warpPerspective(img, cv2.getPerspectiveTransform(rect, dst), (out_w, out_h))
    return img


def group_lines(items: list[tuple[list, str, float]]) -> list[str]:
    """Kutuları okuma sırasına (üstten alta, soldan sağa) dizip aynı satırdakileri birleştirir."""
    boxes = []
    for box, text, _ in items:
        ys = [p[1] for p in box]
        xs = [p[0] for p in box]
        boxes.append({"y": (min(ys) + max(ys)) / 2, "h": max(ys) - min(ys), "x": min(xs), "t": text})
    boxes.sort(key=lambda b: b["y"])
    rows: list[list[dict]] = []
    for b in boxes:
        if rows and abs(b["y"] - np.mean([r["y"] for r in rows[-1]])) < 0.6 * max(b["h"], 1):
            rows[-1].append(b)
        else:
            rows.append([b])
    return [" ".join(x["t"] for x in sorted(r, key=lambda b: b["x"])) for r in rows]


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/ocr")
def run(req: Req, authorization: str | None = Header(default=None)):
    if API_KEY and not hmac.compare_digest(authorization or "", f"Bearer {API_KEY}"):
        raise HTTPException(status_code=401, detail="unauthorized")
    try:
        raw = base64.b64decode(req.image, validate=True)
    except Exception:
        raise HTTPException(status_code=400, detail="invalid base64")
    if len(raw) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="image too large")
    img = cv2.imdecode(np.frombuffer(raw, np.uint8), cv2.IMREAD_COLOR)
    if img is None:
        raise HTTPException(status_code=400, detail="invalid image")
    if PERSPECTIVE:
        img = correct_perspective(img)

    result = ocr.ocr(img, cls=True)
    page = (result[0] if result else None) or []
    items = [(r[0], r[1][0], float(r[1][1])) for r in page]
    if not items:
        return {"text": "", "confidence": 0.0}
    return {
        "text": "\n".join(group_lines(items)),
        "confidence": round(sum(i[2] for i in items) / len(items), 4),
    }
