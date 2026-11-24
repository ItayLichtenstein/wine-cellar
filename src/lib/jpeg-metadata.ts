// Removes metadata from a JPEG without re-encoding it (for scripts that run
// in Node, where there is no canvas). The browser upload re-encodes instead.
//
// A JPEG is a list of segments: FF D8 (start), then [FF marker, 2-byte
// length, data]…, until FF DA (start of scan) after which the image data
// runs to the end. Metadata lives in its own segments, so dropping them
// leaves the picture untouched:
//   APP1 (FF E1)  EXIF – camera details and GPS location; also XMP
//   APP13 (FF ED) IPTC / Photoshop
//   COM (FF FE)   free-text comments

const DROP = new Set([0xe1, 0xed, 0xfe]);

export function stripJpegMetadata(input: Uint8Array): Uint8Array {
  if (input[0] !== 0xff || input[1] !== 0xd8) throw new Error("not a JPEG");
  const out: number[] = [0xff, 0xd8];
  let i = 2;
  while (i + 4 <= input.length) {
    if (input[i] !== 0xff) throw new Error("broken JPEG");
    const marker = input[i + 1];
    if (marker === 0xda) {
      // Start of scan: copy the rest (image data + end marker) as is.
      for (let k = i; k < input.length; k++) out.push(input[k]);
      return Uint8Array.from(out);
    }
    const length = (input[i + 2] << 8) | input[i + 3]; // includes the 2 length bytes
    const end = i + 2 + length;
    if (!DROP.has(marker)) for (let k = i; k < end; k++) out.push(input[k]);
    i = end;
  }
  throw new Error("broken JPEG");
}

/** True if the JPEG still has an EXIF segment (used by tests and checks). */
export function hasExif(input: Uint8Array): boolean {
  let i = 2;
  while (i + 4 <= input.length && input[i] === 0xff && input[i + 1] !== 0xda) {
    if (input[i + 1] === 0xe1) return true;
    i += 2 + ((input[i + 2] << 8) | input[i + 3]);
  }
  return false;
}
