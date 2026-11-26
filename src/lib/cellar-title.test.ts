import { describe, expect, it } from "vitest";
import { cellarTitle } from "./cellar-title";

describe("cellarTitle", () => {
  it("one, two and three members", () => {
    expect(cellarTitle(["נועה"])).toBe("המרתף של נועה");
    expect(cellarTitle(["נועה", "יונתן"])).toBe("המרתף של נועה ויונתן");
    expect(cellarTitle(["נועה", "יונתן", "מאיה"])).toBe("המרתף של נועה, יונתן ומאיה");
  });
  it("a non-Hebrew name gets a maqaf after the 'and'", () => {
    expect(cellarTitle(["נועה", "Maya"])).toBe("המרתף של נועה ו־Maya");
  });
  it("falls back to the app name", () => {
    expect(cellarTitle([])).toBe("מרתף יין");
    expect(cellarTitle([" "])).toBe("מרתף יין");
  });
});

describe("cellarTitle with a custom name", () => {
  it("the cellar's own name wins; blank falls back", async () => {
    const { cellarTitle } = await import("./cellar-title");
    expect(cellarTitle(["נועה"], "הבית ברחובות")).toBe("הבית ברחובות");
    expect(cellarTitle(["נועה"], "  ")).toBe("המרתף של נועה");
    expect(cellarTitle(["נועה"], null)).toBe("המרתף של נועה");
  });
});

describe("cellarTitle in English", () => {
  it("one, two and three members", () => {
    expect(cellarTitle(["Noa"], null, "en")).toBe("Noa's cellar");
    expect(cellarTitle(["Noa", "Yonatan"], null, "en")).toBe("Noa and Yonatan's cellar");
    expect(cellarTitle(["Noa", "Yonatan", "Maya"], null, "en")).toBe("Noa, Yonatan and Maya's cellar");
  });
  it("falls back to the app name, and a custom name wins", () => {
    expect(cellarTitle([], null, "en")).toBe("Wine Cellar");
    expect(cellarTitle(["Noa"], "The bunker", "en")).toBe("The bunker");
  });
});
