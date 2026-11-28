import { describe, expect, it } from "vitest";
import { applyFridgeEdit, buildNewFridge, fridgeJson } from "./fridge-edit";

const fridge = {
  name: "Kitchen",
  shelves: [
    { id: "s1", zones: [{ id: "z1", kind: "row" as const, capacity: 5, label: "אחורי", bottles: [{ slot: 5 }] }] },
    { id: "s2", zones: [{ id: "z2", kind: "row" as const, capacity: 4, label: "שורה", bottles: [] }] },
  ],
};

describe("applyFridgeEdit", () => {
  it("adds a slot to a zone and keeps every id, so bottles stay", () => {
    const r = applyFridgeEdit(fridge, { resize: [{ shelf: 2, capacity: 5 }] });
    expect(r.ok && r.shelves).toEqual([
      { id: "s1", zones: [{ id: "z1", kind: "row", capacity: 5, label: "אחורי" }] },
      { id: "s2", zones: [{ id: "z2", kind: "row", capacity: 5, label: "שורה" }] },
    ]);
  });
  it("refuses a change that pushes bottles out of the fridge", () => {
    const r = applyFridgeEdit(fridge, { resize: [{ shelf: 1, capacity: 4 }] });
    expect(r).toMatchObject({ ok: false });
    expect(!r.ok && r.error).toContain("1 bottle");
  });
  it("removes only empty shelves and adds new ones at the bottom", () => {
    expect(applyFridgeEdit(fridge, { remove_shelves: [1] })).toMatchObject({ ok: false });
    const r = applyFridgeEdit(fridge, { remove_shelves: [2], add_shelves: [{ arrangement: "twoRows", size: 6 }] });
    expect(r.ok && r.shelves.map((s) => s.id ?? "new")).toEqual(["s1", "new"]);
    expect(r.ok && r.shelves[1].zones.map((z) => z.capacity)).toEqual([6, 6]);
  });
  it("names a missing zone, and refuses doing nothing", () => {
    expect(applyFridgeEdit(fridge, { resize: [{ shelf: 9, capacity: 3 }] })).toMatchObject({ ok: false });
    expect(applyFridgeEdit(fridge, {})).toMatchObject({ ok: false, error: "nothing to change" });
  });
  it("keeps the layout as it was, for the undo", () => {
    expect(fridgeJson(fridge)[0]).toEqual({ id: "s1", zones: [{ id: "z1", kind: "row", capacity: 5, label: "אחורי" }] });
  });
});

describe("buildNewFridge", () => {
  const catalog = [{ brand: "לנדרס", models: [{ model: "JC43", capacity: 15, shelves: 5, source: "" }] }];
  it("builds the shelves the AI counted, top first", () => {
    const r = buildNewFridge({ name: " Kitchen ", shelves: [{ arrangement: "twoRows", size: 6 }, { arrangement: "doubleStack", size: 4 }] }, catalog, []);
    expect(r.ok && r.name).toBe("Kitchen");
    expect(r.ok && r.shelves.map((s) => s.zones.map((z) => z.capacity))).toEqual([[6, 6], [3, 4]]);
    expect(r.ok && r.summary).toContain("2 shelves, 19 bottles");
  });
  it("a known model gets the site's layout, under the brand's name in the app", () => {
    const r = buildNewFridge({ name: "Salon", brand: "Landers", model: "jc-43" }, catalog, []);
    expect(r).toMatchObject({ ok: true, brand: "לנדרס", model: "jc-43", fromCatalog: true });
    expect(r.ok && r.shelves.flatMap((s) => s.zones).reduce((n, z) => n + z.capacity, 0)).toBe(15);
  });
  it("an unknown model needs the shelves", () => {
    const r = buildNewFridge({ name: "Salon", brand: "Acme", model: "X1" }, catalog, []);
    expect(!r.ok && r.error).toContain("not in the app's model list");
  });
  it("a cabinet has no brand, and a name already used is refused", () => {
    const r = buildNewFridge({ name: "Rack", kind: "cabinet", brand: "Landers", shelves: [{ arrangement: "oneRow", size: 5 }] }, catalog, []);
    expect(r).toMatchObject({ ok: true, kind: "cabinet", brand: null, model: null });
    expect(buildNewFridge({ name: "kitchen", shelves: [{ arrangement: "oneRow", size: 5 }] }, catalog, ["Kitchen"])).toMatchObject({ ok: false });
  });
});

describe("front rows", () => {
  it("adds bottles lying across the front of a new shelf, as its last zone", () => {
    const r = buildNewFridge({ name: "Salon", shelves: [{ arrangement: "doubleStack", size: 7, front: 2 }] }, [], []);
    expect(r.ok && r.shelves[0].zones.map((z) => [z.kind, z.capacity, z.label])).toEqual([
      ["stack", 6, "שכבה עליונה"],
      ["stack", 7, "שכבה תחתונה"],
      ["row", 2, "בחזית"],
    ]);
  });
  it("adds, resizes and removes the front row of an existing shelf, keeping ids", () => {
    const added = applyFridgeEdit(fridge, { front: [{ shelf: 2, bottles: 2 }] });
    expect(added.ok && added.shelves[1].zones).toEqual([
      { id: "z2", kind: "row", capacity: 4, label: "שורה" },
      { kind: "row", capacity: 2, label: "בחזית" },
    ]);
    const withFront = {
      ...fridge,
      shelves: [fridge.shelves[0], { id: "s2", zones: [...fridge.shelves[1].zones, { id: "f", kind: "row" as const, capacity: 2, label: "בחזית", bottles: [] }] }],
    };
    expect(applyFridgeEdit(withFront, { front: [{ shelf: 2, bottles: 3 }] })).toMatchObject({ ok: true, summary: ["shelf 2 front row: 2 → 3 bottles"] });
    const removed = applyFridgeEdit(withFront, { front: [{ shelf: 2, bottles: 0 }] });
    expect(removed.ok && removed.shelves[1].zones.map((z) => z.id)).toEqual(["z2"]);
  });
  it("fills in the brand and model later", () => {
    const r = applyFridgeEdit({ ...fridge, brand: "Landers", model: null }, { model: "JC-43" });
    expect(r).toMatchObject({ ok: true, brand: "Landers", model: "JC-43", summary: ["model: Landers JC-43"] });
  });
});
