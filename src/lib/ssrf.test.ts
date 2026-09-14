import { describe, expect, it } from "vitest";
import { assertPublicUrl, isPrivateAddress } from "./ssrf";

describe("isPrivateAddress", () => {
  it.each([
    "127.0.0.1",
    "10.1.2.3",
    "172.16.0.1",
    "172.31.255.255",
    "192.168.1.1",
    "169.254.169.254", // cloud metadata endpoint
    "100.64.0.1",
    "0.0.0.0",
    "224.0.0.1",
    "::1",
    "::",
    "fd00::1",
    "fe80::1",
    "::ffff:127.0.0.1",
  ])("%s is private", (ip) => {
    expect(isPrivateAddress(ip)).toBe(true);
  });

  it.each(["8.8.8.8", "1.1.1.1", "172.32.0.1", "100.128.0.1", "2606:4700:4700::1111", "::ffff:8.8.8.8"])(
    "%s is public",
    (ip) => {
      expect(isPrivateAddress(ip)).toBe(false);
    },
  );

  it("treats non-IP input as unsafe", () => {
    expect(isPrivateAddress("example.com")).toBe(true);
  });
});

describe("assertPublicUrl", () => {
  it("rejects non-http protocols", async () => {
    await expect(assertPublicUrl("file:///etc/passwd")).rejects.toThrow(/http or https/);
  });

  it("rejects malformed URLs", async () => {
    await expect(assertPublicUrl("not a url")).rejects.toThrow(/valid URL/);
  });

  it("rejects private IPv4 and IPv6 literals", async () => {
    await expect(assertPublicUrl("http://127.0.0.1:8080/hook")).rejects.toThrow(/public/);
    await expect(assertPublicUrl("http://169.254.169.254/latest/meta-data")).rejects.toThrow(/public/);
    await expect(assertPublicUrl("http://[::1]/hook")).rejects.toThrow(/public/);
  });

  it("accepts public IP literals", async () => {
    await expect(assertPublicUrl("https://8.8.8.8/hook")).resolves.toBeInstanceOf(URL);
  });

  it("allows private addresses only when explicitly enabled", async () => {
    await expect(assertPublicUrl("http://127.0.0.1:8080/hook", true)).resolves.toBeInstanceOf(URL);
  });
});
