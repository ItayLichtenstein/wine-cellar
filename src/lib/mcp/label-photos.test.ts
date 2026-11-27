import { describe, expect, it } from "vitest";
import { formatLabelPhotos, labelKind, missingNote, savedNote } from "./label-photos";

const site = "https://cellar.example";

describe("savedNote", () => {
  it("an exact match is just saved", () => {
    expect(savedNote("Yatir – Forest", "exact", site)).toBe("Yatir – Forest: label image saved.");
  });
  it("another vintage tells the AI what to say and where to replace it", () => {
    const n = savedNote("Yatir – Forest", "other_vintage", site);
    expect(n).toContain("another vintage");
    expect(n).toContain("Tell the user plainly");
    expect(n).toContain(`${site}/labels`);
  });
  it("a similar label is flagged too", () => {
    expect(savedNote("X", "similar", site)).toContain("not sure");
  });
});

describe("missingNote", () => {
  it("is empty when nothing is missing", () => {
    expect(missingNote(0, site)).toBe("");
  });
  it("points to the label photos page", () => {
    expect(missingNote(3, site)).toContain(`3 wine(s)`);
    expect(missingNote(3, site)).toContain(`${site}/labels`);
  });
});

describe("labelKind", () => {
  it("tells none, the user's own and the web apart by the path", () => {
    expect(labelKind(null)).toBe("none");
    expect(labelKind("c1/w1-123.webp")).toBe("own");
    expect(labelKind("c1/web-abc.webp")).toBe("web");
  });
});

describe("formatLabelPhotos", () => {
  const wines = [
    { winery: "Yatir", name: "Forest", label_image_path: "c1/web-1.webp" },
    { winery: "Yatir", name: "Petit Verdot", label_image_path: null },
    { winery: "Castel", name: "Grand Vin", label_image_path: "c1/w-1.webp" },
  ];
  it("lists the matching wines with where their photo came from", () => {
    const out = formatLabelPhotos(wines, "yatir", site);
    expect(out).toContain("Yatir – Forest: from the web");
    expect(out).toContain("Yatir – Petit Verdot: none yet");
    expect(out).not.toContain("Castel");
  });
  it("says nothing when no wine matches", () => {
    expect(formatLabelPhotos(wines, "zzz", site)).toBe("");
  });
});
