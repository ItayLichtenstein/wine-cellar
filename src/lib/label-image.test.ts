import { describe, expect, it } from "vitest";
import { fitSize, labelPath } from "./label-image";

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
