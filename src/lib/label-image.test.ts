import { describe, expect, it } from "vitest";
import { bottleColumns, coverCrop, fitSize, labelPath, labelWindow } from "./label-image";

describe("fitSize", () => {
  it("shrinks the longer side to the maximum, keeping the ratio", () => {
    expect(fitSize(4000, 3000)).toEqual({ width: 1200, height: 900 });
    expect(fitSize(3000, 4000)).toEqual({ width: 900, height: 1200 });
  });
  it("never enlarges a small photo", () => {
    expect(fitSize(800, 600)).toEqual({ width: 800, height: 600 });
  });
});

it("labelPath puts the photo in the cellar's own folder", () => {
  expect(labelPath("cellar-1", "wine-2", 123)).toBe("cellar-1/wine-2-123.webp");
});

describe("coverCrop", () => {
  it("cuts the sides of a wide photo, keeping the middle", () => {
    expect(coverCrop(1200, 800, 96, 128)).toEqual({ sx: 300, sy: 0, sw: 600, sh: 800 });
  });
  it("cuts top and bottom of a tall photo", () => {
    expect(coverCrop(600, 1600, 96, 128)).toEqual({ sx: 0, sy: 400, sw: 600, sh: 800 });
  });
  it("takes everything when the ratio already matches", () => {
    expect(coverCrop(300, 400, 96, 128)).toEqual({ sx: 0, sy: 0, sw: 300, sh: 400 });
  });
});

it("labelPath names a JPEG photo .jpg (Safari cannot write WebP)", () => {
  expect(labelPath("c", "w", 5, "image/jpeg")).toBe("c/w-5.jpg");
  expect(labelPath("c", "w", 5)).toBe("c/w-5.webp");
});

describe("labelWindow", () => {
  it("leaves a label-shaped or wide photo alone", () => {
    expect(labelWindow(900, 1200)).toBeNull();
    expect(labelWindow(1200, 800)).toBeNull();
  });

  it("cuts a 3:4 window around 68% of a whole-bottle photo", () => {
    expect(labelWindow(300, 1000)).toEqual({ left: 0, top: 480, width: 300, height: 400 });
  });

  it("stays inside the photo", () => {
    const w = labelWindow(500, 900)!;
    expect(w.top + w.height).toBeLessThanOrEqual(900);
    expect(w.top).toBeGreaterThanOrEqual(0);
  });
});

describe("bottleColumns", () => {
  // White photo, a dark bottle in the middle, a grey shadow at its foot on the left.
  const photo = (w: number, h: number) => {
    const g = new Uint8Array(w * h).fill(255);
    for (let y = 0; y < h; y++) for (let x = 40; x < 60; x++) g[y * w + x] = 30;
    for (let y = h - 8; y < h; y++) for (let x = 0; x < 40; x++) g[y * w + x] = 150;
    return g;
  };
  it("keeps the bottle and cuts the shadow beside it", () => {
    expect(bottleColumns(photo(80, 100), 80, 100)).toEqual({ left: 40, width: 20 });
  });
  it("keeps the photo as it is when there is nothing clear to cut", () => {
    expect(bottleColumns(new Uint8Array(80 * 100).fill(255), 80, 100)).toBeNull();
  });
});
