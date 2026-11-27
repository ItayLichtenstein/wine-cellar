import { describe, expect, it } from "vitest";
import { checkImageUrl, isPublicAddress } from "./web-address";

describe("isPublicAddress", () => {
  it("accepts public addresses", () => {
    for (const ip of ["8.8.8.8", "151.101.1.69", "2606:4700::6810:84e5"]) expect(isPublicAddress(ip)).toBe(true);
  });
  it("refuses private, local, metadata and reserved ones", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "172.20.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "224.0.0.1", "::1", "::", "fd00::1", "fe80::1", "::ffff:10.0.0.1", "::ffff:127.0.0.1", "::ffff:7f00:1", "::ffff:a9fe:a9fe", "not-an-ip"]) {
      expect(isPublicAddress(ip)).toBe(false);
    }
  });
});

describe("checkImageUrl", () => {
  it("accepts a public https link", () => {
    expect(checkImageUrl("https://example.com/label.jpg").ok).toBe(true);
  });
  it("refuses anything else", () => {
    for (const url of [
      "http://example.com/a.jpg",
      "ftp://example.com/a.jpg",
      "file:///etc/passwd",
      "https://user:pw@example.com/a.jpg",
      "https://example.com:8443/a.jpg",
      "https://localhost/a.jpg",
      "https://127.0.0.1/a.jpg",
      "https://[::1]/a.jpg",
      "https://169.254.169.254/latest/meta-data",
      "https://intranet/a.jpg",
      "not a link",
    ]) expect(checkImageUrl(url).ok, url).toBe(false);
  });
});
