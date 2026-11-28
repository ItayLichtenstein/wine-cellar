// Label photos: size math and storage paths (pure, tested), plus the
// browser-only re-encoding step.

export const LABEL_BUCKET = "labels";
export const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
/** Longest side after resizing: sharp on a phone, ~100–200 KB as WebP. */
export const MAX_SIDE = 1200;

/** The fridge thumbnail: portrait like a label, 3× the phone slot so the label is readable. WebP, or JPEG on Safari. */
export const THUMB = { width: 144, height: 192 } as const;
/** The database refuses longer thumbnails (wines_label_thumb_check). */
export const THUMB_MAX_CHARS = 40000;

/**
 * The part of a (width × height) image that fills a (w × h) box without
 * stretching: the middle, cut on the sides that are too long ("cover").
 */
export function coverCrop(width: number, height: number, w: number, h: number): { sx: number; sy: number; sw: number; sh: number } {
  const scale = Math.min(width / w, height / h);
  const sw = Math.round(w * scale);
  const sh = Math.round(h * scale);
  return { sx: Math.round((width - sw) / 2), sy: Math.round((height - sh) / 2), sw, sh };
}

/** Scales (width, height) down so the longer side is at most `max`; never up. */
export function fitSize(width: number, height: number, max = MAX_SIDE): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/**
 * Where a wine's photo lives: inside the cellar's own folder (RLS checks
 * the first folder), with a timestamp so a new photo never hits a cached old one.
 */
export function labelPath(cellarId: string, wineId: string, now = Date.now(), type = "image/webp"): string {
  return `${cellarId}/${wineId}-${now}.${type === "image/jpeg" ? "jpg" : "webp"}`;
}

/**
 * Re-encodes a photo in the browser: resize + WebP. Drawing to a canvas
 * keeps only the pixels, so EXIF metadata (GPS location of the home,
 * camera details) is dropped. Also normalises odd formats into one.
 */
export async function reencode(file: File): Promise<Blob> {
  if (!(ACCEPTED_TYPES as readonly string[]).includes(file.type)) throw new Error("type");
  // imageOrientation: apply the EXIF rotation before the metadata is dropped.
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const { width, height } = fitSize(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return encode(canvas, 0.82);
}

/**
 * WebP when the browser can write it, JPEG otherwise. Safari (iPhone and Mac)
 * reads WebP but cannot write it from a canvas: asked for WebP it quietly
 * returns a PNG, many times bigger (over the bucket's 1MB limit) and refused
 * by the label_thumb check.
 */
function blobOf(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("encode"))), type, quality),
  );
}
async function encode(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  const webp = await blobOf(canvas, "image/webp", quality);
  return webp.type === "image/webp" ? webp : blobOf(canvas, "image/jpeg", quality);
}

/**
 * A ~10KB WebP thumbnail as a data: URL, kept on the wine row (label_thumb)
 * so the fridge shows every label without loading the full photos.
 */
export async function makeThumb(image: Blob): Promise<string> {
  const bitmap = await createImageBitmap(image, { imageOrientation: "from-image" });
  const { sx, sy, sw, sh } = coverCrop(bitmap.width, bitmap.height, THUMB.width, THUMB.height);
  const canvas = document.createElement("canvas");
  canvas.width = THUMB.width;
  canvas.height = THUMB.height;
  canvas.getContext("2d")!.drawImage(bitmap, sx, sy, sw, sh, 0, 0, THUMB.width, THUMB.height);
  bitmap.close();
  const webp = canvas.toDataURL("image/webp", 0.8);
  if (webp.startsWith("data:image/webp") && webp.length <= THUMB_MAX_CHARS) return webp;
  // Safari (see encode()), or a very busy photo: JPEG, smaller if needed.
  const jpeg = canvas.toDataURL("image/jpeg", 0.8);
  return jpeg.length <= THUMB_MAX_CHARS ? jpeg : canvas.toDataURL("image/jpeg", 0.6);
}

/**
 * Where the label is in a product photo of a whole bottle (pure, tested).
 * Shops show the full bottle, tall and narrow, with the label on its lower
 * body; the fridge thumbnail (3:4, cut from the middle) would show the neck.
 * For a tall photo (after trimming the background) this is a 3:4 window
 * across the bottle's width, centred at 68% of its height. Otherwise null:
 * the photo is already of the label.
 */
export function labelWindow(width: number, height: number): { left: number; top: number; width: number; height: number } | null {
  if (width <= 0 || height / width < 1.8) return null;
  const h = Math.min(height, Math.round((width * 4) / 3));
  const top = Math.max(0, Math.min(height - h, Math.round(height * 0.68 - h / 2)));
  return { left: 0, top, width, height: h };
}

/**
 * The columns the bottle itself fills, in a shop photo already trimmed of
 * its plain background: a column counts only if a good part of its height
 * is clearly unlike the background. A soft shadow beside the bottle's foot
 * (common in shop photos) fills only a little height, so it is cut off and
 * the bottle stays centered. `grey` is one byte per pixel; null = keep all.
 */
export function bottleColumns(grey: Uint8Array, width: number, height: number): { left: number; width: number } | null {
  if (width < 10 || height < 10) return null;
  const bg = (grey[0] + grey[width - 1]) / 2; // the top corners, beside the neck
  const isContent = (x: number) => {
    let n = 0;
    for (let y = 0; y < height; y++) if (Math.abs(grey[y * width + x] - bg) > 60) n++;
    return n >= height * 0.25;
  };
  let left = 0;
  while (left < width && !isContent(left)) left++;
  let right = width - 1;
  while (right > left && !isContent(right)) right--;
  const w = right - left + 1;
  // Nothing clear found (a pale bottle on white), or nothing to cut: keep it as is.
  if (left >= width || w < width * 0.15 || w > width * 0.95) return null;
  return { left, width: w };
}
