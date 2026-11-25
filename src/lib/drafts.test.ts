import { describe, expect, it } from "vitest";
import { buildPrompt, parseAiAnswer, parseBottleDraft } from "./drafts";

describe("parseBottleDraft", () => {
  it("accepts a forgiving shape: other key names, numbers as text, Hebrew type, NV", () => {
    const r = parseBottleDraft({ producer: "Yatir", wine: "Forest", סוג: "אדום", vintage: "NV", count: "2", price: "₪180" }, 2026);
    expect(r).toMatchObject({ ok: true, draft: { winery: "Yatir", name: "Forest", type: "red", year: null, quantity: 2, price: 180 } });
  });

  it("explains how to fix a missing name", () => {
    expect(parseBottleDraft({ winery: "Yatir" }, 2026)).toEqual({ ok: false, error: expect.stringContaining('"name"') });
  });

  it("rejects an unknown type, a future vintage and a backwards window", () => {
    expect(parseBottleDraft({ winery: "a", name: "b", type: "beer" }, 2026).ok).toBe(false);
    expect(parseBottleDraft({ winery: "a", name: "b", year: 2031 }, 2026).ok).toBe(false);
    expect(parseBottleDraft({ winery: "a", name: "b", drink_from: 2030, drink_to: 2025 }, 2026).ok).toBe(false);
  });

  it("caps text length", () => {
    const r = parseBottleDraft({ winery: "a".repeat(500), name: "b" }, 2026);
    expect(r.ok && r.draft.winery.length).toBe(120);
  });
});

describe("parseAiAnswer", () => {
  it("finds the JSON inside prose and a code fence, and keeps the good items", () => {
    const answer = 'Here you go:\n```json\n[{"winery":"Yatir","name":"Forest","year":2019},{"winery":"x"}]\n```\nEnjoy!';
    const r = parseAiAnswer(answer, 2026);
    expect(r.drafts).toHaveLength(1);
    expect(r.errors).toEqual([expect.stringMatching(/^בקבוק 2 לא נקלט/)]);
  });

  it("accepts {bottles: [...]} and a single object", () => {
    expect(parseAiAnswer('{"bottles":[{"winery":"a","name":"b"}]}', 2026).drafts).toHaveLength(1);
    expect(parseAiAnswer('{"winery":"a","name":"b"}', 2026).drafts).toHaveLength(1);
  });

  it("says when there is no JSON", () => {
    expect(parseAiAnswer("I could not read the label", 2026).errors).toHaveLength(1);
  });
});

describe("buildPrompt", () => {
  const cellar = [{ title: "Yatir – Forest", year: 2019, count: 2, state: "בשיא", where: "מדף 1" }];
  it("includes the cellar and the answer format", () => {
    const p = buildPrompt("add", cellar, "");
    expect(p).toContain("Yatir – Forest 2019 ×2");
    expect(p).toContain('"winery"');
  });
  it("the drink prompt carries the occasion", () => {
    expect(buildPrompt("drink", cellar, "ארוחה איטלקית")).toContain("ארוחה איטלקית");
  });
});
