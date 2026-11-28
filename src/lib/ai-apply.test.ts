import { describe, expect, it } from "vitest";
import { draftDetails } from "./ai-apply";
import type { BottleDraft } from "./drafts";

const d: BottleDraft = {
  winery: "W", name: "N", type: "red", year: 2020, quantity: 1, price: null, grape: "Syrah", body: "full",
  country: "Israel", region: "", drinkFrom: null, drinkTo: null, note: "a gift", places: [], image: "",
  kosher: "yes", alcohol: 14, peakFrom: 2026,
};

describe("draftDetails", () => {
  it("sends the wine's details only for a wine new to the cellar, and the rest always", () => {
    expect(draftDetails(d, true)).toEqual({ grape: "Syrah", country: "Israel", body: "full", kosher: "yes", peak_from: 2026, alcohol: 14, note: "a gift" });
    expect(draftDetails(d, false)).toEqual({ peak_from: 2026, alcohol: 14, note: "a gift" });
  });
});
