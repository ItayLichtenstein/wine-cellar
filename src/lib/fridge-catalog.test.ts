import { describe, expect, it } from "vitest";
import { CATALOG, estimateShelves, type ModelSpec } from "./fridge-catalog";
import { LIMITS, fridgeCapacity } from "./fridge-layout";

const all = CATALOG.flatMap((b) => b.models.map((m) => ({ brand: b.brand, ...m })));

describe("fridge catalog", () => {
  it("every model's layout adds up to exactly its published capacity", () => {
    for (const m of all) {
      expect(fridgeCapacity(estimateShelves(m)), `${m.brand} ${m.model}`).toBe(m.capacity);
    }
  });

  it("every layout fits the limits create_fridge enforces", () => {
    for (const m of all) {
      const shelves = estimateShelves(m);
      expect(shelves.length).toBeLessThanOrEqual(LIMITS.shelves.max);
      for (const s of shelves) {
        expect(s.zones.length).toBeGreaterThanOrEqual(LIMITS.zonesPerShelf.min);
        for (const z of s.zones) {
          expect(z.capacity, `${m.model}`).toBeGreaterThanOrEqual(LIMITS.capacity.min);
          expect(z.capacity, `${m.model}`).toBeLessThanOrEqual(LIMITS.capacity.max);
        }
      }
    }
  });

  it("model names are unique within a brand and sources are https", () => {
    for (const b of CATALOG) {
      const names = b.models.map((m) => m.model);
      expect(new Set(names).size).toBe(names.length);
      for (const m of b.models) expect(m.source).toMatch(/^https:\/\//);
    }
  });
});

describe("estimateShelves", () => {
  const spec = (s: Partial<ModelSpec>): ModelSpec => ({ model: "X", capacity: 0, shelves: 1, source: "https://x", ...s });

  it("7 shelves + bottom, 75 bottles (SU-75B): 9 per shelf in staggered rows, 12 in the bottom", () => {
    const shelves = estimateShelves(spec({ capacity: 75, shelves: 7, bottom: true }));
    expect(shelves).toHaveLength(8);
    expect(shelves[0].zones.map((z) => z.capacity)).toEqual([5, 4]);
    expect(shelves[7].zones.map((z) => [z.kind, z.capacity])).toEqual([
      ["stack", 6],
      ["stack", 6],
    ]);
  });

  it("without a bottom, the lowest shelves take the remainder", () => {
    const shelves = estimateShelves(spec({ capacity: 34, shelves: 6 }));
    expect(shelves.map((s) => s.zones.reduce((n, z) => n + z.capacity, 0))).toEqual([5, 5, 6, 6, 6, 6]);
  });

  it("small shelves stay a single row; standing bottles get their own row", () => {
    const shelves = estimateShelves(spec({ capacity: 12, shelves: 4, standing: 4 }));
    expect(shelves[0].zones).toEqual([{ kind: "row", capacity: 2, label: "שורה" }]);
    expect(shelves.at(-1)?.zones[0]).toMatchObject({ capacity: 4, label: "בקבוקים עומדים" });
  });
});
