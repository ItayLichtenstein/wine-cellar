// Reading a CSV file into bottles to import (spec: "ייבוא מקובץ", stage A).
// Pure and tested: the page calls it in the browser, so the file itself
// never leaves the device; only the rows it produces are sent.
//
// Works first of all with the file the site itself exports (headers in
// Hebrew or English), and with any CSV whose headers say what they are.

import { en } from "@/i18n/en";
import { he } from "@/i18n/he";

export type ImportField =
  | "winery" | "name" | "type" | "year" | "status" | "quantity" | "grape" | "country" | "region" | "alcohol"
  | "drinkFrom" | "drinkTo" | "peakFrom" | "peakTo" | "paid" | "regular" | "gift" | "kosher"
  | "added" | "consumed" | "note" | "link";

export const IMPORT_FIELDS: ImportField[] = [
  "winery", "name", "year", "type", "quantity", "status", "grape", "country", "region", "alcohol",
  "drinkFrom", "drinkTo", "peakFrom", "peakTo", "paid", "regular", "gift", "kosher", "added", "consumed", "note", "link",
];

/** Column index per field; a field missing from the file is not in the map. */
export type Mapping = Partial<Record<ImportField, number>>;

/** One bottle, in the shape import_cellar() takes. */
export type ImportBottle = {
  winery: string;
  name: string;
  type?: string;
  year?: number;
  status: "unplaced" | "in_transit" | "consumed";
  grape?: string;
  country?: string;
  region?: string;
  kosher?: "yes" | "no";
  alcohol?: number;
  drink_from?: number;
  drink_to?: number;
  peak_from?: number;
  peak_to?: number;
  added_on?: string;
  consumed_on?: string;
  note?: string;
  link_url?: string;
  paid?: number;
  regular?: number;
  is_gift?: boolean;
};

export type RowError = { row: number; reason: "noWinery" | "noName" | "badYear" | "tooMany" };

export const MAX_BOTTLES = 2000;
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_PER_ROW = 100;

// ---------------------------------------------------------------------
// CSV text → rows (RFC 4180: quotes, doubled quotes, commas and newlines
// inside quotes). Also accepts ";" or tab as the separator (Excel in some
// locales saves with ";").
// ---------------------------------------------------------------------
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const firstLine = src.slice(0, src.search(/\r?\n|$/));
  const sep = [",", ";", "\t"].reduce((best, s) => (count(firstLine, s) > count(firstLine, best) ? s : best), ",");

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"' && cell === "") quoted = true;
    else if (c === sep) {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

function count(s: string, ch: string): number {
  return s.split(ch).length - 1;
}

// ---------------------------------------------------------------------
// Headers → fields. Our own export's headers (both languages) plus common
// words people use in their own sheets.
// ---------------------------------------------------------------------
const norm = (s: string) => s.trim().toLowerCase().replace(/[׳'"’]/g, "").replace(/\s+/g, " ");

const ALIASES: Record<ImportField, string[]> = {
  winery: ["יקב", "winery", "producer", "יצרן"],
  name: ["יין", "wine", "שם", "שם היין", "name", "wine name"],
  type: ["סוג", "type", "color", "צבע"],
  year: ["בציר", "vintage", "year", "שנה", "שנת בציר"],
  status: ["מצב", "status", "סטטוס", "state"],
  quantity: ["כמות", "quantity", "qty", "בקבוקים", "bottles", "count", "מספר בקבוקים"],
  grape: ["זן", "grape", "grapes", "variety", "זנים"],
  country: ["ארץ", "country", "מדינה"],
  region: ["אזור", "region", "appellation"],
  alcohol: ["אלכוהול", "alcohol", "abv", "% אלכוהול"],
  drinkFrom: ["שתייה מ־", "שתייה מ", "drink from", "drink from year"],
  drinkTo: ["שתייה עד", "drink until", "drink to"],
  peakFrom: ["שיא מ־", "שיא מ", "peak from"],
  peakTo: ["שיא עד", "peak until", "peak to"],
  paid: ["שולם", "paid", "מחיר", "price", "מחיר ששולם", "cost"],
  regular: ["מחיר רגיל", "regular price", "value", "שווי"],
  gift: ["מתנה", "gift"],
  kosher: ["כשר", "kosher", "כשרות"],
  added: ["נוסף", "added", "תאריך הוספה", "date added", "purchased", "נקנה"],
  consumed: ["נשתה", "drunk", "consumed", "date drunk", "תאריך שתייה"],
  note: ["הערה", "note", "notes", "הערות"],
  link: ["קישור", "link", "url"],
};

/** Guesses which column holds which field, from the header row. */
export function guessMapping(header: string[]): Mapping {
  const mapping: Mapping = {};
  const cols = header.map(norm);
  for (const field of IMPORT_FIELDS) {
    const names = ALIASES[field].map(norm);
    const i = cols.findIndex((c, k) => names.includes(c) && !Object.values(mapping).includes(k));
    if (i >= 0) mapping[field] = i;
  }
  return mapping;
}

// ---------------------------------------------------------------------
// Rows → bottles.
// ---------------------------------------------------------------------
const TYPE_VALUES = Object.keys(he.wineType);
const TYPE_BY_WORD = new Map<string, string>([
  ...TYPE_VALUES.map((v) => [v, v] as const),
  ...Object.entries(he.wineType).map(([v, label]) => [norm(label), v] as const),
  ...Object.entries(en.wineType).map(([v, label]) => [norm(label), v] as const),
  ["rosé", "rose"], ["רוזה", "rose"], ["מבעבע", "sparkling"], ["champagne", "sparkling"], ["שמפניה", "sparkling"],
]);

const CONSUMED_WORDS = new Set(["consumed", "שתינו", "נשתה", "drunk", norm(en.account.csvStatus.consumed), norm(he.account.csvStatus.consumed)]);
const TRANSIT_WORDS = new Set(["in_transit", "בדרך", "on the way", norm(en.account.csvStatus.in_transit)]);
const YES = new Set(["כן", "yes", "y", "true", "1", "v", "✓", "כשר", "kosher"]);
const NO = new Set(["לא", "no", "n", "false", "0", "לא כשר", "not kosher"]);

/** The export prefixes a formula-like cell with ' (CSV injection guard); undo that. */
function cellText(row: string[], i: number | undefined): string {
  if (i === undefined) return "";
  const v = (row[i] ?? "").trim();
  return /^'[=+\-@]/.test(v) ? v.slice(1) : v;
}

function num(s: string): number | undefined {
  const n = Number(s.replace(/[₪$€,\s]/g, "").replace(/%$/, ""));
  return s.trim() === "" || !Number.isFinite(n) ? undefined : n;
}

function yearOf(s: string): number | undefined | null {
  if (s.trim() === "" || /^nv$/i.test(s.trim())) return undefined;
  const n = num(s);
  return n !== undefined && Number.isInteger(n) && n >= 1900 && n <= 2100 ? n : null; // null = invalid
}

/** "2024-03-01", "1/3/2024" (day first, as in Israel) → "2024-03-01". */
function dateOf(s: string): string | undefined {
  const t = s.trim();
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return iso(+m[1], +m[2], +m[3]);
  m = t.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
  if (m) return iso(+m[3], +m[2], +m[1]);
  return undefined;
}

function iso(y: number, mo: number, d: number): string | undefined {
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || y < 1900 || y > 2100) return undefined;
  return date.toISOString().slice(0, 10);
}

const clip = (s: string, max: number) => (s ? s.slice(0, max) : undefined);
const between = (n: number | undefined, lo: number, hi: number) => (n !== undefined && n >= lo && n <= hi ? n : undefined);

export function buildImport(rows: string[][], mapping: Mapping, today: string): { bottles: ImportBottle[]; errors: RowError[] } {
  const bottles: ImportBottle[] = [];
  const errors: RowError[] = [];
  const get = (r: string[], f: ImportField) => cellText(r, mapping[f]);

  rows.forEach((r, k) => {
    const row = k + 2; // 1-based, after the header line
    const winery = get(r, "winery").replace(/\s+/g, " ");
    const name = get(r, "name").replace(/\s+/g, " ");
    if (!winery) return errors.push({ row, reason: "noWinery" });
    if (!name) return errors.push({ row, reason: "noName" });
    const year = yearOf(get(r, "year"));
    if (year === null) return errors.push({ row, reason: "badYear" });

    const statusWord = norm(get(r, "status"));
    const consumedOn = dateOf(get(r, "consumed"));
    const status: ImportBottle["status"] =
      CONSUMED_WORDS.has(statusWord) || (consumedOn && !statusWord) ? "consumed" : TRANSIT_WORDS.has(statusWord) ? "in_transit" : "unplaced";
    const kosherWord = norm(get(r, "kosher"));
    const giftWord = norm(get(r, "gift"));
    const link = get(r, "link");

    const bottle: ImportBottle = {
      winery: winery.slice(0, 120),
      name: name.slice(0, 120),
      type: TYPE_BY_WORD.get(norm(get(r, "type"))),
      year,
      status,
      grape: clip(get(r, "grape"), 200),
      country: clip(get(r, "country"), 60),
      region: clip(get(r, "region"), 120),
      kosher: YES.has(kosherWord) ? "yes" : NO.has(kosherWord) ? "no" : undefined,
      alcohol: between(num(get(r, "alcohol")), 0, 25),
      drink_from: between(num(get(r, "drinkFrom")), 1900, 2200),
      drink_to: between(num(get(r, "drinkTo")), 1900, 2200),
      peak_from: between(num(get(r, "peakFrom")), 1900, 2200),
      peak_to: between(num(get(r, "peakTo")), 1900, 2200),
      added_on: dateOf(get(r, "added")),
      consumed_on: status === "consumed" ? (consumedOn ?? dateOf(get(r, "added")) ?? today) : undefined,
      note: clip(get(r, "note"), 1000),
      link_url: /^https?:\/\//i.test(link) && link.length <= 2048 ? link : undefined,
      paid: between(num(get(r, "paid")), 0, 99_999_999),
      regular: between(num(get(r, "regular")), 0, 99_999_999),
      is_gift: YES.has(giftWord) || undefined,
    };
    // Windows the database would reject (from after to) are dropped, not fixed.
    if (bottle.drink_from && bottle.drink_to && bottle.drink_from > bottle.drink_to) bottle.drink_from = bottle.drink_to = undefined;
    if (bottle.peak_from && bottle.peak_to && bottle.peak_from > bottle.peak_to) bottle.peak_from = bottle.peak_to = undefined;

    const qty = mapping.quantity === undefined ? 1 : Math.round(num(get(r, "quantity")) ?? 1);
    if (qty < 1) return; // a "0 bottles" line: nothing to add
    if (qty > MAX_PER_ROW) return errors.push({ row, reason: "tooMany" });
    for (let i = 0; i < qty; i++) bottles.push({ ...bottle });
  });

  return { bottles, errors };
}

/** What the preview says: "129 bottles: 82 to place, 47 drunk · 60 wines". */
export function summarize(bottles: ImportBottle[]) {
  const wines = new Set(bottles.map((b) => `${b.winery.toLowerCase()}\u0000${b.name.toLowerCase()}`));
  const consumed = bottles.filter((b) => b.status === "consumed").length;
  return { bottles: bottles.length, consumed, toPlace: bottles.length - consumed, wines: wines.size };
}
