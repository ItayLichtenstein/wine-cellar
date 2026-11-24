import { describe, expect, it } from "vitest";
import { LIMITS, SHELF_PRESETS, clamp, fridgeCapacity, shelfCapacity } from "./fridge-layout";

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
    const stack = SHELF_PRESETS.stack.make(8); // 8
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
