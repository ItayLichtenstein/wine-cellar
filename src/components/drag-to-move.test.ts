import { describe, expect, it } from "vitest";
import { edgeScrollSpeed } from "./drag-to-move";

describe("edgeScrollSpeed", () => {
  it("does not scroll in the middle of the screen", () => {
    expect(edgeScrollSpeed(400, 812, 64)).toBe(0);
  });
  it("scrolls up near the top and down near the navigation bar, faster closer to the edge", () => {
    expect(edgeScrollSpeed(70, 812, 64)).toBeLessThan(0);
    expect(edgeScrollSpeed(5, 812, 64)).toBeLessThan(edgeScrollSpeed(70, 812, 64));
    expect(edgeScrollSpeed(700, 812, 64)).toBeGreaterThan(0);
    expect(edgeScrollSpeed(740, 812, 64)).toBeGreaterThan(edgeScrollSpeed(700, 812, 64));
  });
});
