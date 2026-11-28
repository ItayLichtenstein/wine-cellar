// The bottle list: one row per wine + vintage, with filters and sorting.
// Pure functions only (no React, no database), so they are unit-tested.

import { DRINK_STATE_ORDER, type DrinkState } from "./drink-state";
import type { Body } from "./wine-extra";

export type ListBottle = {
  id: string;
  status: "stored" | "unplaced" | "in_transit";
  vintageId: string;
  winery: string;
  name: string;
  type: string;
  year: number | null;
  country: string;
  kosher: "yes" | "no" | "unknown";
  shape: "standard" | "burgundy";
  /** Null when not known (and in a shared cellar, which does not show it). */
  body: Body | null;
  state: DrinkState;
  /** Last good year: end of the peak, or of the window. Null if unknown. */
  drinkBy: number | null;
  /** The shelf price if known, otherwise what was paid. */
  price: number | null;
  /** "מדף 3", "מחוץ למקרר", "בדרך אלינו". */
  where: string;
  /** The user's own note on this bottle; only the AI tools read it. */
  note?: string;
};

/** A row in the list: all bottles of one vintage. */
export type ListRow = {
  key: string;
  bottles: ListBottle[];
  first: ListBottle;
};

export type Filters = {
  text: string;
  types: string[]; // empty = all
  states: DrinkState[]; // empty = all
  kosherOnly: boolean;
  country: string; // "" = all
  shape: "" | "standard" | "burgundy";
  body: "" | Body;
  priceMin: number | null;
  priceMax: number | null;
};

export const EMPTY_FILTERS: Filters = {
  text: "",
  types: [],
  states: [],
  kosherOnly: false,
  country: "",
  shape: "",
  body: "",
  priceMin: null,
  priceMax: null,
};

export type SortKey = "state" | "name" | "year" | "price";

export function matches(b: ListBottle, f: Filters): boolean {
  const text = f.text.trim().toLowerCase();
  if (text && !`${b.winery} ${b.name} ${b.country}`.toLowerCase().includes(text)) return false;
  if (f.types.length && !f.types.includes(b.type)) return false;
  if (f.states.length && !f.states.includes(b.state)) return false;
  if (f.kosherOnly && b.kosher !== "yes") return false;
  if (f.country && b.country !== f.country) return false;
  if (f.shape && b.shape !== f.shape) return false;
  if (f.body && b.body !== f.body) return false;
  // A price filter hides bottles without a price: we can't say they match.
  if (f.priceMin !== null && (b.price === null || b.price < f.priceMin)) return false;
  if (f.priceMax !== null && (b.price === null || b.price > f.priceMax)) return false;
  return true;
}

const byName = (a: ListBottle, b: ListBottle) =>
  a.winery.localeCompare(b.winery, "he") || a.name.localeCompare(b.name, "he") || (a.year ?? 0) - (b.year ?? 0);

/** Missing values (no year, no price) always go last. */
const COMPARE: Record<SortKey, (a: ListBottle, b: ListBottle) => number> = {
  state: (a, b) => DRINK_STATE_ORDER.indexOf(a.state) - DRINK_STATE_ORDER.indexOf(b.state) || byName(a, b),
  name: byName,
  year: (a, b) => (a.year ?? Infinity) - (b.year ?? Infinity) || byName(a, b),
  price: (a, b) => (b.price ?? -Infinity) - (a.price ?? -Infinity) || byName(a, b),
};

/** Filters, groups by vintage and sorts. */
export function buildRows(bottles: ListBottle[], filters: Filters, sort: SortKey): ListRow[] {
  const groups = new Map<string, ListBottle[]>();
  for (const b of bottles) {
    if (!matches(b, filters)) continue;
    const list = groups.get(b.vintageId) ?? [];
    list.push(b);
    groups.set(b.vintageId, list);
  }
  return [...groups.entries()]
    .map(([key, list]) => ({ key, bottles: list, first: list[0] }))
    .sort((a, b) => COMPARE[sort](a.first, b.first));
}

/** Distinct countries, for the country filter. */
export function countriesOf(bottles: ListBottle[]): string[] {
  return [...new Set(bottles.map((b) => b.country).filter(Boolean))].sort((a, b) => a.localeCompare(b, "he"));
}

/** States that mean "open it soon". */
const URGENT: DrinkState[] = ["past", "now", "soon"];

/**
 * "What to drink now": the most urgent vintages we can open tonight
 * (in the fridge or next to it – not bottles still on their way).
 * Past the peak first, then by the last good year.
 */
export function drinkNow(bottles: ListBottle[], count = 3): ListRow[] {
  const urgent = bottles.filter((b) => b.status !== "in_transit" && URGENT.includes(b.state));
  return buildRows(urgent, EMPTY_FILTERS, "state")
    .sort(
      (a, b) =>
        URGENT.indexOf(a.first.state) - URGENT.indexOf(b.first.state) ||
        (a.first.drinkBy ?? Infinity) - (b.first.drinkBy ?? Infinity),
    )
    .slice(0, count);
}
