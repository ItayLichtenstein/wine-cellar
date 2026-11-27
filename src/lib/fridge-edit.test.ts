import { describe, expect, it } from "vitest";
import { applyFridgeEdit, fridgeJson } from "./fridge-edit";

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
