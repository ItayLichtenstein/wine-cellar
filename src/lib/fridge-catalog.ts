// Catalog of wine-fridge models sold in Israel, used to pre-fill the
// "new fridge" form. See docs/decisions/0007-fridge-catalog-in-code.md.
//
// Manufacturers publish the bottle capacity and sometimes the number of
// shelves, but not how many bottles sit on each shelf. So each model keeps
// only the published facts (plus the source page), and estimateShelves()
// turns them into a layout that adds up to exactly the published capacity.
// The user then adjusts it to the real fridge.

import type { Shelf } from "./fridge-layout";

export type ModelSpec = {
  model: string;
  /** Total bottles, as published. */
  capacity: number;
  /** Pull-out / lying shelves. Published, or estimated (see `note`). */
  shelves: number;
  /** A bottom area where bottles are stacked (fixed bottom shelf / storage space). */
  bottom?: boolean;
  /** Bottles standing upright (open bottles / label display), as published. */
  standing?: number;
  /** Product page the facts come from. */
  source: string;
  /** Anything that is not straight from the source page. */
  note?: string;
};

export type Brand = { brand: string; models: ModelSpec[] };

/** Bottles a shelf needs before it is split into a back and a front row. */
const TWO_ROWS_FROM = 5;
/** Share of the capacity first set aside for the bottom area. */
const BOTTOM_SHARE = 0.15;

/**
 * Builds a starting layout from a model's published numbers.
 * Rules (calibrated on product photos):
 * - With a bottom area: about 15% of the bottles go there, the rest are
 *   spread evenly over the shelves, and the bottom takes whatever is left.
 * - Without one: bottles are spread evenly; the lowest shelves take the
 *   remainder, one extra each.
 * - A shelf of 5+ bottles has two staggered rows: back n, front n−1
 *   (bottles lie head to tail, so the front row has one less).
 * - Standing bottles get their own row at the bottom.
 * The total always equals the published capacity.
 */
export function estimateShelves(spec: ModelSpec): Shelf[] {
  const lying = spec.capacity - (spec.standing ?? 0);
  let perShelf: number;
  let bottom = 0;
  let extra = 0;

  if (spec.bottom) {
    const rest = lying - Math.round(lying * BOTTOM_SHARE);
    perShelf = Math.max(1, Math.round(rest / spec.shelves));
    if (lying - perShelf * spec.shelves < 2) perShelf -= 1; // keep at least 2 in the bottom
    bottom = lying - perShelf * spec.shelves;
  } else {
    perShelf = Math.floor(lying / spec.shelves);
    extra = lying - perShelf * spec.shelves;
  }

  const shelves: Shelf[] = Array.from({ length: spec.shelves }, (_, i) => {
    const n = perShelf + (i >= spec.shelves - extra ? 1 : 0);
    return lyingShelf(n);
  });

  if (bottom > 0) {
    // A pile: the upper layer rests in the grooves of the lower one.
    shelves.push({
      zones: [
        { kind: "stack", capacity: Math.floor(bottom / 2), label: "שכבה עליונה" },
        { kind: "stack", capacity: Math.ceil(bottom / 2), label: "שכבה תחתונה" },
      ].filter((z) => z.capacity > 0) as Shelf["zones"],
    });
  }
  if (spec.standing) {
    shelves.push({ zones: [{ kind: "row", capacity: spec.standing, label: "בקבוקים עומדים" }] });
  }
  return shelves;
}

/** A brand's models grouped by bottle count, smallest first: the second step of the picker. */
export function capacityGroups(brand: string): { capacity: number; models: ModelSpec[] }[] {
  const models = CATALOG.find((b) => b.brand === brand)?.models ?? [];
  const groups = new Map<number, ModelSpec[]>();
  for (const m of models) groups.set(m.capacity, [...(groups.get(m.capacity) ?? []), m]);
  return [...groups].sort(([a], [b]) => a - b).map(([capacity, models]) => ({ capacity, models }));
}

function lyingShelf(n: number): Shelf {
  if (n < TWO_ROWS_FROM) return { zones: [{ kind: "row", capacity: n, label: "שורה" }] };
  return {
    zones: [
      { kind: "row", capacity: Math.ceil(n / 2), label: "אחורי" },
      { kind: "row", capacity: Math.floor(n / 2), label: "קדמי" },
    ],
  };
}

// ---------------------------------------------------------------------
// Data. Landers and Vinopo collected on 2026-11-25 from the manufacturers'
// sites; Haier, Caso and WineBar on 2026-11-26 from the importer (Newpan),
// the maker (caso-design.de) and the retailer (Bug).
// "same body as X": identical outer dimensions to a model whose shelf
// count IS published, so that count is used.
// ---------------------------------------------------------------------

const L = "https://www.landers.co.il/product/";
const V = "https://www.vinopo.co.il/product/";
const BY_HEIGHT = "מספר המדפים הוערך לפי הגובה הפנימי";
const NP = "https://www.newpan.co.il/product/index/";
const B = "https://www.bug.co.il/";
const CASO = "https://caso-design.de/de/p/";
const BOTTOM_GUESS = "האזור התחתון הוערך: הקיבולת גדולה ממה שנכנס במדפים";

export const CATALOG: Brand[] = [
  {
    brand: "לנדרס",
    models: [
      { model: "LA07WS", capacity: 7, shelves: 7, source: `${L}%d7%9e%d7%a7%d7%a8%d7%a8-%d7%99%d7%99%d7%9f-%d7%91%d7%a0%d7%95%d7%99-%d7%9c-7-%d7%91%d7%a7%d7%91%d7%95%d7%a7%d7%99%d7%9d/`, note: BY_HEIGHT },
      { model: "BCW26A", capacity: 8, shelves: 2, standing: 4, source: `${L}%d7%9e%d7%a7%d7%a8%d7%a8-%d7%99%d7%99%d7%9f-%d7%9c-8-%d7%91%d7%a7%d7%91%d7%95%d7%a7%d7%99%d7%9d/`, note: BY_HEIGHT },
      { model: "BCHW69", capacity: 8, shelves: 2, source: `${L}%d7%9e%d7%a7%d7%a8%d7%a8-%d7%9e%d7%a9%d7%95%d7%9c%d7%91-%d7%99%d7%99%d7%9f/`, note: BY_HEIGHT },
      { model: "BCW35", capacity: 12, shelves: 4, standing: 4, source: `${L}%d7%9e%d7%a7%d7%a8%d7%a8-%d7%99%d7%99%d7%9f-12-%d7%91%d7%a7%d7%91%d7%95%d7%a7%d7%99%d7%9d/`, note: BY_HEIGHT },
      { model: "JC34", capacity: 12, shelves: 6, source: `${L}%d7%9e%d7%a7%d7%a8%d7%a8-%d7%99%d7%99%d7%9f-%d7%a6%d7%a8-%d7%91%d7%9e%d7%99%d7%95%d7%97%d7%93-%d7%9c-12-%d7%91%d7%a7%d7%91%d7%95%d7%a7%d7%99%d7%9d-%d7%a2%d7%9d-%d7%9e%d7%93%d7%97%d7%a1/`, note: BY_HEIGHT },
      { model: "JC34W", capacity: 12, shelves: 6, source: `${L}%d7%9e%d7%a7%d7%a8%d7%a8-%d7%99%d7%99%d7%9f-%d7%a6%d7%a8-%d7%91%d7%9e%d7%99%d7%95%d7%97%d7%93-%d7%9c-12-%d7%91%d7%a7%d7%91%d7%95%d7%a7%d7%99%d7%9d-%d7%a2%d7%9d-%d7%9e%d7%93%d7%97%d7%a1-%d7%95%d7%9e/`, note: BY_HEIGHT },
      { model: "JC68", capacity: 12, shelves: 4, source: `${L}%d7%9e%d7%a7%d7%a8%d7%a8-%d7%a9%d7%a0%d7%99-%d7%90%d7%96%d7%95%d7%a8%d7%99-%d7%a7%d7%a8%d7%95%d7%a8-%d7%9c%d7%99%d7%99%d7%9f-%d7%95%d7%9c%d7%9e%d7%a9%d7%a7%d7%90%d7%95%d7%aa/`, note: `צד היין בלבד. ${BY_HEIGHT}` },
      { model: "SC46RW", capacity: 12, shelves: 2, standing: 4, source: `${L}%d7%9e%d7%a7%d7%a8%d7%a8-%d7%99%d7%99%d7%9f-%d7%a8%d7%98%d7%a8%d7%95-12-%d7%91%d7%a7%d7%91%d7%95%d7%a7%d7%99%d7%9d/`, note: BY_HEIGHT },
      { model: "JC40", capacity: 14, shelves: 7, source: `${L}%d7%9e%d7%a7%d7%a8%d7%a8-%d7%99%d7%99%d7%9f-%d7%9c-14-%d7%91%d7%a7%d7%91%d7%95%d7%a7%d7%99%d7%9d-%d7%a2%d7%9d-%d7%9e%d7%93%d7%97%d7%a1-%d7%a6%d7%a8-%d7%91%d7%9e%d7%99%d7%95%d7%97%d7%93/`, note: BY_HEIGHT },
      { model: "JC43", capacity: 15, shelves: 5, source: `${L}%d7%9e%d7%a7%d7%a8%d7%a8-%d7%99%d7%99%d7%9f-%d7%9c-15-%d7%91%d7%a7%d7%91%d7%95%d7%a7%d7%99%d7%9d-%d7%a2%d7%9d-%d7%9e%d7%93%d7%97%d7%a1/`, note: BY_HEIGHT },
      { model: "JC43W", capacity: 15, shelves: 5, source: `${L}%d7%9e%d7%a7%d7%a8%d7%a8-%d7%99%d7%99%d7%9f-%d7%9c-15-%d7%91%d7%a7%d7%91%d7%95%d7%a7%d7%99%d7%9d-%d7%a2%d7%9d-%d7%9e%d7%93%d7%97%d7%a1-%d7%95%d7%9e%d7%93%d7%a4%d7%99-%d7%a2%d7%a5/`, note: BY_HEIGHT },
      { model: "SC70RW", capacity: 16, shelves: 4, source: `${L}%d7%9e%d7%a7%d7%a8%d7%a8-%d7%99%d7%99%d7%9f-%d7%a8%d7%98%d7%a8%d7%95-16-%d7%91%d7%a7%d7%91%d7%95%d7%a7%d7%99%d7%9d/`, note: BY_HEIGHT },
      { model: "BCW51B", capacity: 18, shelves: 6, source: `${L}%d7%9e%d7%a7%d7%a8%d7%a8-%d7%99%d7%99%d7%9f-%d7%9c%d7%90%d7%97%d7%a1%d7%95%d7%9f-18-%d7%91%d7%a7%d7%91%d7%95%d7%a7%d7%99%d7%9d/`, note: BY_HEIGHT },
      { model: "JC53", capacity: 18, shelves: 5, standing: 3, source: `${L}%d7%9e%d7%a7%d7%a8%d7%a8-%d7%99%d7%99%d7%9f-%d7%9c-18-%d7%91%d7%a7%d7%91%d7%95%d7%a7%d7%99%d7%9d-%d7%a2%d7%9d-%d7%9e%d7%93%d7%97%d7%a1/`, note: "אותו גוף כמו וינופו CH-53FD" },
      { model: "JC53W", capacity: 18, shelves: 5, standing: 3, source: `${L}%d7%9e%d7%a7%d7%a8%d7%a8-%d7%99%d7%99%d7%9f-%d7%9c-18-%d7%91%d7%a7%d7%91%d7%95%d7%a7%d7%99%d7%9d-%d7%a2%d7%9d-%d7%9e%d7%93%d7%97%d7%a1-%d7%95%d7%9e%d7%93%d7%a4%d7%99-%d7%a2%d7%a5/`, note: "אותו גוף כמו וינופו CH-53FD" },
      { model: "JC50", capacity: 19, shelves: 4, source: `${L}%d7%9e%d7%a7%d7%a8%d7%a8-%d7%99%d7%99%d7%9f-%d7%9c-19-%d7%91%d7%a7%d7%91%d7%95%d7%a7%d7%99%d7%9d-%d7%a2%d7%9d-%d7%9e%d7%93%d7%97%d7%a1/`, note: BY_HEIGHT },
      { model: "JC70", capacity: 24, shelves: 6, source: `${L}%d7%9e%d7%a7%d7%a8%d7%a8-%d7%99%d7%99%d7%9f-%d7%9c-24-%d7%91%d7%a7%d7%91%d7%95%d7%a7%d7%99%d7%9d-%d7%a2%d7%9d-%d7%9e%d7%93%d7%97%d7%a1/`, note: "אותו גוף כמו וינופו CH-70CC" },
      { model: "JC70W", capacity: 24, shelves: 6, source: `${L}%d7%9e%d7%a7%d7%a8%d7%a8-%d7%99%d7%99%d7%9f-%d7%9c-24-%d7%91%d7%a7%d7%91%d7%95%d7%a7%d7%99%d7%9d-%d7%a2%d7%9d-%d7%9e%d7%93%d7%97%d7%a1-%d7%95%d7%9e%d7%93%d7%a4%d7%99-%d7%a2%d7%a5/`, note: "אותו גוף כמו וינופו CH-70CC" },
      { model: "BCW70", capacity: 28, shelves: 6, source: `${L}%d7%9e%d7%a7%d7%a8%d7%a8-%d7%99%d7%99%d7%9f-28-%d7%91%d7%a7%d7%91%d7%95%d7%a7%d7%99%d7%9d/`, note: BY_HEIGHT },
      { model: "BCW70W", capacity: 28, shelves: 6, source: `${L}%d7%9e%d7%a7%d7%a8%d7%a8-%d7%99%d7%99%d7%9f-28-%d7%91%d7%a7%d7%91%d7%95%d7%a7%d7%99%d7%9d-%d7%9e%d7%93%d7%a4%d7%99-%d7%a2%d7%a5/`, note: BY_HEIGHT },
      { model: "LA32WS", capacity: 32, shelves: 7, source: `${L}%d7%9e%d7%a7%d7%a8%d7%a8-%d7%99%d7%99%d7%9f-%d7%9c-32-%d7%91%d7%a7%d7%91%d7%95%d7%a7%d7%99%d7%9d/`, note: BY_HEIGHT },
      { model: "LA83WS", capacity: 34, shelves: 6, source: `${L}%d7%9e%d7%a7%d7%a8%d7%a8-%d7%99%d7%99%d7%9f-%d7%91%d7%a0%d7%95%d7%99-34-%d7%91%d7%a7%d7%91%d7%95%d7%a7%d7%99%d7%9d/`, note: "אותו גוף כמו וינופו NS-36B" },
      { model: "JC98", capacity: 34, shelves: 6, source: `${L}%d7%9e%d7%a7%d7%a8%d7%a8-%d7%99%d7%99%d7%9f-%d7%9c%d7%9b-32-%d7%91%d7%a7%d7%91%d7%95%d7%a7%d7%99%d7%9d-%d7%a2%d7%9d-%d7%9e%d7%93%d7%97%d7%a1/`, note: "אותו גוף כמו וינופו CH-85FD" },
      { model: "LA43B", capacity: 43, shelves: 7, bottom: true, source: `${L}la43b/`, note: "מספר המדפים לפי תמונת המוצר" },
      { model: "JC128", capacity: 45, shelves: 7, source: `${L}%d7%9e%d7%a7%d7%a8%d7%a8-%d7%99%d7%99%d7%9f-%d7%9c-45-%d7%91%d7%a7%d7%91%d7%95%d7%a7%d7%99%d7%9d-%d7%a2%d7%9d-%d7%9e%d7%93%d7%97%d7%a1/`, note: "אותו גוף כמו וינופו CH-128FD" },
      { model: "JC128W", capacity: 45, shelves: 7, source: `${L}%d7%9e%d7%a7%d7%a8%d7%a8-%d7%99%d7%99%d7%9f-45-%d7%91%d7%a7%d7%91%d7%95%d7%a7%d7%99%d7%9d-%d7%9e%d7%93%d7%97%d7%a1-%d7%9e%d7%93%d7%a4%d7%99-%d7%a2%d7%a5/`, note: "אותו גוף כמו וינופו CH-128FD" },
      { model: "LA146WS", capacity: 45, shelves: 5, bottom: true, source: `${L}%d7%9e%d7%a7%d7%a8%d7%a8-%d7%99%d7%99%d7%9f-%d7%91%d7%a0%d7%95%d7%99-%d7%9c-45-%d7%91%d7%a7%d7%91%d7%95%d7%a7%d7%99%d7%9d/`, note: "אותו גוף כמו וינופו NS-45" },
      { model: "JC160", capacity: 55, shelves: 9, source: `${L}%d7%9e%d7%a7%d7%a8%d7%a8-%d7%99%d7%99%d7%9f-%d7%9c%d7%90%d7%97%d7%a1%d7%95%d7%9f-55-%d7%91%d7%a7%d7%91%d7%95%d7%a7%d7%99%d7%9d/`, note: BY_HEIGHT },
      { model: "LA75B", capacity: 75, shelves: 7, bottom: true, source: `${L}%d7%9e%d7%a7%d7%a8%d7%a8-%d7%99%d7%99%d7%9f-%d7%9c-75-%d7%91%d7%a7%d7%91%d7%95%d7%a7%d7%99%d7%9d/`, note: "אותו גוף כמו וינופו SU-75B" },
      { model: "LA76RW", capacity: 76, shelves: 14, source: `${L}%d7%9e%d7%a7%d7%a8%d7%a8-%d7%99%d7%99%d7%9f-%d7%9c-76-%d7%91%d7%a7%d7%91%d7%95%d7%a7%d7%99%d7%9d-%d7%a2%d7%9d-%d7%9e%d7%93%d7%a4%d7%99-%d7%a2%d7%a5/`, note: BY_HEIGHT },
      { model: "LA110BK", capacity: 110, shelves: 10, bottom: true, source: `${L}%d7%9e%d7%a7%d7%a8%d7%a8-%d7%99%d7%99%d7%9f-%d7%91%d7%a0%d7%95%d7%99-%d7%9c-110-%d7%91%d7%a7%d7%91%d7%95%d7%a7%d7%99%d7%9d/`, note: "אותו גוף כמו וינופו NS-110A" },
      { model: "LA166BK", capacity: 166, shelves: 11, bottom: true, source: `${L}%d7%9e%d7%a7%d7%a8%d7%a8-%d7%99%d7%99%d7%9f-%d7%91%d7%a0%d7%95%d7%99-%d7%9c-166-%d7%91%d7%a7%d7%91%d7%95%d7%a7%d7%99%d7%9d/`, note: "אותו גוף כמו וינופו SU-180B" },
    ],
  },
  {
    brand: "וינופו",
    models: [
      { model: "NS-7B", capacity: 8, shelves: 7, standing: 1, source: `${V}%d7%9e%d7%a7%d7%a8%d7%a8-%d7%99%d7%99%d7%9f-%d7%a2%d7%93-8-%d7%91%d7%a7%d7%91%d7%95%d7%a7%d7%99%d7%9d-%d7%90%d7%99%d7%a0%d7%98%d7%92%d7%a8%d7%9c%d7%99-%d7%93%d7%92%d7%9d-ns-7b/` },
      { model: "CH-26FD", capacity: 8, shelves: 3, source: `${V}ch-26fd/` },
      { model: "CH-37FD", capacity: 12, shelves: 4, standing: 4, source: `${V}ch-37fd/`, note: BY_HEIGHT },
      { model: "CH-43FD1", capacity: 15, shelves: 4, standing: 3, source: `${V}ch-43fd1/`, note: BY_HEIGHT },
      { model: "CH-43FD2", capacity: 15, shelves: 4, standing: 3, source: `${V}ch-43fd2/`, note: BY_HEIGHT },
      { model: "SU-17B", capacity: 17, shelves: 1, bottom: true, source: `${V}su-17b/` },
      { model: "CH-51FD1", capacity: 18, shelves: 6, source: `${V}ch-51fd1/`, note: BY_HEIGHT },
      { model: "CH-51FD2", capacity: 18, shelves: 6, source: `${V}ch-51fd2/`, note: BY_HEIGHT },
      { model: "CH-53FD1", capacity: 18, shelves: 5, standing: 3, source: `${V}ch-53fd1/`, note: BY_HEIGHT },
      { model: "CH-53FD2", capacity: 18, shelves: 5, standing: 3, source: `${V}ch-53fd2/`, note: BY_HEIGHT },
      { model: "SU-18S", capacity: 18, shelves: 2, bottom: true, source: `${V}%d7%9e%d7%a7%d7%a8%d7%a8-%d7%99%d7%99%d7%9f-%d7%90%d7%99%d7%a0%d7%98%d7%92%d7%a8%d7%9c%d7%99-%d7%a2%d7%99%d7%9c%d7%99-%d7%a2%d7%93-18-%d7%91%d7%a7%d7%91%d7%95%d7%a7%d7%99%d7%9d-%d7%93%d7%92%d7%9d-su-2/` },
      { model: "SU-18B", capacity: 18, shelves: 2, bottom: true, source: `${V}%d7%9e%d7%a7%d7%a8%d7%a8-%d7%99%d7%99%d7%9f-%d7%90%d7%99%d7%a0%d7%98%d7%92%d7%a8%d7%9c%d7%99-%d7%a2%d7%99%d7%9c%d7%99-%d7%a2%d7%93-18-%d7%91%d7%a7%d7%91%d7%95%d7%a7%d7%99%d7%9d-%d7%93%d7%92%d7%9d-su-1/` },
      { model: "NS-18NS", capacity: 19, shelves: 5, source: `${V}ns-18a/` },
      { model: "NS-18B", capacity: 19, shelves: 5, source: `${V}ns-18b/` },
      { model: "CH-70CC1", capacity: 24, shelves: 6, source: `${V}%d7%9e%d7%a7%d7%a8%d7%a8-%d7%99%d7%99%d7%9f-%d7%91%d7%99%d7%aa%d7%99-%d7%a2%d7%93-24-%d7%91%d7%a7%d7%91%d7%95%d7%a7%d7%99%d7%9d-%d7%93%d7%92%d7%9d-ch-70cc/`, note: BY_HEIGHT },
      { model: "CH-70CC2", capacity: 24, shelves: 6, source: `${V}%d7%9e%d7%a7%d7%a8%d7%a8-%d7%99%d7%99%d7%9f-%d7%91%d7%99%d7%aa%d7%99-%d7%97%d7%93%d7%99%d7%a9-%d7%a2%d7%93-24-%d7%91%d7%a7%d7%91%d7%95%d7%a7%d7%99%d7%9d-ch-70cc2/`, note: BY_HEIGHT },
      { model: "SU-24P", capacity: 24, shelves: 3, bottom: true, source: `${V}su-24p/` },
      { model: "CH-85FD1", capacity: 34, shelves: 6, source: `${V}ch-85fd1/` },
      { model: "CH-85FD2", capacity: 34, shelves: 6, source: `${V}ch-85fd2/` },
      { model: "NS-36B", capacity: 34, shelves: 6, source: `${V}%d7%9e%d7%a7%d7%a8%d7%a8-%d7%99%d7%99%d7%9f-%d7%a2%d7%93-34-%d7%91%d7%a7%d7%91%d7%95%d7%a7%d7%99%d7%9d-%d7%90%d7%99%d7%a0%d7%98%d7%92%d7%a8%d7%9c%d7%99-free-standing-%d7%93%d7%92%d7%9d-ns-36b/` },
      { model: "SU-43S", capacity: 43, shelves: 7, bottom: true, source: `${V}%d7%9e%d7%a7%d7%a8%d7%a8-%d7%99%d7%99%d7%9f-%d7%9e%d7%aa%d7%a7%d7%93%d7%9d-%d7%a2%d7%9d-%d7%9e%d7%93%d7%a4%d7%99-%d7%a2%d7%a5-%d7%a2%d7%93-43-%d7%91%d7%a7%d7%91%d7%95%d7%a7%d7%99%d7%9d-su-43s/` },
      { model: "SU-43B", capacity: 43, shelves: 7, bottom: true, source: `${V}%d7%9e%d7%a7%d7%a8%d7%a8-%d7%99%d7%99%d7%9f-%d7%9e%d7%aa%d7%a7%d7%93%d7%9d-%d7%a2%d7%9d-%d7%9e%d7%93%d7%a4%d7%99-%d7%a2%d7%a5-%d7%a2%d7%93-43-%d7%91%d7%a7%d7%91%d7%95%d7%a7%d7%99%d7%9d-su-43b/` },
      { model: "NS-45NBD", capacity: 43, shelves: 4, bottom: true, source: `${V}ns-45bd/`, note: "שני אזורי טמפרטורה" },
      { model: "NS-45NS", capacity: 46, shelves: 5, bottom: true, source: `${V}%d7%9e%d7%a7%d7%a8%d7%a8-%d7%99%d7%99%d7%9f-%d7%a2%d7%93-46-%d7%91%d7%a7%d7%91%d7%95%d7%a7%d7%99%d7%9d-%d7%90%d7%99%d7%a0%d7%98%d7%92%d7%a8%d7%9c%d7%99free-standing-%d7%93%d7%92%d7%9d-ns-45a/` },
      { model: "NS-45NB", capacity: 46, shelves: 5, bottom: true, source: `${V}%d7%9e%d7%a7%d7%a8%d7%a8-%d7%99%d7%99%d7%9f-%d7%a2%d7%93-46-%d7%91%d7%a7%d7%91%d7%95%d7%a7%d7%99%d7%9d-%d7%90%d7%99%d7%a0%d7%98%d7%92%d7%a8%d7%9c%d7%99-free-standing-%d7%93%d7%92%d7%9d-ns-45b/` },
      { model: "CH-128FD1", capacity: 50, shelves: 7, source: `${V}%d7%9e%d7%a7%d7%a8%d7%a8-%d7%99%d7%99%d7%9f-%d7%a2%d7%93-50-%d7%91%d7%a7%d7%91%d7%95%d7%a7%d7%99%d7%9d-ch-128fd1/` },
      { model: "CH-128FD2", capacity: 50, shelves: 7, source: `${V}ch-128fd2/` },
      { model: "SU-60B", capacity: 60, shelves: 13, bottom: true, source: `${V}%d7%9e%d7%a7%d7%a8%d7%a8-%d7%99%d7%99%d7%9f-%d7%a2%d7%93-60-%d7%91%d7%a7%d7%91%d7%95%d7%a7%d7%99%d7%9d-%d7%90%d7%99%d7%a0%d7%98%d7%92%d7%a8%d7%9c%d7%99-free-standing-%d7%93%d7%92%d7%9d-su-60b/` },
      { model: "SU-75B", capacity: 75, shelves: 7, bottom: true, source: `${V}%d7%9e%d7%a7%d7%a8%d7%a8-%d7%99%d7%99%d7%9f-%d7%9e%d7%aa%d7%a7%d7%93%d7%9d-%d7%a2%d7%9d-%d7%9e%d7%93%d7%a4%d7%99-%d7%a2%d7%a5-%d7%a2%d7%93-75-%d7%91%d7%a7%d7%91%d7%95%d7%a7%d7%99%d7%9d-su-75b-%d7%94/` },
      { model: "SU-75S", capacity: 75, shelves: 7, bottom: true, source: `${V}%d7%9e%d7%a7%d7%a8%d7%a8-%d7%99%d7%99%d7%9f-%d7%9e%d7%aa%d7%a7%d7%93%d7%9d-%d7%a2%d7%9d-%d7%9e%d7%93%d7%a4%d7%99-%d7%a2%d7%a5-%d7%a2%d7%93-75-%d7%91%d7%a7%d7%91%d7%95%d7%a7%d7%99%d7%9d-su-75s/` },
      { model: "NS-110A", capacity: 121, shelves: 10, bottom: true, source: `${V}%d7%9e%d7%a7%d7%a8%d7%a8-%d7%99%d7%99%d7%9f-%d7%9e%d7%aa%d7%a7%d7%93%d7%9d-%d7%a2%d7%9d-%d7%9e%d7%93%d7%a4%d7%99-%d7%a2%d7%a5-%d7%a0%d7%a9%d7%9c%d7%a4%d7%99%d7%9d-%d7%a2%d7%93-121-%d7%91%d7%a7%d7%91/`, note: "חצי המדף התחתון נספר כתחתית" },
      { model: "NS-110B", capacity: 121, shelves: 10, bottom: true, source: `${V}%d7%9e%d7%a7%d7%a8%d7%a8-%d7%99%d7%99%d7%9f-%d7%9e%d7%aa%d7%a7%d7%93%d7%9d-%d7%a2%d7%9d-%d7%9e%d7%93%d7%a4%d7%99-%d7%a2%d7%a5-%d7%a0%d7%a9%d7%9c%d7%a4%d7%99%d7%9d-%d7%a2%d7%93-121-%d7%91%d7%a7%d7%91-3/`, note: "חצי המדף התחתון נספר כתחתית" },
      { model: "SU-192SL", capacity: 153, shelves: 11, bottom: true, source: `${V}su-192sl/` },
      { model: "SU-192BL", capacity: 153, shelves: 11, bottom: true, source: `${V}su-192bl/` },
      { model: "SU-192S", capacity: 161, shelves: 13, source: `${V}%d7%9e%d7%a7%d7%a8%d7%a8-%d7%99%d7%99%d7%9f-%d7%9e%d7%aa%d7%a7%d7%93%d7%9d-%d7%a2%d7%9d-%d7%9e%d7%93%d7%a4%d7%99-%d7%a2%d7%a5-%d7%a0%d7%a9%d7%9c%d7%a4%d7%99%d7%9d-%d7%a2%d7%93-161-%d7%91%d7%a7%d7%91/` },
      { model: "SU-192B", capacity: 161, shelves: 13, source: `${V}%d7%9e%d7%a7%d7%a8%d7%a8-%d7%99%d7%99%d7%9f-%d7%9e%d7%aa%d7%a7%d7%93%d7%9d-%d7%a2%d7%9d-%d7%9e%d7%93%d7%a4%d7%99-%d7%a2%d7%a5-%d7%a0%d7%a9%d7%9c%d7%a4%d7%99%d7%9d-%d7%a2%d7%93-161-%d7%91%d7%a7%d7%91-3/` },
      { model: "SU-180B", capacity: 166, shelves: 11, bottom: true, source: `${V}%d7%9e%d7%a7%d7%a8%d7%a8-%d7%99%d7%99%d7%9f-%d7%a9%d7%a0%d7%99-%d7%90%d7%96%d7%95%d7%a8%d7%99-%d7%a7%d7%99%d7%a8%d7%95%d7%a8-su-180b/`, note: "שני אזורי טמפרטורה" },
      { model: "SU-300B", capacity: 300, shelves: 10, bottom: true, source: `${V}%d7%9e%d7%a7%d7%a8%d7%a8-%d7%99%d7%99%d7%9f-%d7%9e%d7%aa%d7%a7%d7%93%d7%9d-%d7%a2%d7%9d-%d7%9e%d7%93%d7%a4%d7%99-%d7%a2%d7%a5-%d7%a0%d7%a9%d7%9c%d7%a4%d7%99%d7%9d-%d7%a2%d7%93-300-%d7%91%d7%a7%d7%91/` },
    ],
  },
  {
    brand: "האייר",
    models: [
      { model: "HWS34GGH1", capacity: 34, shelves: 5, source: `${B}מקרר-יין-34-בקבוקים-haier-31002203hws34ggh1` },
      { model: "HUC44GDEH1", capacity: 44, shelves: 4, source: `${B}מקרר-יין-אינטגרלי-44-בקבוקים-haier-31002203huc44gdeh1`, note: "אינטגרלי" },
      { model: "HWS49GA", capacity: 49, shelves: 4, bottom: true, source: `${NP}5423`, note: "פורסם \"4+1 מדפים\": ארבעה נשלפים ותחתית" },
      { model: "JC-162S", capacity: 49, shelves: 9, source: `${NP}53` },
      { model: "HWS58GGH1", capacity: 58, shelves: 5, source: `${NP}5597`, note: "לפי היבואן 5 מדפים (בבאג כתוב 10)" },
      { model: "HWS79GDG", capacity: 79, shelves: 5, bottom: true, source: `${B}מקרר-יין-79-בקבוקים-haier-31005100hws79gdg`, note: `שני אזורי טמפרטורה. ${BOTTOM_GUESS}` },
      { model: "HWS188GAE", capacity: 188, shelves: 7, bottom: true, source: `${B}מקרר-יין-188-בקבוקים-haier-31005100hws188gae`, note: `שני אזורי טמפרטורה. ${BOTTOM_GUESS}` },
    ],
  },
  {
    brand: "קאסו",
    models: [
      { model: "WineSafe 12", capacity: 12, shelves: 3, source: `${CASO}caso-winecomfort-380-smart/`, note: "לפי טבלת ההשוואה של היצרן" },
      { model: "WineComfort 24", capacity: 24, shelves: 5, source: `${CASO}caso-winecomfort-24-black/`, note: "שני אזורי טמפרטורה" },
      { model: "WineComfort 38", capacity: 38, shelves: 7, source: `${CASO}caso-winecomfort-380-smart/`, note: "שני אזורי טמפרטורה" },
      { model: "WineChef Pro 40", capacity: 40, shelves: 5, source: `${CASO}caso-winecomfort-380-smart/`, note: "לפי טבלת ההשוואה של היצרן" },
      { model: "WineComfort 66", capacity: 66, shelves: 7, source: `${CASO}caso-winecomfort-660-smart/`, note: "שני אזורי טמפרטורה" },
      { model: "WineExclusive 66 Smart", capacity: 66, shelves: 7, source: `${CASO}caso-wineexclusive-66-smart/`, note: "שני אזורי טמפרטורה" },
    ],
  },
  {
    brand: "ויין בר",
    models: [
      { model: "BCW-36A", capacity: 12, shelves: 5, source: `${B}מקרר-יין-12-בקבוקים-winebar-92510015588` },
      { model: "JC-82", capacity: 28, shelves: 6, bottom: true, source: `${B}מקרר-יין-מדחס-28-בקבוקים-winebar-9258228452`, note: "6 מדפים ומדף תחתון" },
      { model: "VI35S", capacity: 34, shelves: 6, source: `${B}מקרר-יין-אינטגרלי-כולל-מדפי-עץ-34-בקבוקים-winebar-925986552` },
      { model: "VI46D-SS", capacity: 39, shelves: 4, source: `${B}מקרר-יין-אינטגרלי-כולל-2-אזורי-קירור-ומדפי-עץ-39-בקבוקים-winebar-925986554`, note: "שני אזורי טמפרטורה" },
      { model: "JC-150WD", capacity: 40, shelves: 6, source: `${B}מקרר-יין-אינטגרלי-40-בקבוקים-winebar-925150541008` },
      { model: "JC-150WS", capacity: 46, shelves: 6, source: `${B}מקרר-יין-אינטגרלי-46-בקבוקים-winebar-92515046005` },
      { model: "VI46S", capacity: 46, shelves: 5, source: `${B}מקרר-יין-אינטגרלי-כולל-מדפי-עץ-46-בקבוקים-winebar-925986553` },
      { model: "JC-208WS", capacity: 80, shelves: 11, source: `${B}מקרר-יין-מדחס-80-בקבוקים-winebar-925208100980` },
      { model: "WBS-270", capacity: 100, shelves: 6, bottom: true, source: `${B}מקרר-יין-100-בקבוקים-winebar-925986547`, note: BOTTOM_GUESS },
      { model: "JC-430WD", capacity: 163, shelves: 14, source: `${B}מקרר-יין-אינטגרלי-163-בקבוקים-winebar-9254301631010`, note: "שני אזורי טמפרטורה" },
    ],
  },
  // No models yet (the user types theirs); listed so the brand can be picked.
  { brand: "יורוקייב", models: [] },
];
