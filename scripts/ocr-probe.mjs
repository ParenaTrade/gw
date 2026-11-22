// Geliştirme probu: sharp ön işleme + tesseract.js OCR çıktısını gösterir.
import sharp from "sharp";
import { createWorker } from "tesseract.js";
import path from "node:path";

const img = process.argv[2] ?? "storage/coupon-images/members/11111111-1111-4111-8111-111111111111/coupons/c0000001-0000-4000-8000-000000000001/original-seed.jpg";

const processed = await sharp(img)
  .rotate()
  .resize({ width: 1600, withoutEnlargement: true })
  .grayscale()
  .normalize()
  .median(1)
  .sharpen()
  .jpeg({ quality: 92 })
  .toBuffer();

console.log("processed bytes:", processed.length);

const worker = await createWorker("tur+eng", 1, {
  langPath: path.resolve("ocr-data"),
  gzip: true,
});
const t0 = Date.now();
const { data } = await worker.recognize(processed);
console.log("duration_ms:", Date.now() - t0, "confidence:", data.confidence);
console.log("=== RAW TEXT ===");
console.log(data.text);
await worker.terminate();
