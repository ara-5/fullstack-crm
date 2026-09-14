import "server-only";
import { lookup } from "node:dns/promises";
import net from "node:net";
import { CrmError } from "@/lib/errors";

/**
 * True for loopback, private, link-local (incl. cloud metadata 169.254.169.254),
 * CGNAT, benchmarking, multicast/reserved and IPv6 local ranges.
 */
export function isPrivateAddress(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateAddress(mapped[1]);
    return (
      lower === "::" ||
      lower === "::1" ||
      lower.startsWith("fc") ||
      lower.startsWith("fd") ||
      /^fe[89ab]/.test(lower) ||
      lower.startsWith("ff")
    );
  }
  return true; // not an IP at all: treat as unsafe
}

/**
 * Guards outbound webhook requests against SSRF: http(s) only, and every
 * address the host resolves to must be public. Re-checked before each delivery
 * so a DNS change can't turn an approved URL into an internal one.
 */
export async function assertPublicUrl(rawUrl: string, allowPrivate = false) {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new CrmError(422, "Enter a valid URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new CrmError(422, "Webhook URLs must use http or https");
  }
  if (allowPrivate) return url;

  const host = url.hostname.replace(/^\[|\]$/g, "");
  let addresses: string[];
  if (net.isIP(host)) {
    addresses = [host];
  } else {
    try {
      addresses = (await lookup(host, { all: true })).map((a) => a.address);
    } catch {
      throw new CrmError(422, `Could not resolve ${host}`);
    }
  }
  if (addresses.length === 0 || addresses.some(isPrivateAddress)) {
    throw new CrmError(422, "Webhook URLs must point to a public internet address");
  }
  return url;
}
