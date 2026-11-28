import { describe, expect, it } from "vitest";
import { mergeSameAi } from "./ai-merge";

const row = (id: string, key: "gemini" | "claude" | null, since: string, canEdit = true) => ({ clientIds: [id], name: key ?? "AI", key, since, canEdit });

describe("mergeSameAi", () => {
  it("shows Gemini connected twice as one row, from the earlier date", () => {
    const out = mergeSameAi([row("g1", "gemini", "2026-11-28T10:00"), row("c", "claude", "2026-11-27"), row("g2", "gemini", "2026-11-28T09:00", false)]);
    expect(out.map((a) => a.clientIds)).toEqual([["g1", "g2"], ["c"]]);
    expect(out[0]).toMatchObject({ since: "2026-11-28T09:00", canEdit: false });
  });
  it("keeps unknown AIs apart", () => {
    expect(mergeSameAi([row("a", null, "x"), row("b", null, "y")])).toHaveLength(2);
  });
});
