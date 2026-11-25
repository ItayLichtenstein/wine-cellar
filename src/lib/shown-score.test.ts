import { describe, expect, it } from "vitest";
import { shownScore } from "./shown-score";

describe("shownScore", () => {
  const wine = { wineId: "w", vintageId: null, score: 3 };
  it("the vintage's score wins over the wine's", () => {
    expect(shownScore([wine, { wineId: "w", vintageId: "v", score: 5 }], "w", "v")).toBe(5);
  });
  it("falls back to the wine's score, not another vintage's", () => {
    expect(shownScore([wine, { wineId: "w", vintageId: "other", score: 5 }], "w", "v")).toBe(3);
  });
  it("averages separate ratings", () => {
    const r = [4, 5, 5].map((score) => ({ wineId: "w", vintageId: "v", score }));
    expect(shownScore(r, "w", "v")).toBe(4.7);
  });
  it("null when the wine is not rated", () => {
    expect(shownScore([wine], "x", null)).toBeNull();
  });
});
