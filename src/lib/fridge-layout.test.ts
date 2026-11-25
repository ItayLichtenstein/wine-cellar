import { describe, expect, it } from "vitest";
import { staggeredZone } from "@/components/fridge-preview";
import { CHOOSABLE_PRESETS, LIMITS, SHELF_PRESETS, bottlesLeaving, clamp, fridgeCapacity, shelfCapacity } from "./fridge-layout";

describe("shelf presets", () => {
  it("every preset stays within the database limits", () => {
    for (const preset of Object.values(SHELF_PRESETS)) {
      const shelf = preset.make(8);
      expect(shelf.zones.length).toBeGreaterThanOrEqual(LIMITS.zonesPerShelf.min);
      expect(shelf.zones.length).toBeLessThanOrEqual(LIMITS.zonesPerShelf.max);
      for (const zone of shelf.zones) {
        expect(zone.capacity).toBeGreaterThanOrEqual(LIMITS.capacity.min);
        expect(zone.capacity).toBeLessThanOrEqual(LIMITS.capacity.max);
        expect(["row", "stack"]).toContain(zone.kind);
      }
    }
  });

  it("a two-high stack is two stack zones", () => {
    const shelf = SHELF_PRESETS.doubleStack.make(6);
    expect(shelf.zones.map((z) => z.kind)).toEqual(["stack", "stack"]);
  });

  it("stacks-and-row keeps a 2-slot front row", () => {
    const shelf = SHELF_PRESETS.stacksAndRow.make(8);
    expect(shelf.zones.at(-1)).toMatchObject({ kind: "row", capacity: 2 });
  });
});

describe("capacity", () => {
  it("adds up zones and shelves", () => {
    const twoRows = SHELF_PRESETS.twoRows.make(5); // 10
    const stack = SHELF_PRESETS.doubleStack.make(4); // 8
    expect(shelfCapacity(twoRows)).toBe(10);
    expect(fridgeCapacity([twoRows, twoRows, stack])).toBe(28);
  });
});

describe("clamp", () => {
  it.each([
    [5, 1, 10, 5],
    [0, 1, 10, 1],
    [99, 1, 10, 10],
    [3.6, 1, 10, 4],
    [Number.NaN, 1, 10, 1],
  ])("clamp(%d, %d, %d) = %d", (value, min, max, expected) => {
    expect(clamp(value, min, max)).toBe(expected);
  });
});


describe("bottlesLeaving", () => {
  const before = [
    { id: "r", kind: "row" as const, capacity: 5, bottles: [{ slot: 1 }, { slot: 4 }, { slot: 5 }] },
    { id: "s", kind: "stack" as const, capacity: 6, bottles: [{ slot: null }, { slot: null }, { slot: null }] },
  ];
  const row = (capacity: number, id?: string) => ({ id, kind: "row" as const, capacity, label: "" });
  const stack = (capacity: number, id?: string) => ({ id, kind: "stack" as const, capacity, label: "" });

  it("nothing leaves when the zones stay", () => {
    expect(bottlesLeaving(before, [[row(5, "r")], [stack(6, "s")]])).toBe(0);
  });
  it("a shorter row loses the bottles past its end; a smaller stack its extra bottles", () => {
    expect(bottlesLeaving(before, [[row(3, "r")], [stack(2, "s")]])).toBe(3);
  });
  it("a removed zone, or one switched between row and stack, loses all its bottles", () => {
    expect(bottlesLeaving(before, [[stack(5, "r")]])).toBe(6);
  });
});


describe("staggeredZone", () => {
  const row = (capacity: number) => ({ kind: "row", capacity });
  it("shifts the row that is shorter by one", () => {
    expect(staggeredZone([row(5), row(4)])).toBe(1);
    expect(staggeredZone([row(4), row(5)])).toBe(0);
  });
  it("leaves equal rows, single rows and stacks alone", () => {
    expect(staggeredZone([row(5), row(5)])).toBeNull();
    expect(staggeredZone([row(5)])).toBeNull();
    expect(staggeredZone([{ kind: "stack", capacity: 4 }, row(5)])).toBeNull();
    expect(staggeredZone([row(6), row(4)])).toBeNull();
  });
});

describe("CHOOSABLE_PRESETS", () => {
  it("offers only row shelves while stacks are off", () => {
    expect(CHOOSABLE_PRESETS).toEqual(["twoRows", "oneRow"]);
  });
});
