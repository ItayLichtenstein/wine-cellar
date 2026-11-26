// Label photos: size math and storage paths (pure, tested), plus the
// browser-only re-encoding step.

export const LABEL_BUCKET = "labels";
export const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
/** Longest side after resizing: sharp on a phone, ~100–200 KB as WebP. */
export const MAX_SIDE = 1200;

/** The fridge thumbnail: portrait like a label, 2× the slot for sharp phones. WebP, or JPEG on Safari. */
export const THUMB = { width: 96, height: 128 } as const;

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
 * A ~4KB WebP thumbnail as a data: URL, kept on the wine row (label_thumb)
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
  const webp = canvas.toDataURL("image/webp", 0.7);
  return webp.startsWith("data:image/webp") ? webp : canvas.toDataURL("image/jpeg", 0.75); // Safari, see encode()
}
