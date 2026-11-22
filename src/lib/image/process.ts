import sharp from "sharp";

/**
 * OCR öncesi görüntü işleme — orijinal ASLA değiştirilmez, ayrı dosya üretilir.
 * orientation (EXIF) → boyut → grayscale → kontrast → denoise (median) → sharpen.
 * Tam perspektif düzeltmesi OpenCV gerektirir; OCR_API_URL köprüsündeki
 * PaddleOCR worker'ında yapılır (Faz 2 production hattı).
 */

export async function processForOcr(original: Buffer): Promise<{ bytes: Buffer; width: number; height: number }> {
  const pipeline = sharp(original)
    .rotate()
    .resize({ width: 1600, withoutEnlargement: true })
    .grayscale()
    .normalize()
    .median(1)
    .sharpen();
  const { data, info } = await pipeline.jpeg({ quality: 92 }).toBuffer({ resolveWithObject: true });
  return { bytes: data, width: info.width, height: info.height };
}
