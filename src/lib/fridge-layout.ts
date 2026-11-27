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
    title: "שתי שורות",
    make: (n: number): Shelf => ({
      zones: [
        { kind: "row", capacity: n, label: "אחורי" },
        { kind: "row", capacity: n, label: "קדמי" },
      ],
    }),
  },
  oneRow: {
    title: "שורה אחת",
    make: (n: number): Shelf => ({ zones: [{ kind: "row", capacity: n, label: "שורה" }] }),
  },
  // A pile: bottles lie on top of each other, the upper layer in the
  // grooves of the lower one (so it holds one bottle less). No numbered
  // places – a bottle is just "in the upper layer".
  doubleStack: {
    title: "ערימה",
    make: (n: number): Shelf => ({
      zones: [
        { kind: "stack", capacity: Math.max(1, n - 1), label: "שכבה עליונה" },
        { kind: "stack", capacity: n, label: "שכבה תחתונה" },
      ],
    }),
  },
  // Two piles, one behind the other (deep shelves): each is a pile with
  // two layers like the one above, so four zones, back pile first.
  twoStacks: {
    title: "שתי ערימות",
    make: (n: number): Shelf => ({
      zones: [
        { kind: "stack", capacity: Math.max(1, n - 1), label: "אחורית עליונה" },
        { kind: "stack", capacity: n, label: "אחורית תחתונה" },
        { kind: "stack", capacity: Math.max(1, n - 1), label: "קדמית עליונה" },
        { kind: "stack", capacity: n, label: "קדמית תחתונה" },
      ],
    }),
  },
  stacksAndRow: {
    title: "ערימות מאחור ושורה מקדימה",
    make: (n: number): Shelf => ({
      zones: [
        { kind: "stack", capacity: n, label: "ערימה ימנית" },
        { kind: "stack", capacity: n, label: "ערימה שמאלית" },
        { kind: "row", capacity: 2, label: "קדמי" },
      ],
    }),
  },
} as const;

export type PresetKey = keyof typeof SHELF_PRESETS;

/**
 * The shelf types a user can pick. "Stacks at the back and a row in front"
 * stays in the code (existing shelves still show) but is not offered:
 * a pile and plain rows cover real fridges more clearly.
 */
export const CHOOSABLE_PRESETS: PresetKey[] = ["twoRows", "oneRow", "doubleStack", "twoStacks"];

/**
 * Some shelves have room for a few more bottles lying across the front.
 * That is an extra row added to any shelf (not part of a preset), always
 * the last zone, so it survives a change of the shelf's arrangement.
 */
export const FRONT_LABEL = "בחזית";

export function frontZone<Z extends Zone>(zones: Z[]): Z | undefined {
  const last = zones.at(-1);
  return zones.length > 1 && last?.kind === "row" && last.label === FRONT_LABEL ? last : undefined;
}

/** The shelf's zones without the front row. */
export function withoutFront<Z extends Zone>(zones: Z[]): Z[] {
  return frontZone(zones) ? zones.slice(0, -1) : zones;
}

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
