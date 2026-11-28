import { describe, expect, it } from "vitest";
import type { ListBottle, ListRow } from "../bottle-list";
import { formatHistory, formatRows, formatWineDetails, reportGaps, optionalLeft } from "./format";

const bottle = (over: Partial<ListBottle> = {}): ListBottle => ({
  id: "b", status: "stored", vintageId: "v", winery: "Yatir", name: "Forest", type: "red", year: 2019,
  country: "ישראל", kosher: "yes", shape: "standard", body: null, state: "now", drinkBy: 2027, price: 180, where: "מדף 3",
  ...over,
});
const row = (n: number, over: Partial<ListBottle> = {}): ListRow => {
  const bottles = Array.from({ length: n }, () => bottle(over));
  return { key: "k", bottles, first: bottles[0] };
};

describe("formatRows", () => {
  it("one short line per vintage, with count, readiness, place and price", () => {
    expect(formatRows([row(2)])).toBe("- Yatir – Forest 2019 ×2 · red · at its peak · drink by 2027 · מדף 3 · ₪180");
  });
  it("skips what is unknown and writes NV", () => {
    expect(formatRows([row(1, { year: null, drinkBy: null, price: null, state: "none" })])).toBe(
      "- Yatir – Forest NV · red · no drinking window recorded · מדף 3",
    );
  });
  it("shows a note shared by the whole vintage once", () => {
    expect(formatRows([row(2, { note: "מתנה מדן" })])).toContain(' · note: "מתנה מדן"');
  });
  it("a note on only some bottles says where that bottle is", () => {
    const bottles = [bottle({ id: "1", note: "מחיר רגיל באתר" }), bottle({ id: "2" })];
    const out = formatRows([{ key: "k", bottles, first: bottles[0] }], 40, new Map([["1", "shelf 2 slot 4"], ["2", "shelf 2 slot 5"]]));
    expect(out).toContain('note (shelf 2 slot 4): "מחיר רגיל באתר"');
    expect(out.match(/note/g)).toHaveLength(1);
  });
  it("caps long answers and says how many were left out", () => {
    const out = formatRows(Array.from({ length: 5 }, () => row(1)), 2);
    expect(out.split("\n")).toHaveLength(3);
    expect(out).toContain("3 more");
  });
  it("with exact places, lists where every bottle is", () => {
    const bottles = [bottle({ id: "1" }), bottle({ id: "2" }), bottle({ id: "3" }), bottle({ id: "4", status: "unplaced" })];
    const places = new Map([["1", "shelf 1 slot 2"], ["2", "shelf 3 slot 1"], ["3", "shelf 3 slot 1"]]);
    expect(formatRows([{ key: "k", bottles, first: bottles[0] }], 40, places)).toContain("shelf 1 slot 2; shelf 3 slot 1 (×2); outside the fridge");
  });
  it("says so when nothing matches", () => {
    expect(formatRows([])).toBe("No bottles match.");
  });
});

describe("formatHistory", () => {
  it("date, wine, place and notes", () => {
    const h = [{ id: "t", tastedOn: "2026-01-02", wineId: "w", title: "Yatir – Forest", year: 2019, place: "מסעדה", notes: "great", score: 4.5 }];
    expect(formatHistory(h, 10)).toBe("- 2026-01-02: Yatir – Forest 2019 (מסעדה) · rated 4.5/5 – great");
  });
});

describe("formatWineDetails", () => {
  const h = [{ id: "t", tastedOn: "2026-01-02", wineId: "w", title: "Yatir – Forest", year: 2018, place: "", notes: "great", score: 4.5 }];
  it("the cellar's vintages and the history of the same wine", () => {
    const out = formatWineDetails([row(2)], h, "forest");
    expect(out).toContain("In the cellar:");
    expect(out).toContain("Drunk before:");
    expect(out).toContain("great");
  });
  it("says so when nothing matches", () => {
    expect(formatWineDetails([], h, "barolo")).toContain("Nothing in the cellar");
  });
});

describe("body", () => {
  it("shows the body in the rows the AI reads", () => {
    expect(formatRows([row(1, { body: "medium_full" })])).toContain("medium-full body");
  });
});

describe("reportGaps", () => {
  const full = { winery: "Galil", name: "Alon", price: 65, grape: "Cabernet", body: "full", country: "Israel", region: "", drinkFrom: 2024, drinkTo: 2028, image: "c/web-1.webp", kosher: "yes", alcohol: 14 };

  it("says nothing is empty for a complete bottle", () => {
    const out = reportGaps([full]);
    expect(out.some((l) => l.includes("still empty"))).toBe(false);
    expect(out.join(" ")).toContain("everything was filled in");
  });

  it("lists each empty detail and a missing photo", () => {
    const out = reportGaps([{ ...full, price: null, drinkFrom: null, drinkTo: null, image: "", country: "", grape: "", body: null, kosher: undefined, alcohol: undefined }]);
    expect(out[0]).toBe("Galil – Alon: still empty – drinking window, price, grape, body, country/region, kosher, alcohol %, label photo.");
    expect(out.join(" ")).toContain("estimates");
  });

  it("counts a window with only one end as filled", () => {
    expect(reportGaps([{ ...full, drinkFrom: null }])[0]).not.toContain("drinking window");
  });
});

describe("optionalLeft", () => {
  it("names what is still empty, and says nothing when all is filled", () => {
    expect(optionalLeft("Kitchen", ["model"])).toContain("Kitchen: optional and still empty – model.");
    expect(optionalLeft("Kitchen", [])).toBe("");
  });
});
