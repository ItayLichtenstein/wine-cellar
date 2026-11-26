import { describe, expect, it } from "vitest";
import { aiCardState } from "./ai-card-gate";

describe("aiCardState", () => {
  it("shows on the first two visits", () => {
    expect(aiCardState(0, false, false, false)).toBe("show"); // first visit, before counting
    expect(aiCardState(1, true, false, false)).toBe("show"); // first visit, counted
    expect(aiCardState(1, false, false, false)).toBe("show"); // second visit
    expect(aiCardState(2, true, false, false)).toBe("show");
  });

  it("goes by itself on the third visit, and explains where it went once", () => {
    expect(aiCardState(2, false, false, false)).toBe("explain");
    expect(aiCardState(3, true, false, true)).toBe("hide");
  });

  it("the X hides it at once, with the same one-time explanation", () => {
    expect(aiCardState(1, true, true, false)).toBe("explain");
    expect(aiCardState(1, true, true, true)).toBe("hide");
  });
});
