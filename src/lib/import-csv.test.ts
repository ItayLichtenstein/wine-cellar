import { describe, expect, it } from "vitest";
import { toCsv } from "./csv";
import { buildImport, guessMapping, parseCsv, summarize } from "./import-csv";
import { he } from "@/i18n/he";
import { en } from "@/i18n/en";

const TODAY = "2026-11-27";

describe("parseCsv", () => {
  it("handles quotes, doubled quotes, commas and newlines inside cells, BOM and CRLF", () => {
    const text = '﻿a,b\r\n"x, y","say ""hi"""\r\n"two\nlines",z\r\n';
    expect(parseCsv(text)).toEqual([["a", "b"], ["x, y", 'say "hi"'], ["two\nlines", "z"]]);
  });

  it("detects ; as the separator and skips empty lines", () => {
    expect(parseCsv("a;b\n\n1;2\n")).toEqual([["a", "b"], ["1", "2"]]);
  });
});

describe("guessMapping", () => {
  it("reads our own export headers in both languages", () => {
    for (const headers of [he.account.csvHeaders, en.account.csvHeaders]) {
      const m = guessMapping(headers);
      expect(m.winery).toBe(0);
      expect(m.name).toBe(1);
      expect(m.year).toBe(3);
      expect(m.status).toBe(4);
      expect(m.paid).toBe(13);
      expect(m.regular).toBe(14);
      expect(m.link).toBe(20);
    }
  });

  it("understands common words in someone's own sheet", () => {
    expect(guessMapping(["Producer", "Wine Name", "Vintage", "Qty", "Price"])).toEqual({ winery: 0, name: 1, year: 2, quantity: 3, paid: 4 });
  });
});

describe("buildImport", () => {
  it("round-trips our own export (Hebrew)", () => {
    const csv = toCsv(he.account.csvHeaders, [
      ["Yatir", "Forest", "red", 2019, "במקרר", "Cabernet", "Israel", "", 14.5, 2022, 2030, null, null, 250, null, "", "כן", "2024-01-05", "", "=SUM(1)", "https://x.co"],
      ["Castel", "Blanc", "white", "NV", "שתינו", "", "", "", null, null, null, null, null, null, 180, "כן", "", "2023-02-02", "2025-03-03", "", ""],
    ]);
    const [header, ...rows] = parseCsv(csv);
    const { bottles, errors } = buildImport(rows, guessMapping(header), TODAY);
    expect(errors).toEqual([]);
    expect(bottles[0]).toMatchObject({ winery: "Yatir", name: "Forest", type: "red", year: 2019, status: "unplaced", kosher: "yes", alcohol: 14.5, paid: 250, note: "=SUM(1)", link_url: "https://x.co", added_on: "2024-01-05" });
    expect(bottles[1]).toMatchObject({ year: undefined, status: "consumed", consumed_on: "2025-03-03", regular: 180, is_gift: true });
  });

  it("expands quantities, reports bad rows with their line number, and never fails the whole file", () => {
    const rows = [["Tzora", "Misty Hills", "2020", "3"], ["", "No winery", "", "1"], ["X", "Y", "19", "1"], ["A", "B", "", "0"]];
    const { bottles, errors } = buildImport(rows, { winery: 0, name: 1, year: 2, quantity: 3 }, TODAY);
    expect(bottles).toHaveLength(3);
    expect(errors).toEqual([{ row: 3, reason: "noWinery" }, { row: 4, reason: "badYear" }]);
  });

  it("reads Hebrew type words, day-first dates, and drops a window that goes backwards", () => {
    const { bottles } = buildImport([["W", "N", "רוזה", "1/3/2024", "2030", "2025"]], { winery: 0, name: 1, type: 2, added: 3, drinkFrom: 4, drinkTo: 5 }, TODAY);
    expect(bottles[0]).toMatchObject({ type: "rose", added_on: "2024-03-01", drink_from: undefined, drink_to: undefined });
  });

  it("a drunk bottle without a date gets today", () => {
    const { bottles } = buildImport([["W", "N", "Drunk"]], { winery: 0, name: 1, status: 2 }, TODAY);
    expect(bottles[0]).toMatchObject({ status: "consumed", consumed_on: TODAY });
  });
});

describe("summarize", () => {
  it("counts bottles, drunk ones and distinct wines (any case)", () => {
    const b = (winery: string, status: "unplaced" | "consumed" = "unplaced") => ({ winery, name: "n", status });
    expect(summarize([b("A"), b("a", "consumed"), b("B")])).toEqual({ bottles: 3, consumed: 1, toPlace: 2, wines: 2 });
  });
});

describe("guessMapping for other apps' exports", () => {
  it("reads a CellarTracker header", () => {
    const header = ["iWine", "Type", "Color", "Quantity", "Vintage", "Wine", "Producer", "Varietal", "Country", "Region", "Appellation", "BeginConsume", "EndConsume", "Price", "Value"];
    const m = guessMapping(header);
    expect(m.winery).toBe(6);
    expect(m.name).toBe(5);
    expect(m.year).toBe(4);
    expect(m.quantity).toBe(3);
    expect(m.grape).toBe(7);
    expect(m.region).toBe(9);
    expect(m.drinkFrom).toBe(11);
    expect(m.drinkTo).toBe(12);
    expect(m.paid).toBe(13);
    expect(m.regular).toBe(14);
  });
  it("reads a Vivino header", () => {
    const header = ["Winery", "Wine name", "Vintage", "Region", "Country", "Regional wine style", "Average rating", "Scan date", "Your rating", "Your review", "Personal Note", "Wine type", "Link to wine", "Wine price"];
    const m = guessMapping(header);
    expect(m.winery).toBe(0);
    expect(m.name).toBe(1);
    expect(m.year).toBe(2);
    expect(m.type).toBe(11);
    expect(m.added).toBe(7);
    expect(m.note).toBe(10);
    expect(m.link).toBe(12);
    expect(m.paid).toBe(13);
  });
});
