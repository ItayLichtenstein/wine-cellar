import { describe, expect, it } from "vitest";
import { markAiHintSeen, shouldShowAiHint } from "./ai-hint";

const DAY = 24 * 60 * 60 * 1000;

describe("shouldShowAiHint", () => {
  it("shows the first time", () => {
    expect(shouldShowAiHint(null, 0)).toBe(true);
  });
  it("waits a week before the second time", () => {
    const once = markAiHintSeen(null, 0);
    expect(shouldShowAiHint(once, 6 * DAY)).toBe(false);
    expect(shouldShowAiHint(once, 7 * DAY)).toBe(true);
  });
  it("never shows a third time", () => {
    const twice = markAiHintSeen(markAiHintSeen(null, 0), 7 * DAY);
    expect(twice.count).toBe(2);
    expect(shouldShowAiHint(twice, 100 * DAY)).toBe(false);
  });
});
