import { describe, expect, it } from "vitest";
import { zoneLabel } from "./zone-label";

describe("zoneLabel", () => {
  it("translates the stored Hebrew names in English", () => {
    expect(zoneLabel("אחורי", "en")).toBe("Back");
    expect(zoneLabel("שכבה עליונה", "en")).toBe("Top layer");
  });
  it("keeps Hebrew as is, and a typed name in both", () => {
    expect(zoneLabel("אחורי", "he")).toBe("אחורי");
    expect(zoneLabel("Magnums", "en")).toBe("Magnums");
  });
});
