import { describe, expect, it } from "vitest";
import type { FridgeView, PlacedBottle } from "./fridges";
import { applyMove } from "./optimistic-move";

const b = (id: string, slot: number | null): PlacedBottle => ({ id, slot, year: 2020, state: "now", title: id, label: id, thumb: null });
const fridge = (zones: { id: string; bottles: PlacedBottle[] }[]): FridgeView[] => [
  { id: "f", name: "F", brand: null, model: null, kind: "fridge", shelves: [{ id: "s", zones: zones.map((z) => ({ ...z, kind: "row", capacity: 4, label: "" })) }] },
];
const where = (fs: FridgeView[]) =>
  Object.fromEntries(fs[0].shelves[0].zones.flatMap((z) => z.bottles.map((x) => [x.id, `${z.id}:${x.slot}`])));

describe("applyMove", () => {
  it("moves a bottle to an empty slot, in the same zone or another", () => {
    const fs = fridge([{ id: "z1", bottles: [b("a", 1)] }, { id: "z2", bottles: [] }]);
    expect(where(applyMove(fs, "a", { zoneId: "z1", slot: 3 }))).toEqual({ a: "z1:3" });
    expect(where(applyMove(fs, "a", { zoneId: "z2", slot: 2 }))).toEqual({ a: "z2:2" });
  });

  it("swaps with the bottle already there, like the database", () => {
    const fs = fridge([{ id: "z1", bottles: [b("a", 1), b("c", 4)] }, { id: "z2", bottles: [b("b", 2)] }]);
    expect(where(applyMove(fs, "a", { zoneId: "z2", slot: 2 }))).toEqual({ a: "z2:2", b: "z1:1", c: "z1:4" });
    expect(where(applyMove(fs, "a", { zoneId: "z1", slot: 4 }))).toEqual({ a: "z1:4", b: "z2:2", c: "z1:1" });
  });

  it("puts a bottle on a pile, and leaves unknown bottles to the refresh", () => {
    const fs = fridge([{ id: "z1", bottles: [b("a", 1)] }, { id: "z2", bottles: [b("p", null)] }]);
    expect(where(applyMove(fs, "a", { zoneId: "z2", slot: null }))).toEqual({ a: "z2:null", p: "z2:null" });
    expect(applyMove(fs, "nope", { zoneId: "z2", slot: 1 })).toBe(fs);
  });
});
