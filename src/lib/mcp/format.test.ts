import { describe, expect, it } from "vitest";
import type { ListBottle, ListRow } from "../bottle-list";
import { formatHistory, formatRows } from "./format";

const bottle = (over: Partial<ListBottle> = {}): ListBottle => ({
  id: "b", status: "stored", vintageId: "v", winery: "Yatir", name: "Forest", type: "red", year: 2019,
  country: "ישראל", kosher: "yes", shape: "standard", state: "now", drinkBy: 2027, price: 180, where: "מדף 3",
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
  it("caps long answers and says how many were left out", () => {
    const out = formatRows(Array.from({ length: 5 }, () => row(1)), 2);
    expect(out.split("\n")).toHaveLength(3);
    expect(out).toContain("3 more");
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
