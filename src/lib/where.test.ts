import { describe, expect, it } from "vitest";
import { whereLabel } from "./where";

describe("whereLabel", () => {
  it("names the shelf in either language", () => {
    expect(whereLabel("stored", 2, "he")).toBe("מדף 2");
    expect(whereLabel("stored", 2, "en")).toBe("Shelf 2");
  });
  it("covers bottles outside the fridge", () => {
    expect(whereLabel("stored", null, "en")).toBe("In the fridge");
    expect(whereLabel("unplaced", null, "he")).toBe("מחוץ למקרר");
    expect(whereLabel("in_transit", null, "en")).toBe("On its way");
  });
});
