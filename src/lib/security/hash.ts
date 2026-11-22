import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

/** Sunucu tarafı hash yardımcıları. Token/OTP/IP asla düz saklanmaz. */

export function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export function authPepper(): string {
  return process.env.AUTH_PEPPER?.trim() || "kuponum-dev-pepper";
}

export function hashWithPepper(input: string): string {
  return sha256Hex(`${input}:${authPepper()}`);
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function randomDigits(length: number): string {
  let out = "";
  for (let i = 0; i < length; i += 1) out += String(randomInt(0, 10));
  return out;
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}
