import { describe, expect, it } from "vitest";
import { breakdown, cellarValue, drinkingPace, summaryYears, tasteProfile, yearSummary, type StatBottle } from "./stats";

let n = 0;
const b = (over: Partial<StatBottle>): StatBottle => ({
  id: `b${++n}`, status: "stored", addedOn: "2025-03-01", consumedOn: null, price: 100,
  wineId: "w1", vintageId: "v1", title: "Yatir – Forest", year: 2019, type: "red", country: "ישראל", grape: "Cabernet",
  drinkFrom: null, drinkTo: null, peakFrom: null, peakTo: null,
  ...over,
});

describe("cellarValue", () => {
  it("sums prices of bottles still in the cellar and says how many had a price", () => {
    const v = cellarValue([b({}), b({ price: null }), b({ status: "consumed", consumedOn: "2025-05-01" })]);
    expect(v).toEqual({ value: 100, priced: 1, total: 2 });
  });
});

describe("breakdown", () => {
  it("counts, sorts and folds the tail into אחר", () => {
    const bottles = ["א", "א", "א", "ב", "ב", "ג", "ד"].map((c) => b({ country: c }));
    expect(breakdown(bottles, "country", 3)).toEqual([
      { label: "א", count: 3 },
      { label: "ב", count: 2 },
      { label: "אחר", count: 2 },
    ]);
  });
  it("names an empty value", () => {
    expect(breakdown([b({ grape: "" })], "grape")).toEqual([{ label: "לא ידוע", count: 1 }]);
  });
});

describe("drinkingPace", () => {
  it("has one entry per month, oldest first, including empty months", () => {
    const pace = drinkingPace([b({ status: "consumed", consumedOn: "2026-11-02" }), b({ status: "consumed", consumedOn: "2026-01-15" })], "2026-11-25", 12);
    expect(pace).toHaveLength(12);
    expect(pace[0]).toEqual({ month: "2025-12", count: 0 });
    expect(pace[1]).toEqual({ month: "2026-01", count: 1 });
    expect(pace[11]).toEqual({ month: "2026-11", count: 1 });
  });
});

describe("tasteProfile", () => {
  const bottles = [b({ wineId: "a", type: "red" }), b({ wineId: "c", type: "red" }), b({ wineId: "d", type: "white" })];
  it("averages one score per wine, vintage scores first", () => {
    const ratings = [
      { wineId: "a", vintageId: "x", score: 5 },
      { wineId: "a", vintageId: null, score: 1 }, // ignored: the wine has vintage scores
      { wineId: "c", vintageId: null, score: 4 },
      { wineId: "d", vintageId: null, score: 3 },
    ];
    expect(tasteProfile(bottles, ratings, "type")).toEqual([{ label: "red", average: 4.5, wines: 2 }]); // white has 1 wine < min
  });
});

describe("yearSummary", () => {
  const bottles = [
    b({ addedOn: "2024-06-01", price: 200 }), // owned all year
    b({ addedOn: "2025-02-01", price: 100, status: "consumed", consumedOn: "2025-08-01", vintageId: "v2", title: "Best", year: 2018 }),
    b({ addedOn: "2025-04-01", price: 50, drinkFrom: 2026, vintageId: "v3", title: "Young" }),
  ];
  const s = yearSummary(bottles, [{ wineId: "w1", vintageId: "v2", score: 4.5 }], 2025);
  it("counts what we drank and bought, and what we spent", () => {
    expect([s.drunk, s.bought, s.spent]).toEqual([1, 2, 150]);
  });
  it("values the cellar at the start and the end of the year", () => {
    expect([s.valueStart, s.valueEnd]).toEqual([200, 250]);
  });
  it("finds the best wine and what opens next year", () => {
    expect(s.best).toEqual({ title: "Best", year: 2018, score: 4.5 });
    expect(s.openingNextYear).toEqual([{ title: "Young", year: 2019, count: 1 }]);
  });
});

describe("summaryYears", () => {
  it("lists years with activity, newest first, never the future", () => {
    expect(summaryYears([b({ addedOn: "2023-01-01" }), b({ addedOn: "2027-01-01" })], 2026)).toEqual([2026, 2023]);
  });
});
