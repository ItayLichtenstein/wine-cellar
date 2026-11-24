import { describe, expect, it } from "vitest";
import { drinkState, type DrinkWindow } from "./drink-state";

const YEAR = 2026;

describe("drinkState (current year 2026)", () => {
  it.each<[string, DrinkWindow, ReturnType<typeof drinkState>]>([
    ["no window at all", { drinkFrom: null, drinkTo: null }, "none"],
    ["window ended last year", { drinkFrom: 2018, drinkTo: 2025 }, "past"],
    ["window starts next year", { drinkFrom: 2027, drinkTo: 2035 }, "near"],
    ["window starts in 3 years", { drinkFrom: 2029, drinkTo: 2035 }, "young"],
    ["window ends this year", { drinkFrom: 2020, drinkTo: 2026 }, "now"],
    ["peak already ended", { drinkFrom: 2020, drinkTo: 2032, peakTo: 2025 }, "now"],
    ["window ends next year", { drinkFrom: 2020, drinkTo: 2027 }, "soon"],
    ["peak ends next year", { drinkFrom: 2020, drinkTo: 2035, peakTo: 2027 }, "soon"],
    ["years left in the window", { drinkFrom: 2022, drinkTo: 2032 }, "hold"],
    ["only an end year", { drinkFrom: null, drinkTo: 2030 }, "hold"],
  ])("%s", (_name, window, expected) => {
    expect(drinkState(window, YEAR)).toBe(expected);
  });

  it("changes on its own when the year changes (why it is never stored)", () => {
    const window = { drinkFrom: 2020, drinkTo: 2027 };
    expect(drinkState(window, 2026)).toBe("soon");
    expect(drinkState(window, 2027)).toBe("now");
    expect(drinkState(window, 2028)).toBe("past");
  });
});
