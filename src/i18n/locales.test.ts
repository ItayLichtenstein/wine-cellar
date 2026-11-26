import { describe, expect, it } from "vitest";
import { dirOf, isLocale, toLocale } from "./locales";
import { dictionaries } from "./dictionaries";

describe("locales", () => {
  it("accepts only the supported languages", () => {
    expect(isLocale("he")).toBe(true);
    expect(isLocale("en")).toBe(true);
    expect(isLocale("fr")).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });

  it("falls back to Hebrew for a missing or foreign cookie", () => {
    expect(toLocale(undefined)).toBe("he");
    expect(toLocale("<script>")).toBe("he");
    expect(toLocale("en")).toBe("en");
  });

  it("writes Hebrew right to left and English left to right", () => {
    expect(dirOf("he")).toBe("rtl");
    expect(dirOf("en")).toBe("ltr");
  });
});

describe("dictionaries", () => {
  // The types already force the same keys; this catches an empty string left behind.
  it("has no empty text in any language", () => {
    const empty = (o: object, path = ""): string[] =>
      Object.entries(o).flatMap(([k, v]) =>
        typeof v === "string" ? (v.trim() ? [] : [path + k]) : typeof v === "object" && v ? empty(v, `${path}${k}.`) : [],
      );
    expect(empty(dictionaries.he)).toEqual([]);
    expect(empty(dictionaries.en)).toEqual([]);
  });
});
