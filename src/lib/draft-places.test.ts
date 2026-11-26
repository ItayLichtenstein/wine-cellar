import { describe, expect, it } from "vitest";
import { describeFridges, findBottle, placeText, placesSummary, resolvePlaces } from "./draft-places";
import { parseActionDraft, parseBottleDraft, parsePlace } from "./drafts";

const fridge = {
  name: "מקרר יין",
  shelves: [
    { zones: [{ id: "r1", kind: "row" as const, capacity: 3, label: "שורה", bottles: [{ slot: 2 }] }] },
    { zones: [
      { id: "s1", kind: "stack" as const, capacity: 2, label: "שכבה עליונה", bottles: [{ slot: null }] },
      { id: "s2", kind: "stack" as const, capacity: 3, label: "שכבה תחתונה", bottles: [] },
    ] },
  ],
};

describe("parsePlace", () => {
  it("reads shelf / zone / slot, forgivingly", () => {
    expect(parsePlace({ shelf: "3", row: 2, slot: 4 })).toEqual([{ fridge: "", shelf: 3, zone: 2, slot: 4 }]);
    expect(parsePlace({ shelf: 1 })).toEqual([{ fridge: "", shelf: 1, zone: 1, slot: null }]);
    expect(parsePlace({ zone: 1 })).toEqual([]);
    expect(parsePlace("shelf 3")).toEqual([]);
  });
  it("a draft keeps at most one place per bottle", () => {
    const r = parseBottleDraft({ winery: "Y", name: "F", quantity: 1, places: [{ shelf: 1, slot: 1 }, { shelf: 1, slot: 3 }] }, 2026);
    expect(r.ok && r.draft.places).toHaveLength(1);
  });
});

describe("resolvePlaces", () => {
  it("free row slots resolve; taken or missing ones are skipped", () => {
    const places = [
      { fridge: "", shelf: 1, zone: 1, slot: 1 },
      { fridge: "", shelf: 1, zone: 1, slot: 2 }, // already has a bottle
      { fridge: "", shelf: 9, zone: 1, slot: 1 }, // no such shelf
      { fridge: "", shelf: 1, zone: 1, slot: 7 }, // past the end
    ];
    expect(resolvePlaces([fridge], places)).toEqual([{ zoneId: "r1", slot: 1 }]);
  });
  it("one slot is never given twice in a batch", () => {
    const taken = new Set<string>();
    expect(resolvePlaces([fridge], [{ fridge: "", shelf: 1, zone: 1, slot: 3 }], taken)).toHaveLength(1);
    expect(resolvePlaces([fridge], [{ fridge: "", shelf: 1, zone: 1, slot: 3 }], taken)).toHaveLength(0);
  });
  it("piles fill up to their capacity", () => {
    const p = { fridge: "", shelf: 2, zone: 1, slot: null };
    expect(resolvePlaces([fridge], [p, p, p])).toEqual([{ zoneId: "s1", slot: null }]); // 1 already in, room for 1
  });
});

describe("describeFridges", () => {
  it("numbers shelves and zones like the screen, with free slots", () => {
    const text = describeFridges([fridge]);
    expect(text).toContain('Fridge 1: "מקרר יין"');
    expect(text).toContain("shelf 1 (from the top): zone 1");
    expect(text).toContain("free 1,3");
    expect(text).toContain("1/2 used");
  });
  it("says so when there is no fridge", () => {
    expect(describeFridges([])).toContain("No fridge yet");
  });
});

describe("placesSummary", () => {
  it("groups by shelf", () => {
    const p = (shelf: number, slot: number | null) => ({ fridge: "", shelf, zone: 1, slot });
    expect(placesSummary([p(1, 1), p(1, 2), p(2, null), p(2, null), p(2, null)])).toBe("מדף 1 (מקומות 1, 2) · מדף 2 (3 בקבוקים)");
    expect(placesSummary([p(4, 3)])).toBe("מדף 4 (מקום 3)");
  });
});

describe("parseActionDraft", () => {
  it("drink: the wine, and optional date / notes / score", () => {
    const r = parseActionDraft("drink", { winery: "Yatir", name: "Forest", year: 2019, score: "4.25", date: "2026-11-20", notes: "יפה" });
    expect(r).toEqual({ ok: true, action: { kind: "drink", winery: "Yatir", name: "Forest", year: 2019, at: null, date: "2026-11-20", notes: "יפה", score: 4.3 } });
  });
  it("move needs a destination", () => {
    expect(parseActionDraft("move", { winery: "Y", name: "F" }).ok).toBe(false);
    expect(parseActionDraft("move", { winery: "Y", name: "F", to: { shelf: 2, slot: 1 } }).ok).toBe(true);
  });
});

describe("findBottle", () => {
  const f = {
    name: "מקרר",
    shelves: [
      { zones: [{ id: "z1", kind: "row" as const, capacity: 3, label: "", bottles: [{ slot: 1, id: "a", title: "Yatir – Forest", year: 2019 }, { slot: 3, id: "b", title: "Yatir – Forest", year: 2019 }] }] },
    ],
  };
  const ref = { winery: "yatir", name: "forest", year: 2019, at: null };
  it("finds the wine and says where it is", () => {
    expect(findBottle([f], [], ref)).toEqual({ id: "a", where: "מדף 1, מקום 1" });
  });
  it("uses the place when given", () => {
    expect(findBottle([f], [], { ...ref, at: { fridge: "", shelf: 1, zone: 1, slot: 3 } })?.id).toBe("b");
    expect(findBottle([f], [], { ...ref, at: { fridge: "", shelf: 1, zone: 1, slot: 2 } })).toBeNull();
  });
  it("falls back to bottles outside the fridge; another vintage does not match", () => {
    expect(findBottle([], [{ id: "c", title: "Yatir – Forest", year: 2019 }], ref)).toEqual({ id: "c", where: "מחוץ למקרר" });
    expect(findBottle([f], [], { ...ref, year: 2020 })).toBeNull();
  });
});

describe("placeText", () => {
  it("names the zone from the fridge", () => {
    expect(placeText([fridge], { fridge: "", shelf: 2, zone: 2, slot: null })).toBe("מדף 2, שכבה תחתונה");
    expect(placeText([fridge], { fridge: "", shelf: 1, zone: 1, slot: 3 })).toBe("מדף 1, שורה, מקום 3");
  });
});

describe("placeText in English", () => {
  it("names the shelf, the translated zone and the place", () => {
    const fridges = [{ name: "Main", shelves: [{ zones: [{ id: "z", kind: "row" as const, capacity: 3, label: "קדמי", bottles: [] }] }] }];
    expect(placeText(fridges, { fridge: "", shelf: 1, zone: 1, slot: 2 }, "en")).toBe("Shelf 1, Front, Place 2");
    expect(placeText(fridges, { fridge: "", shelf: 1, zone: 1, slot: 2 })).toBe("מדף 1, קדמי, מקום 2");
  });
});
