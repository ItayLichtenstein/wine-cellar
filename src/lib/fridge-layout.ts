// The shape of a fridge layout, as the UI builds it and create_fridge()
// receives it. Pure data and pure functions – no React, no database –
// so it is easy to reason about and to test.

export type ZoneKind = "row" | "stack";

export type Zone = {
  kind: ZoneKind;
  capacity: number;
  label: string;
};

export type Shelf = {
  zones: Zone[];
};

// Limits mirror the database (create_fridge + table checks), so the form
// stops mistakes early. The database still has the final word.
export const LIMITS = {
  shelves: { min: 1, max: 30 },
  zonesPerShelf: { min: 1, max: 6 },
  capacity: { min: 1, max: 50 },
  name: 60,
} as const;

/** Ready-made shelf types. Each one is just a list of zones. */
export const SHELF_PRESETS = {
  twoRows: {
    title: "שורה אחורית וקדמית",
    make: (n: number): Shelf => ({
      zones: [
        { kind: "row", capacity: n, label: "אחורית" },
        { kind: "row", capacity: n, label: "קדמית" },
      ],
    }),
  },
  oneRow: {
    title: "שורה אחת",
    make: (n: number): Shelf => ({ zones: [{ kind: "row", capacity: n, label: "שורה" }] }),
  },
  stack: {
    title: "ערימה",
    make: (n: number): Shelf => ({ zones: [{ kind: "stack", capacity: n, label: "ערימה" }] }),
  },
  doubleStack: {
    title: "ערימה בגובה שני בקבוקים",
    make: (n: number): Shelf => ({
      zones: [
        { kind: "stack", capacity: n, label: "שכבה עליונה" },
        { kind: "stack", capacity: n, label: "שכבה תחתונה" },
      ],
    }),
  },
  stacksAndRow: {
    title: "ערימות מאחור ושורה מקדימה",
    make: (n: number): Shelf => ({
      zones: [
        { kind: "stack", capacity: n, label: "ערימה ימנית" },
        { kind: "stack", capacity: n, label: "ערימה שמאלית" },
        { kind: "row", capacity: 2, label: "קדמית" },
      ],
    }),
  },
} as const;

export type PresetKey = keyof typeof SHELF_PRESETS;

/** Total bottles a shelf (or fridge) can hold. */
export function shelfCapacity(shelf: Shelf): number {
  return shelf.zones.reduce((sum, z) => sum + z.capacity, 0);
}

export function fridgeCapacity(shelves: Shelf[]): number {
  return shelves.reduce((sum, s) => sum + shelfCapacity(s), 0);
}

/** Keeps a number inside [min, max]; NaN becomes min. */
export function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}
