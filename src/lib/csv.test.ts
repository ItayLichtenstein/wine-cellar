import { describe, expect, it } from "vitest";
import { csvCell, toCsv } from "./csv";

describe("csvCell", () => {
  it("neutralises cells that a spreadsheet would run as a formula", () => {
    expect(csvCell("=HYPERLINK(\"http://x\")")).toBe(`"'=HYPERLINK(""http://x"")"`);
    expect(csvCell("+972")).toBe("'+972");
    expect(csvCell("-1")).toBe("'-1");
    expect(csvCell("@SUM(A1)")).toBe("'@SUM(A1)");
  });
  it("leaves real numbers alone (a negative number is data, not a formula)", () => {
    expect(csvCell(-5)).toBe("-5");
    expect(csvCell(120.5)).toBe("120.5");
  });
  it("quotes commas, quotes and new lines", () => {
    expect(csvCell("ריוחה, ספרד")).toBe('"ריוחה, ספרד"');
    expect(csvCell('הערה "טובה"')).toBe('"הערה ""טובה"""');
    expect(csvCell(null)).toBe("");
  });
});

it("toCsv: BOM for Hebrew in Excel, header first, CRLF lines", () => {
  expect(toCsv(["יקב", "שנה"], [["קסטל", 2020]])).toBe("﻿יקב,שנה\r\nקסטל,2020\r\n");
});
