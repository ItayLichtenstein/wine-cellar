import { describe, expect, it } from "vitest";
import { bottles } from "./plural";

describe("bottles", () => {
  it("one is a word, more are a number", () => {
    expect(bottles(1)).toBe("בקבוק אחד");
    expect(bottles(0)).toBe("0 בקבוקים");
    expect(bottles(12)).toBe("12 בקבוקים");
  });
});
