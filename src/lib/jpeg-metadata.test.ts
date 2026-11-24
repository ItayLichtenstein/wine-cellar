import { describe, expect, it } from "vitest";
import { hasExif, stripJpegMetadata } from "./jpeg-metadata";

// A tiny synthetic JPEG: SOI, APP0 (JFIF), APP1 (EXIF), COM, SOS + data, EOI.
const segment = (marker: number, data: number[]) => [0xff, marker, 0, data.length + 2, ...data];
const jpeg = Uint8Array.from([
  0xff, 0xd8,
  ...segment(0xe0, [0x4a, 0x46, 0x49, 0x46, 0]), // "JFIF\0"
  ...segment(0xe1, [0x45, 0x78, 0x69, 0x66, 0, 0, 1, 2, 3]), // "Exif\0\0" + GPS-ish bytes
  ...segment(0xfe, [0x68, 0x69]), // comment "hi"
  0xff, 0xda, 0, 2, 9, 9, 9, // start of scan + image data
  0xff, 0xd9,
]);

describe("stripJpegMetadata", () => {
  it("removes EXIF and comments, keeps JFIF and the image data", () => {
    expect(hasExif(jpeg)).toBe(true);
    const clean = stripJpegMetadata(jpeg);
    expect(hasExif(clean)).toBe(false);
    expect([...clean.slice(0, 4)]).toEqual([0xff, 0xd8, 0xff, 0xe0]); // JFIF kept
    expect([...clean.slice(-9)]).toEqual([0xff, 0xda, 0, 2, 9, 9, 9, 0xff, 0xd9]); // image data untouched
    expect(clean.length).toBe(jpeg.length - (2 + 2 + 9) - (2 + 2 + 2));
  });

  it("rejects something that is not a JPEG", () => {
    expect(() => stripJpegMetadata(Uint8Array.from([0x89, 0x50, 0x4e, 0x47]))).toThrow();
  });
});
