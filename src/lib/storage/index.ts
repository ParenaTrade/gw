import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
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

/**
 * Depolama istemcisi. Giriş passkey + uygulama oturumu ile yapıldığı için
 * istekte Supabase kullanıcı JWT'si yoktur; bu yüzden sunucuda
 * SUPABASE_SERVICE_ROLE_KEY tanımlıysa onunla bağlanılır (yalnızca server,
 * asla NEXT_PUBLIC_*). Erişim kontrolü (owner/partner) API route'larındadır.
 * Tanımsızsa eski davranış: kullanıcı oturumlu Supabase istemcisi.
 */
async function getStorageClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (url && serviceKey) {
    return createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  return createSupabaseServerClient();
}

function localRoot(): string {
  const configured = process.env.LOCAL_STORAGE_DIR?.trim();
  if (configured) return configured;
  // Vercel'de dosya sistemi salt-okunur; yalnızca /tmp yazılabilir.
  // (Kalıcı depo için Supabase Storage kullanın; /tmp geçicidir.)
  if (process.env.VERCEL) return path.join(os.tmpdir(), BUCKET);
  return path.join(/*turbopackIgnore: true*/ process.cwd(), "storage", BUCKET);
}

/**
 * Yerel depoda storagePath'i güvenli biçimde çözer; kök dizin dışına
 * çıkan (path traversal) yolları null döner.
 * `turbopackIgnore`: yol çalışma zamanında belirlendiği için Turbopack'in
 * tüm projeyi trace etmesini (build uyarısı + dev. boyutu) engeller.
 */
function resolveLocalPath(storagePath: string): string | null {
  const root = path.resolve(/*turbopackIgnore: true*/ localRoot());
  const target = path.resolve(/*turbopackIgnore: true*/ root, storagePath);
  return target.startsWith(root + path.sep) ? target : null;
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
    const supabase = await getStorageClient();
    if (!supabase) throw new Error("Supabase storage istemcisi oluşturulamadı.");
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, bytes, { contentType: mime, upsert: false });
    if (error) throw new Error(`Storage yükleme hatası: ${error.message}`);
    return;
  }
  const target = resolveLocalPath(storagePath);
  if (!target) throw new Error("Geçersiz storage path.");
  await mkdir(/*turbopackIgnore: true*/ path.dirname(target), { recursive: true });
  await writeFile(/*turbopackIgnore: true*/ target, bytes, { flag: "wx" });
}

export async function readCouponImage(storagePath: string): Promise<Buffer | null> {
  if (isSupabaseConfigured()) {
    const supabase = await getStorageClient();
    if (!supabase) return null;
    const { data, error } = await supabase.storage.from(BUCKET).download(storagePath);
    if (error || !data) return null;
    return Buffer.from(await data.arrayBuffer());
  }
  const target = resolveLocalPath(storagePath);
  if (!target) return null;
  try {
    return await readFile(/*turbopackIgnore: true*/ target);
  } catch {
    return null;
  }
}
