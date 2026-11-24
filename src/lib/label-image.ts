// Label photos: size math and storage paths (pure, tested), plus the
// browser-only re-encoding step.

export const LABEL_BUCKET = "labels";
export const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
/** Longest side after resizing: sharp on a phone, ~100–200 KB as WebP. */
export const MAX_SIDE = 1200;

/** Scales (width, height) down so the longer side is at most `max`; never up. */
export function fitSize(width: number, height: number, max = MAX_SIDE): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/**
 * Where a wine's photo lives: inside the cellar's own folder (RLS checks
 * the first folder), with a timestamp so a new photo never hits a cached old one.
 */
export function labelPath(cellarId: string, wineId: string, now = Date.now()): string {
  return `${cellarId}/${wineId}-${now}.webp`;
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
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("encode"))), "image/webp", 0.82),
  );
}
