# OCR köprüsü

PaddleOCR + OpenCV perspektif düzeltme. Next.js tarafı `OCR_API_URL` ile bağlanır.

```bash
docker build -t kuponum-ocr .
docker run -p 8080:8080 -e OCR_API_KEY=gizli kuponum-ocr
curl localhost:8080/health
```

Uygulama env'i: `OCR_API_URL=https://<host>/ocr`, `OCR_API_KEY=gizli`.
Uç nokta herkese açık olacaksa mutlaka `OCR_API_KEY` ayarlayın (Bearer doğrulaması).

Ayarlar: `OCR_PERSPECTIVE=0` (perspektif düzeltmeyi kapat), `OCR_LANG` (varsayılan `latin`),
`OCR_MAX_BYTES`. İlk gerçek kupon fotoğraflarıyla doğruluğu ölçün; gerekirse
`scripts/ocr-probe.mjs` çıktısıyla karşılaştırın.
