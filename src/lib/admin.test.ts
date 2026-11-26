import { describe, expect, it } from "vitest";
import { daysAgo, megabytes, percentOf } from "./admin";

describe("daysAgo", () => {
  const now = new Date("2026-11-27T12:00:00Z");
  it("is 0 for earlier today and counts whole days", () => {
    expect(daysAgo("2026-11-27T01:00:00Z", now)).toBe(0);
    expect(daysAgo("2026-11-25T11:00:00Z", now)).toBe(2);
  });
  it("is null when there is no date", () => {
    expect(daysAgo(null, now)).toBeNull();
  });
  it("never goes negative (clock skew)", () => {
    expect(daysAgo("2026-11-28T00:00:00Z", now)).toBe(0);
  });
});

describe("megabytes", () => {
  it("shows one decimal for small sizes and whole numbers for large", () => {
    expect(megabytes(12_345_678)).toBe("12.3");
    expect(megabytes(234_000_000)).toBe("234");
  });
});

describe("percentOf", () => {
  it("rounds up and caps at 100", () => {
    expect(percentOf(1, 1000)).toBe(1);
    expect(percentOf(250, 1000)).toBe(25);
    expect(percentOf(2000, 1000)).toBe(100);
    expect(percentOf(5, 0)).toBe(0);
  });
});
