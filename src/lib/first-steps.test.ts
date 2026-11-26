import { describe, expect, it } from "vitest";
import { showFirstSteps, stateOnShow } from "./first-steps";

describe("showFirstSteps", () => {
  it("shows a card that was never shown", () => {
    expect(showFirstSteps(null, false)).toBe(true);
  });
  it("hides an ignored card on the next visit, but not in the visit it appeared", () => {
    expect(showFirstSteps("shown", false)).toBe(false);
    expect(showFirstSteps("shown", true)).toBe(true);
  });
  it("keeps a card the user is using", () => {
    expect(showFirstSteps("using", false)).toBe(true);
  });
  it("skips a card with nothing left to do, unless the user is finishing it", () => {
    expect(showFirstSteps(null, false, true)).toBe(false);
    expect(showFirstSteps("using", false, true)).toBe(true);
  });
  it("never shows a closed card", () => {
    expect(showFirstSteps("closed", true)).toBe(false);
  });
});

describe("stateOnShow", () => {
  it("marks the first showing only", () => {
    expect(stateOnShow(null)).toBe("shown");
    expect(stateOnShow("shown")).toBeNull();
    expect(stateOnShow("using")).toBeNull();
  });
});
