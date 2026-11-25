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
  // A stack is always at least two layers high, so it is modelled as an
  // upper and a lower layer: the card can then say which layer a bottle is in.
  doubleStack: {
    title: "ערימה (שכבה עליונה ותחתונה)",
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

/**
 * Stacks (bottles piled in layers, no numbered places) stay in the data
 * model and the code, but are not offered in the UI for now: users found
 * them unclear next to rows. Flip this to offer them again (a better
 * "pile" look would come with it). Existing stacks still show.
 */
export const STACKS_IN_UI = false;

/** The shelf types a user can pick. */
export const CHOOSABLE_PRESETS = (Object.keys(SHELF_PRESETS) as PresetKey[]).filter(
  (key) => STACKS_IN_UI || SHELF_PRESETS[key].make(1).zones.every((z) => z.kind === "row"),
);

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

/** A zone as it is now, with the slots its bottles occupy. */
export type ExistingZone = { id: string; kind: ZoneKind; capacity: number; bottles: { slot: number | null }[] };

/**
 * How many bottles an edit would move out of the fridge – the warning
 * shown before saving. Mirrors what the database does (update_fridge and
 * the zone triggers): a removed zone or a row↔stack switch sends all its
 * bottles out; a shorter row sends out the bottles past its end; a smaller
 * stack sends out the extra bottles.
 */
export function bottlesLeaving(before: ExistingZone[], after: (Zone & { id?: string })[][]): number {
  const kept = new Map(after.flat().filter((z) => z.id).map((z) => [z.id!, z]));
  let leaving = 0;
  for (const old of before) {
    const now = kept.get(old.id);
    if (!now || now.kind !== old.kind) leaving += old.bottles.length;
    else if (now.kind === "row") leaving += old.bottles.filter((b) => (b.slot ?? 0) > now.capacity).length;
    else leaving += Math.max(0, old.bottles.length - now.capacity);
  }
  return leaving;
}
