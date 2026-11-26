// Cellar statistics, taste profile and the year summary. All pure functions
// over plain rows (spec: computed without AI, at view time), so they are tested.

import { drinkState, type DrinkState } from "./drink-state";

export type StatBottle = {
  id: string;
  status: "stored" | "unplaced" | "in_transit" | "consumed";
  addedOn: string; // YYYY-MM-DD
  consumedOn: string | null;
  price: number | null; // shelf price, else what was paid
  wineId: string;
  vintageId: string;
  title: string; // "יקב – שם"
  year: number | null;
  type: string;
  country: string;
  grape: string;
  drinkFrom: number | null;
  drinkTo: number | null;
  peakFrom: number | null;
  peakTo: number | null;
};

/** The household's shared score of a wine or one vintage of it. */
export type StatRating = { wineId: string; vintageId: string | null; score: number };

export type Slice = { label: string; count: number };

const inCellar = (b: StatBottle) => b.status !== "consumed";

/** Bottles we own at the end of a day (bought by then, not drunk by then). */
function ownedOn(b: StatBottle, day: string): boolean {
  return b.addedOn <= day && (b.consumedOn === null || b.consumedOn > day);
}

export function cellarValue(bottles: StatBottle[]): { value: number; priced: number; total: number } {
  const open = bottles.filter(inCellar);
  const priced = open.filter((b) => b.price !== null);
  return { value: priced.reduce((s, b) => s + (b.price ?? 0), 0), priced: priced.length, total: open.length };
}

/**
 * Counts by a field, biggest first; the tail beyond `top` is folded into "אחר".
 * Bottles with the field empty are left out: "unknown" says nothing about the cellar.
 */
export function breakdown(bottles: StatBottle[], field: "type" | "country" | "grape", top = 6): Slice[] {
  const counts = new Map<string, number>();
  for (const b of bottles.filter(inCellar)) {
    const key = b[field].trim();
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const sorted = [...counts].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  if (sorted.length <= top) return sorted;
  const rest = sorted.slice(top - 1).reduce((s, x) => s + x.count, 0);
  return [...sorted.slice(0, top - 1), { label: "אחר", count: rest }];
}

export function byDrinkState(bottles: StatBottle[], year: number): { state: DrinkState; count: number }[] {
  const counts = new Map<DrinkState, number>();
  for (const b of bottles.filter(inCellar)) {
    const s = drinkState({ drinkFrom: b.drinkFrom, drinkTo: b.drinkTo, peakFrom: b.peakFrom, peakTo: b.peakTo }, year);
    counts.set(s, (counts.get(s) ?? 0) + 1);
  }
  return [...counts].map(([state, count]) => ({ state, count }));
}

/** Bottles drunk per month, the last `months` months up to `today` (oldest first). */
export function drinkingPace(bottles: StatBottle[], today: string, months = 12): { month: string; count: number }[] {
  const [y, m] = today.split("-").map(Number);
  const keys: string[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    keys.push(d.toISOString().slice(0, 7));
  }
  const counts = new Map(keys.map((k) => [k, 0]));
  for (const b of bottles) {
    const k = b.consumedOn?.slice(0, 7);
    if (k && counts.has(k)) counts.set(k, counts.get(k)! + 1);
  }
  return keys.map((month) => ({ month, count: counts.get(month)! }));
}

/**
 * Taste profile: the average score per type / country / grape, from the
 * household's ratings (a vintage score wins over the wine score). Needs at
 * least `min` rated wines in a group, so one bottle does not make a "favorite".
 */
export function tasteProfile(
  bottles: StatBottle[],
  ratings: StatRating[],
  field: "type" | "country" | "grape",
  min = 2,
): { label: string; average: number; wines: number }[] {
  const wineInfo = new Map(bottles.map((b) => [b.wineId, b]));
  // One score per wine: the average of its vintage scores, else its wine score.
  const perWine = new Map<string, number[]>();
  for (const r of ratings.filter((r) => r.vintageId !== null)) perWine.set(r.wineId, [...(perWine.get(r.wineId) ?? []), r.score]);
  for (const r of ratings.filter((r) => r.vintageId === null)) if (!perWine.has(r.wineId)) perWine.set(r.wineId, [r.score]);

  const groups = new Map<string, number[]>();
  for (const [wineId, scores] of perWine) {
    const w = wineInfo.get(wineId);
    const key = w?.[field].trim();
    if (!key) continue;
    groups.set(key, [...(groups.get(key) ?? []), scores.reduce((a, b) => a + b, 0) / scores.length]);
  }
  return [...groups]
    .filter(([, s]) => s.length >= min)
    .map(([label, s]) => ({ label, average: Math.round((s.reduce((a, b) => a + b, 0) / s.length) * 10) / 10, wines: s.length }))
    .sort((a, b) => b.average - a.average || b.wines - a.wines);
}

export type YearSummary = {
  year: number;
  drunk: number;
  bought: number;
  spent: number;
  valueStart: number;
  valueEnd: number;
  best: { title: string; year: number | null; score: number } | null;
  /** Wines whose drinking window (or peak) opens next year. */
  openingNextYear: { title: string; year: number | null; count: number }[];
};

export function yearSummary(bottles: StatBottle[], ratings: StatRating[], year: number): YearSummary {
  const start = `${year - 1}-12-31`;
  const end = `${year}-12-31`;
  const inYear = (d: string | null) => d !== null && d.startsWith(`${year}-`);
  const value = (day: string) => bottles.filter((b) => ownedOn(b, day)).reduce((s, b) => s + (b.price ?? 0), 0);

  const drunk = bottles.filter((b) => inYear(b.consumedOn));
  const bought = bottles.filter((b) => inYear(b.addedOn));

  // Best of the year: the highest-rated vintage among what we drank.
  const score = (b: StatBottle) =>
    ratings.find((r) => r.vintageId === b.vintageId)?.score ?? ratings.find((r) => r.wineId === b.wineId && r.vintageId === null)?.score;
  let best: YearSummary["best"] = null;
  for (const b of drunk) {
    const s = score(b);
    if (s !== undefined && (!best || s > best.score)) best = { title: b.title, year: b.year, score: s };
  }

  const opening = new Map<string, { title: string; year: number | null; count: number }>();
  for (const b of bottles.filter((b) => b.status !== "consumed")) {
    if ((b.peakFrom ?? b.drinkFrom) !== year + 1) continue;
    const o = opening.get(b.vintageId) ?? { title: b.title, year: b.year, count: 0 };
    o.count++;
    opening.set(b.vintageId, o);
  }

  return {
    year,
    drunk: drunk.length,
    bought: bought.length,
    spent: bought.reduce((s, b) => s + (b.price ?? 0), 0),
    valueStart: value(start),
    valueEnd: value(end),
    best,
    openingNextYear: [...opening.values()].sort((a, b) => b.count - a.count),
  };
}

/** Years that have anything to summarize, newest first. */
export function summaryYears(bottles: StatBottle[], thisYear: number): number[] {
  const years = new Set<number>([thisYear]);
  for (const b of bottles) {
    years.add(Number(b.addedOn.slice(0, 4)));
    if (b.consumedOn) years.add(Number(b.consumedOn.slice(0, 4)));
  }
  return [...years].filter((y) => y <= thisYear).sort((a, b) => b - a);
}
