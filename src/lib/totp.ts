import crypto from "node:crypto";

/**
 * RFC 4226 (HOTP) / RFC 6238 (TOTP), 6-digit codes, 30s step, SHA-1 — the
 * parameters every authenticator app (Google/Microsoft/Authy/1Password...)
 * assumes when you don't tell it otherwise. Pure and dependency-free.
 */

const STEP_SECONDS = 30;
const DIGITS = 6;
const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(buffer: Buffer): string {
  let bits = "";
  for (const byte of buffer) bits += byte.toString(2).padStart(8, "0");
  let out = "";
  for (let i = 0; i + 5 <= bits.length; i += 5) out += BASE32_ALPHABET[parseInt(bits.slice(i, i + 5), 2)];
  const remainder = bits.length % 5;
  if (remainder) out += BASE32_ALPHABET[parseInt(bits.slice(-remainder).padEnd(5, "0"), 2)];
  return out;
}

export function base32Decode(value: string): Buffer {
  const clean = value.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = "";
  for (const char of clean) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) continue;
    bits += index.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

export function generateTotpSecret(): string {
  return base32Encode(crypto.randomBytes(20));
}

function hotp(secret: string, counter: number): string {
  const key = base32Decode(secret);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac("sha1", key).update(counterBuffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) | ((hmac[offset + 1] & 0xff) << 16) | ((hmac[offset + 2] & 0xff) << 8) | (hmac[offset + 3] & 0xff);
  return String(binary % 10 ** DIGITS).padStart(DIGITS, "0");
}

export function totp(secret: string, time: number = Date.now()): string {
  return hotp(secret, Math.floor(time / 1000 / STEP_SECONDS));
}

/**
 * Accepts the current step and one step of clock drift on either side.
 * Returns the matched step counter (for replay protection — see
 * verifyTotpStep's callers) or null if the code didn't match.
 */
export function verifyTotpStep(secret: string, token: string, time: number = Date.now(), window = 1): number | null {
  const cleaned = token.trim();
  if (!/^\d{6}$/.test(cleaned)) return null;
  const counter = Math.floor(time / 1000 / STEP_SECONDS);
  for (let i = -window; i <= window; i++) {
    if (crypto.timingSafeEqual(Buffer.from(hotp(secret, counter + i)), Buffer.from(cleaned))) return counter + i;
  }
  return null;
}

/** Accepts the current step and one step of clock drift on either side. */
export function verifyTotp(secret: string, token: string, time: number = Date.now(), window = 1): boolean {
  return verifyTotpStep(secret, token, time, window) !== null;
}

export function totpKeyUri(secret: string, email: string, issuer = "CRM"): string {
  const label = encodeURIComponent(`${issuer}:${email}`);
  const params = new URLSearchParams({ secret, issuer, algorithm: "SHA1", digits: String(DIGITS), period: String(STEP_SECONDS) });
  return `otpauth://totp/${label}?${params}`;
}

/** Human-readable recovery codes: 8 groups of "XXXX-XXXX" from an unambiguous alphabet. */
export function generateRecoveryCodes(count = 8): string[] {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I
  return Array.from({ length: count }, () => {
    const part = () =>
      Array.from(crypto.randomBytes(4))
        .map((b) => alphabet[b % alphabet.length])
        .join("");
    return `${part()}-${part()}`;
  });
}
