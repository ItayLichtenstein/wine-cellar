// Which web addresses the server may fetch an image from (pure, tested).
// The AI hands us a link; fetching it from our server must never reach our
// own network or cloud metadata (SSRF). Only https on the default port, no
// user:password, and every address the name resolves to must be public.

import { BlockList, isIP } from "node:net";

const blocked = new BlockList();
for (const [net, prefix] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16],
  ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15],
  ["198.51.100.0", 24], ["203.0.113.0", 24], ["224.0.0.0", 3],
] as const) blocked.addSubnet(net, prefix, "ipv4");
for (const [net, prefix] of [
  ["::", 128], ["::1", 128], ["64:ff9b::", 96], ["100::", 64], ["2001:db8::", 32],
  ["fc00::", 7], ["fe80::", 10], ["ff00::", 8],
] as const) blocked.addSubnet(net, prefix, "ipv6");

/** True for an address on the open internet; false for private, local, reserved or malformed ones. */
export function isPublicAddress(ip: string): boolean {
  const family = isIP(ip);
  if (family === 4) return !blocked.check(ip, "ipv4");
  if (family === 6) {
    // An IPv4 address written as IPv6 (::ffff:10.0.0.1) is judged as IPv4. (Not
    // in the list: Node matches every IPv4 address against an ::ffff:0:0/96 rule.)
    const mapped = ip.toLowerCase().match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPublicAddress(mapped[1]);
    const hex = ip.toLowerCase().match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
    if (hex) {
      const [hi, lo] = [parseInt(hex[1], 16), parseInt(hex[2], 16)];
      return isPublicAddress(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`);
    }
    return !blocked.check(ip, "ipv6");
  }
  return false;
}

export type UrlCheck = { ok: true; url: URL } | { ok: false; reason: string };

/** The link itself, before any network call. */
export function checkImageUrl(raw: string): UrlCheck {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return { ok: false, reason: "not a valid link" };
  }
  if (url.protocol !== "https:") return { ok: false, reason: "only https links are accepted" };
  if (url.username || url.password) return { ok: false, reason: "links with a user name or password are not accepted" };
  if (url.port && url.port !== "443") return { ok: false, reason: "only the standard https port is accepted" };
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host) ? !isPublicAddress(host) : host === "localhost" || host.endsWith(".localhost") || !host.includes(".")) {
    return { ok: false, reason: "only public websites are accepted" };
  }
  return { ok: true, url };
}
