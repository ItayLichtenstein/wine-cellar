// The main product photo of a web page (pure, so it is tested). Shops and
// wineries mark it for link previews (Open Graph, Twitter cards), so an AI
// that found the wine's page does not need the image file's own address.

const KEYS = ["og:image:secure_url", "og:image", "og:image:url", "twitter:image", "twitter:image:src"];

/** Attributes of one tag, lower-cased names: `<meta property="og:image" content="…">`. */
function attributes(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of tag.matchAll(/([a-zA-Z:-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/g)) {
    out[m[1].toLowerCase()] = m[3] ?? m[4] ?? m[5] ?? "";
  }
  return out;
}

const decode = (s: string) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&#x2F;/gi, "/")
    .replace(/&#47;/g, "/")
    .trim();

/**
 * The page's preview image as an absolute https address, or null. Looks at
 * Open Graph and Twitter meta tags first, then `<link rel="image_src">`.
 * The address is checked again (public https only) before it is fetched.
 */
export function findPageImage(html: string, pageUrl: string): string | null {
  const head = html.slice(0, 500_000);
  const found = new Map<string, string>();
  for (const m of head.matchAll(/<meta\b[^>]*>/gi)) {
    const a = attributes(m[0]);
    const key = (a.property ?? a.name ?? "").toLowerCase();
    if (KEYS.includes(key) && a.content && !found.has(key)) found.set(key, a.content);
  }
  for (const m of head.matchAll(/<link\b[^>]*>/gi)) {
    const a = attributes(m[0]);
    if ((a.rel ?? "").toLowerCase() === "image_src" && a.href && !found.has("image_src")) found.set("image_src", a.href);
  }
  for (const key of [...KEYS, "image_src"]) {
    const raw = found.get(key);
    if (!raw) continue;
    try {
      const url = new URL(decode(raw), pageUrl);
      if (url.protocol === "https:") return url.toString();
    } catch {
      // not an address: try the next tag
    }
  }
  return null;
}
