import { describe, expect, it } from "vitest";
import { base32Decode, base32Encode, generateRecoveryCodes, generateTotpSecret, totp, totpKeyUri, verifyTotp } from "@/lib/totp";

// RFC 6238 Appendix B test vectors (SHA-1, 30s step). The RFC's reference codes
// are 8 digits; the last 6 digits equal our 6-digit codes since truncation to
// N digits is just `binary % 10^N`, and (x % 10^8) % 10^6 === x % 10^6.
const RFC_SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"; // base32("12345678901234567890")
const VECTORS: [number, string][] = [
  [59_000, "287082"],
  [1_111_111_109_000, "081804"],
  [1_111_111_111_000, "050471"],
  [1_234_567_890_000, "005924"],
  [2_000_000_000_000, "279037"],
];

describe("totp", () => {
  it("matches RFC 6238 test vectors", () => {
    for (const [timeMs, expected] of VECTORS) {
      expect(totp(RFC_SECRET, timeMs)).toBe(expected);
    }
  });

  it("verifies a code generated for the same secret and time", () => {
    const secret = generateTotpSecret();
    const now = Date.now();
    expect(verifyTotp(secret, totp(secret, now), now)).toBe(true);
  });

  it("accepts one step of clock drift, rejects two", () => {
    const secret = generateTotpSecret();
    const now = Date.now();
    const oneStepAgo = totp(secret, now - 30_000);
    const twoStepsAgo = totp(secret, now - 60_000);
    expect(verifyTotp(secret, oneStepAgo, now)).toBe(true);
    expect(verifyTotp(secret, twoStepsAgo, now)).toBe(false);
  });

  it("rejects a wrong code and malformed input", () => {
    const secret = generateTotpSecret();
    const now = Date.now();
    const wrong = String((Number(totp(secret, now)) + 1) % 1_000_000).padStart(6, "0");
    expect(verifyTotp(secret, wrong, now)).toBe(false);
    expect(verifyTotp(secret, "abc", now)).toBe(false);
    expect(verifyTotp(secret, "12345", now)).toBe(false);
  });

  it("round-trips base32", () => {
    const bytes = Buffer.from("a mildly random test payload!!", "utf8");
    expect(base32Decode(base32Encode(bytes))).toEqual(bytes);
  });

  it("builds a valid otpauth:// URI", () => {
    const uri = totpKeyUri("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ", "ada@example.com");
    expect(uri).toMatch(/^otpauth:\/\/totp\/CRM%3Aada%40example\.com\?/);
    expect(uri).toContain("secret=GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
  });

  it("generates unique, correctly formatted recovery codes", () => {
    const codes = generateRecoveryCodes();
    expect(codes).toHaveLength(8);
    expect(new Set(codes).size).toBe(8);
    for (const code of codes) expect(code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  });
});
