import { describe, expect, it } from "vitest";
import { EMPTY_FILTERS, buildRows, countriesOf, drinkNow, matches, type ListBottle } from "./bottle-list";

const bottle = (b: Partial<ListBottle>): ListBottle => ({
  id: "b",
  status: "stored",
  vintageId: "v",
  winery: "יקב",
  name: "יין",
  type: "red",
  year: 2020,
  country: "",
  kosher: "unknown",
  shape: "standard",
  state: "hold",
  drinkBy: null,
  price: null,
  where: "מדף 1",
  ...b,
});

describe("matches", () => {
  it("free text searches winery, name and country, ignoring case", () => {
    const b = bottle({ winery: "Clos Mogador", country: "ספרד" });
    expect(matches(b, { ...EMPTY_FILTERS, text: "mogador" })).toBe(true);
    expect(matches(b, { ...EMPTY_FILTERS, text: "ספרד" })).toBe(true);
    expect(matches(b, { ...EMPTY_FILTERS, text: "איטליה" })).toBe(false);
  });

  it("a price range hides bottles without a price", () => {
    expect(matches(bottle({ price: null }), { ...EMPTY_FILTERS, priceMax: 200 })).toBe(false);
    expect(matches(bottle({ price: 150 }), { ...EMPTY_FILTERS, priceMin: 100, priceMax: 200 })).toBe(true);
    expect(matches(bottle({ price: 250 }), { ...EMPTY_FILTERS, priceMax: 200 })).toBe(false);
  });

  it("type, state, kosher and shape filters", () => {
    const b = bottle({ type: "white", state: "now", kosher: "yes", shape: "burgundy" });
    expect(matches(b, { ...EMPTY_FILTERS, types: ["red"] })).toBe(false);
    expect(matches(b, { ...EMPTY_FILTERS, types: ["white"], states: ["now"], kosherOnly: true, shape: "burgundy" })).toBe(true);
  });
});

describe("buildRows", () => {
  const list = [
    bottle({ id: "1", vintageId: "a", name: "ב", state: "hold", year: 2019, price: 100 }),
    bottle({ id: "2", vintageId: "a", name: "ב", state: "hold", year: 2019, price: 100 }),
    bottle({ id: "3", vintageId: "c", name: "א", state: "past", year: null, price: null }),
  ];

  it("groups bottles of the same vintage into one row", () => {
    const rows = buildRows(list, EMPTY_FILTERS, "name");
    expect(rows.map((r) => [r.key, r.bottles.length])).toEqual([
      ["c", 1],
      ["a", 2],
    ]);
  });

  it("sorts by ripeness: past the peak first", () => {
    expect(buildRows(list, EMPTY_FILTERS, "state")[0].key).toBe("c");
  });

  it("missing year and price go last", () => {
    expect(buildRows(list, EMPTY_FILTERS, "year").at(-1)?.key).toBe("c");
    expect(buildRows(list, EMPTY_FILTERS, "price").at(-1)?.key).toBe("c");
  });
});

it("countriesOf: distinct and without blanks", () => {
  expect(countriesOf([bottle({ country: "ספרד" }), bottle({ country: "ספרד" }), bottle({ country: "" })])).toEqual(["ספרד"]);
});

describe("drinkNow", () => {
  it("past the peak first, then the earliest last year; skips bottles on their way and calm ones", () => {
    const rows = drinkNow([
      bottle({ id: "1", vintageId: "soon", state: "soon", drinkBy: 2027 }),
      bottle({ id: "2", vintageId: "now-late", state: "now", drinkBy: 2026 }),
      bottle({ id: "3", vintageId: "now-early", state: "now", drinkBy: 2024 }),
      bottle({ id: "4", vintageId: "past", state: "past", drinkBy: 2020 }),
      bottle({ id: "5", vintageId: "transit", state: "past", status: "in_transit" }),
      bottle({ id: "6", vintageId: "hold", state: "hold" }),
    ]);
    expect(rows.map((r) => r.key)).toEqual(["past", "now-early", "now-late"]);
  });
});
