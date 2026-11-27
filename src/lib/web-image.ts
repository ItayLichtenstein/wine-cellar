// Fetching a label photo from a link the AI found (server only). The AI
// never uploads anything itself: it gives a link, we fetch it safely,
// re-encode it like a camera photo, and store it in the cellar's own folder.

import { lookup, type LookupAddress } from "node:dns";
import { request } from "node:https";
import type { LookupFunction } from "node:net";
import sharp from "sharp";
import { checkImageUrl, isPublicAddress } from "./web-address";
import { findPageImage } from "./page-image";
import { labelWindow, MAX_SIDE } from "./label-image";

const MAX_BYTES = 5_000_000;
const TIMEOUT_MS = 8000;
const MAX_REDIRECTS = 3;
const MAX_PAGE_BYTES = 1_000_000;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const PAGE_TYPES = ["text/html", "application/xhtml+xml"];

export type WebImage = { ok: true; webp: Buffer } | { ok: false; reason: string };

/**
 * DNS lookup that refuses private addresses. It runs at connect time, so a
 * name that resolves to a public address when checked and a private one
 * when connecting (DNS rebinding) is still refused.
 */
const publicLookup: LookupFunction = (hostname, options, callback) => {
  lookup(hostname, { all: true }, (err, addresses: LookupAddress[]) => {
    if (err) return callback(err, "", 0);
    if (!addresses.length || addresses.some((a) => !isPublicAddress(a.address))) {
      return callback(Object.assign(new Error("private address"), { code: "EPRIVATE" }), "", 0);
    }
    if (options.all) return (callback as unknown as (e: null, a: LookupAddress[]) => void)(null, addresses);
    callback(null, addresses[0].address, addresses[0].family);
  });
};

type Got = { ok: true; body: Buffer } | { ok: false; reason: string } | { redirect: string } | { page: string };

/** One request. A web page is read (its first 1MB) only when `pageAllowed`. */
function getOnce(url: URL, pageAllowed: boolean): Promise<Got> {
  return new Promise((resolve) => {
    const req = request(
      url,
      { method: "GET", lookup: publicLookup, timeout: TIMEOUT_MS, headers: { accept: "image/jpeg,image/png,image/webp,text/html;q=0.8", "user-agent": "Mozilla/5.0 (compatible; WineCellarApp/1.0; label photo)" } },
      (res) => {
        const status = res.statusCode ?? 0;
        if (status >= 300 && status < 400 && res.headers.location) {
          res.resume();
          return resolve({ redirect: new URL(res.headers.location, url).toString() });
        }
        if (status !== 200) {
          res.resume();
          return resolve({ ok: false, reason: `the site answered ${status} (broken link or blocked)` });
        }
        const type = (res.headers["content-type"] ?? "").split(";")[0].trim().toLowerCase();
        if (pageAllowed && PAGE_TYPES.includes(type)) {
          // The wine's page at a shop or winery: read the start of it to
          // find its product photo.
          const chunks: Buffer[] = [];
          let size = 0;
          res.on("data", (c: Buffer) => {
            size += c.length;
            chunks.push(c);
            if (size > MAX_PAGE_BYTES) {
              req.destroy();
              resolve({ page: Buffer.concat(chunks).toString("utf8") });
            }
          });
          res.on("end", () => resolve({ page: Buffer.concat(chunks).toString("utf8") }));
          res.on("error", () => resolve({ ok: false, reason: "the page could not be read" }));
          return;
        }
        if (!IMAGE_TYPES.includes(type)) {
          res.resume();
          return resolve({ ok: false, reason: "the link is not a JPEG/PNG/WebP image or a web page with one" });
        }
        const chunks: Buffer[] = [];
        let size = 0;
        res.on("data", (c: Buffer) => {
          size += c.length;
          if (size > MAX_BYTES) {
            req.destroy();
            resolve({ ok: false, reason: "the image is larger than 5MB" });
          } else chunks.push(c);
        });
        res.on("end", () => resolve({ ok: true, body: Buffer.concat(chunks) }));
        res.on("error", () => resolve({ ok: false, reason: "the download failed" }));
      },
    );
    req.on("timeout", () => {
      req.destroy();
      resolve({ ok: false, reason: "the site took too long to answer" });
    });
    req.on("error", (e: NodeJS.ErrnoException) =>
      resolve({ ok: false, reason: e.code === "EPRIVATE" ? "only public websites are accepted" : "the site could not be reached" }),
    );
    req.end();
  });
}

/**
 * Downloads the image and re-encodes it. The link may be the image itself or
 * the wine's web page, whose product photo (og:image) is then fetched. Every
 * address on the way (redirects, the photo on the page) is checked again.
 */
export async function fetchLabelImage(link: string): Promise<WebImage> {
  let current = link;
  let pageAllowed = true;
  for (let hop = 0; hop <= MAX_REDIRECTS + 1; hop++) {
    const checked = checkImageUrl(current);
    if (!checked.ok) return checked;
    const got = await getOnce(checked.url, pageAllowed);
    if ("redirect" in got) {
      current = got.redirect;
      continue;
    }
    if ("page" in got) {
      const image = findPageImage(got.page, checked.url.toString());
      if (!image) return { ok: false, reason: "the page has no product photo (send the image file's own link instead)" };
      // Only one page: the photo it points to must be an image.
      current = image;
      pageAllowed = false;
      continue;
    }
    if (!got.ok) return got;
    try {
      // Decoding proves it is really an image of an allowed kind; re-encoding
      // drops all metadata (EXIF), like photos taken in the app.
      const meta = await sharp(got.body, { limitInputPixels: 40_000_000 }).metadata();
      if (!["jpeg", "png", "webp"].includes(meta.format ?? "")) return { ok: false, reason: "not a JPEG/PNG/WebP image" };
      // A shop photo of the whole bottle: trim the plain background, then
      // keep only the label (see labelWindow).
      const upright = await sharp(got.body, { limitInputPixels: 40_000_000 }).rotate().toBuffer({ resolveWithObject: true });
      const base = (await sharp(upright.data).trim({ threshold: 20 }).toBuffer({ resolveWithObject: true }).catch(() => null)) ?? upright;
      const window = labelWindow(base.info.width, base.info.height);
      const webp = await (window ? sharp(base.data).extract(window) : sharp(base.data))
        .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: "inside", withoutEnlargement: true })
        .webp({ quality: 82 })
        .toBuffer();
      return { ok: true, webp };
    } catch {
      return { ok: false, reason: "the file is not a readable image" };
    }
  }
  return { ok: false, reason: "too many redirects" };
}
