"use client";

import { EMPTY_EXTRA } from "@/lib/wine-extra";
import { resolvePlaces } from "@/lib/draft-places";
import type { BottleDraft } from "@/lib/drafts";
import type { FridgeView } from "@/lib/fridges";
import { createClient } from "@/lib/supabase/client";
import { saveExtra } from "../bottle/details";

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
    const { data: existing } = await supabase
      .from("wines")
      .select("id")
      .eq("cellar_id", cellarId)
      .ilike("winery", d.winery)
      .ilike("name", d.name)
      .limit(1);
    const places = resolvePlaces(fridges, d.places, taken);
    const call = (withPlaces: typeof places) =>
      supabase.rpc("add_bottles", {
        p_winery: d.winery,
        p_name: d.name,
        p_quantity: d.quantity,
        p_type: d.type,
        p_year: d.year ?? undefined,
        p_places: withPlaces.map((p) => (p.slot === null ? { zone_id: p.zoneId } : { zone_id: p.zoneId, slot: p.slot })),
        p_rest_status: "unplaced",
        p_paid: d.price ?? undefined,
        p_drink_from: d.drinkFrom ?? undefined,
        p_drink_to: d.drinkTo ?? undefined,
      });
    let res = await call(places);
    let placed = places.length;
    // Someone took a slot a moment ago: keep the bottles, just outside the fridge.
    if (res.error?.code === "23505") {
      res = await call([]);
      placed = 0;
    }
    if (res.error || !res.data?.length) {
      result.failed++;
      continue;
    }
    result.bottles += res.data.length;
    result.placed += placed;

    if (!existing?.length && (d.grape || d.country || d.region)) {
      const { data: v } = await supabase.from("bottles").select("vintage_id, wine_vintages(wine_id)").eq("id", res.data[0]).single();
      if (v?.wine_vintages) await saveExtra(v.wine_vintages.wine_id, v.vintage_id, res.data, { ...EMPTY_EXTRA, grape: d.grape, country: d.country, region: d.region });
    }
    await supabase.from("drafts").update({ status: "approved", decided_at: new Date().toISOString() }).eq("id", id);
  }
  return result;
}
