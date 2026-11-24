// CSV export helpers (pure, tested).
//
// Excel/Sheets run a cell that starts with = + - @ (or tab / carriage
// return) as a FORMULA. A wine note like "=HYPERLINK(...)" could then do
// harm on the computer that opens the file ("CSV injection", OWASP).
// Such cells get a leading apostrophe, which spreadsheets show as text.

const FORMULA_START = /^[=+\-@\t\r]/;

export function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  let s = String(value);
  if (typeof value === "string" && FORMULA_START.test(s)) s = `'${s}`;
  // Quote when needed; a quote inside is doubled (RFC 4180).
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Rows → CSV text. Starts with a BOM so Excel opens Hebrew as UTF-8,
 * and uses CRLF line ends like the standard.
 */
export function toCsv(header: string[], rows: (string | number | null)[][]): string {
  const lines = [header, ...rows].map((r) => r.map(csvCell).join(","));
  return "﻿" + lines.join("\r\n") + "\r\n";
}
