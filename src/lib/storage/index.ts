import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

/**
 * Özel (private) kupon görseli deposu.
 * - Supabase modu: 'coupon-images' private bucket (RLS storage policy'leri).
 * - Yerel mod: public OLMAYAN dosya dizini; erişim yalnızca yetkili API
 *   route'u üzerinden akar (owner / partner kontrolü).
 * Orijinal görsel değiştirilemez audit kaydıdır; üzerine yazılmaz.
 */

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const BUCKET = "coupon-images";

function localRoot(): string {
  return process.env.LOCAL_STORAGE_DIR?.trim() || path.join(process.cwd(), "storage", BUCKET);
}

export function detectImageMime(bytes: Buffer): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 12 &&
    bytes.toString("ascii", 0, 4) === "RIFF" &&
    bytes.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

export function couponImagePath(memberId: string, couponId: string, imageType: string, mime: string) {
  const ext = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
  return `members/${memberId}/coupons/${couponId}/${imageType}-${Date.now()}.${ext}`;
}

export async function putCouponImage(storagePath: string, bytes: Buffer, mime: string): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    if (!supabase) throw new Error("Supabase storage istemcisi oluşturulamadı.");
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, bytes, { contentType: mime, upsert: false });
    if (error) throw new Error(`Storage yükleme hatası: ${error.message}`);
    return;
  }
  const target = path.resolve(localRoot(), storagePath);
  if (!target.startsWith(path.resolve(localRoot()) + path.sep)) {
    throw new Error("Geçersiz storage path.");
  }
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, bytes, { flag: "wx" });
}

export async function readCouponImage(storagePath: string): Promise<Buffer | null> {
  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return null;
    const { data, error } = await supabase.storage.from(BUCKET).download(storagePath);
    if (error || !data) return null;
    return Buffer.from(await data.arrayBuffer());
  }
  const target = path.resolve(localRoot(), storagePath);
  if (!target.startsWith(path.resolve(localRoot()) + path.sep)) return null;
  try {
    return await readFile(target);
  } catch {
    return null;
  }
}
