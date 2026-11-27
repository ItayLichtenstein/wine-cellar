// Fetching a label photo from a link the AI found (server only). The AI
// never uploads anything itself: it gives a link, we fetch it safely,
// re-encode it like a camera photo, and store it in the cellar's own folder.

import { lookup, type LookupAddress } from "node:dns";
import { request } from "node:https";
import type { LookupFunction } from "node:net";
import sharp from "sharp";
import { checkImageUrl, isPublicAddress } from "./web-address";
import { MAX_SIDE } from "./label-image";

const MAX_BYTES = 5_000_000;
const TIMEOUT_MS = 8000;
const MAX_REDIRECTS = 3;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

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

type Got = { ok: true; body: Buffer } | { ok: false; reason: string } | { redirect: string };

function getOnce(url: URL): Promise<Got> {
  return new Promise((resolve) => {
    const req = request(
      url,
      { method: "GET", lookup: publicLookup, timeout: TIMEOUT_MS, headers: { accept: "image/jpeg,image/png,image/webp", "user-agent": "WineCellarApp/1.0 (label photo)" } },
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
        if (!IMAGE_TYPES.includes(type)) {
          res.resume();
          return resolve({ ok: false, reason: "the link is a web page or another file, not a JPEG/PNG/WebP image" });
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

/** Downloads the image (following up to 3 redirects, each checked again) and re-encodes it. */
export async function fetchLabelImage(link: string): Promise<WebImage> {
  let current = link;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const checked = checkImageUrl(current);
    if (!checked.ok) return checked;
    const got = await getOnce(checked.url);
    if ("redirect" in got) {
      current = got.redirect;
      continue;
    }
    if (!got.ok) return got;
    try {
      // Decoding proves it is really an image of an allowed kind; re-encoding
      // drops all metadata (EXIF), like photos taken in the app.
      const meta = await sharp(got.body, { limitInputPixels: 40_000_000 }).metadata();
      if (!["jpeg", "png", "webp"].includes(meta.format ?? "")) return { ok: false, reason: "not a JPEG/PNG/WebP image" };
      const webp = await sharp(got.body, { limitInputPixels: 40_000_000 })
        .rotate()
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
