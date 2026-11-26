import { describe, expect, it } from "vitest";
import { drinkState } from "./drink-state";
import { fromSharedCellar, type SharedCellarJson } from "./shared-cellar";

const bottle = (over: Partial<SharedCellarJson["bottles"][number]>): SharedCellarJson["bottles"][number] => ({
  id: "b1", status: "stored", zone_id: "z1", slot: 2, shelf: 1, year: 2019,
  drink_from: 2022, drink_to: 2030, peak_from: 2024, peak_to: 2027,
  winery: "Yatir", name: "Forest", type: "red", country: "ישראל", kosher: "yes", shape: "standard", thumb: null, grape: "Cabernet", region: null, alcohol: 14.5, critics: [{ critic: "Parker", score: 93 }], price: null,
  ...over,
});

const json: SharedCellarJson = {
  names: ["רון"],
  hide_prices: true,
  fridges: [{ id: "f1", name: "מקרר", brand: null, model: null, shelves: [{ id: "s1", zones: [{ id: "z1", kind: "row", capacity: 6, label: null }] }] }],
  bottles: [bottle({ thumb: "data:image/webp;base64,AA" }), bottle({ id: "b2", status: "unplaced", zone_id: null, slot: null, shelf: null })],
};

describe("fromSharedCellar", () => {
  const c = fromSharedCellar(json, 2026);

  it("puts stored bottles in their zone, the rest in the loose list", () => {
    expect(c.fridges[0].shelves[0].zones[0].bottles.map((b) => b.id)).toEqual(["b1"]);
    expect(c.loose.map((b) => b.id)).toEqual(["b2"]);
  });

  it("lists every bottle with where it is and its drink state", () => {
    expect(c.bottles.map((b) => b.where)).toEqual(["מדף 1", "מחוץ למקרר"]);
    expect(c.bottles[0].state).toBe(drinkState({ drinkFrom: 2022, drinkTo: 2030, peakFrom: 2024, peakTo: 2027 }, 2026));
    expect(c.bottles[0].drinkBy).toBe(2027);
  });

  it("groups bottles of the same wine and year without exposing vintage ids", () => {
    expect(c.bottles[0].vintageId).toBe(c.bottles[1].vintageId);
  });

  it("shows the guest the label photo, and the wine's name on the slot", () => {
    const placed = c.fridges[0].shelves[0].zones[0].bottles[0];
    expect(placed.thumb).toBe("data:image/webp;base64,AA");
    expect(placed.label).toBe("Forest");
  });

  it("gives the guest's card the wine's public details and drink window", () => {
    const b = c.bottles[0];
    expect([b.grape, b.region, b.alcohol]).toEqual(["Cabernet", "", 14.5]);
    expect(b.critics).toEqual([{ critic: "Parker", score: 93 }]);
    expect([b.drinkFrom, b.drinkTo, b.peakFrom, b.peakTo]).toEqual([2022, 2030, 2024, 2027]);
  });

});
