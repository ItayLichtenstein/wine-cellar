import { describe, expect, it } from "vitest";
import { EMPTY_EXTRA, criticSummary, linkLabel, validateExtra, vintageBreakdown } from "./wine-extra";

describe("criticSummary", () => {
  it("rounds the average and counts the critics", () => {
    expect(criticSummary([{ critic: "A", score: 93 }, { critic: "B", score: 94 }, { critic: "C", score: 96 }])).toBe("94 · 3 מבקרים");
  });
  it("names a single critic, and is empty without scores", () => {
    expect(criticSummary([{ critic: "Suckling", score: 95 }])).toBe("95 · Suckling");
    expect(criticSummary([])).toBeNull();
  });
});

describe("linkLabel", () => {
  it("knows common wine sites, including subdomains", () => {
    expect(linkLabel("https://www.wineroute.co.il/brand/x")).toBe("דרך היין");
    expect(linkLabel("https://shop.vivino.com/w/1")).toBe("Vivino");
  });
  it("falls back to the domain, and rejects non-web links", () => {
    expect(linkLabel("https://www.example.com/a")).toBe("example.com");
    expect(linkLabel("javascript:alert(1)")).toBeNull();
    expect(linkLabel("not a url")).toBeNull();
  });
});

describe("validateExtra", () => {
  it("accepts an empty form", () => expect(validateExtra(EMPTY_EXTRA)).toBeNull());
  it("catches the common mistakes", () => {
    expect(validateExtra({ ...EMPTY_EXTRA, peakFrom: "2030", peakTo: "2028" })).toMatch(/השיא/);
    expect(validateExtra({ ...EMPTY_EXTRA, alcohol: "40" })).toMatch(/אלכוהול/);
    expect(validateExtra({ ...EMPTY_EXTRA, critics: [{ critic: "X", score: 120 }] })).toMatch(/מבקר/);
    expect(validateExtra({ ...EMPTY_EXTRA, link: "ftp://x" })).toMatch(/קישור/);
  });
});

it("vintageBreakdown: counts per year, newest first, NV last", () => {
  expect(vintageBreakdown([2020, 2021, null, 2021, 2021, 2021])).toBe("4 × 2021, 1 × 2020, 1 × NV");
});
