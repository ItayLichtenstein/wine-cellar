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
