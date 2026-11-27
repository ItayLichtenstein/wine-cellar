"use client";

import { applyAdd } from "@/lib/ai-apply";
import type { BottleDraft } from "@/lib/drafts";
import type { FridgeView } from "@/lib/fridges";
import { createClient } from "@/lib/supabase/client";

export type ApproveResult = { bottles: number; placed: number; failed: number };

/**
 * "Approve all": every pending draft becomes bottles, each in the place the
 * AI gave it when that place exists and is free (one batch never gives a
 * slot twice); otherwise it waits outside the fridge. Same database calls
 * as the add form, so the same rules apply.
 *
 * Extra details (grape, country, region) are written only for a wine that
 * is new to the cellar, so approving never overwrites what you entered
 * yourself on a wine you already had.
 */
export async function approveAll(
  cellarId: string,
  fridges: FridgeView[],
  drafts: { id: string; draft: BottleDraft }[],
): Promise<ApproveResult> {
  const supabase = createClient();
  const taken = new Set<string>();
  const result: ApproveResult = { bottles: 0, placed: 0, failed: 0 };

  for (const { id, draft: d } of drafts) {
    const r = await applyAdd(supabase, cellarId, fridges, d, taken);
    if (!r.ok) {
      result.failed++;
      continue;
    }
    result.bottles += r.bottleIds.length;
    result.placed += r.placed;
    await supabase.from("drafts").update({ status: "approved", decided_at: new Date().toISOString() }).eq("id", id);
  }
  return result;
}
