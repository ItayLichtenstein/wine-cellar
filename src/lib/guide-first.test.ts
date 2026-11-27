import { describe, expect, it } from "vitest";
import { shouldOpenGuide } from "./guide-first";

describe("shouldOpenGuide", () => {
  it("opens for a new user who has not seen it", () => {
    expect(shouldOpenGuide(false, undefined)).toBe(true);
  });
  it("does not open again once seen on this device", () => {
    expect(shouldOpenGuide(false, "1")).toBe(false);
  });
  it("never opens by itself for a user who already started", () => {
    expect(shouldOpenGuide(true, undefined)).toBe(false);
  });
});
