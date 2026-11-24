import { describe, expect, it } from "vitest";
import { safeNextPath } from "./safe-redirect";

describe("safeNextPath", () => {
  it.each([
    [null, "/"],
    [undefined, "/"],
    ["", "/"],
    ["/", "/"],
    ["/fridge", "/fridge"],
    ["/a?b=1#c", "/a?b=1#c"],
    ["/ok/../x", "/ok/../x"],
    ["/%2F%2Fevil.com", "/%2F%2Fevil.com"], // encoded slashes stay a local path
  ])("keeps a same-site path: %j -> %j", (input, expected) => {
    expect(safeNextPath(input)).toBe(expected);
  });

  // Known open-redirect tricks. Every one must fall back to "/".
  it.each([
    "https://evil.com",
    "evil.com",
    "//evil.com",
    "///evil.com",
    "/\\evil.com",
    "\\\\evil.com",
    "javascript:alert(1)",
    "/\tevil",
    "/\n//evil.com",
  ])("blocks %j", (input) => {
    expect(safeNextPath(input)).toBe("/");
  });
});
