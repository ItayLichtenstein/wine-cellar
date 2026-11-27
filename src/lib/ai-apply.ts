// Applying an AI's change to the cellar: the same database calls whether a
// person approves a draft on the site (browser client) or an AI with edit
// rights makes it itself (MCP server, the user's own token). One code path,
// so both follow the same rules (ADR 0013).

import { attachDraftImage } from "./draft-image";
import { resolvePlaces } from "./draft-places";
import type { ActionDraft, BottleDraft } from "./drafts";
import type { Db, FridgeView } from "./fridges";

export type AddResult = { ok: true; bottleIds: string[]; placed: number } | { ok: false };

/**
 * A bottle draft becomes bottles, each in the place the AI gave it when it
 * exists and is free (`taken` is shared across a batch); otherwise outside
 * the fridge. Grape/country/region only for a wine new to the cellar, so
 * nothing the user entered is overwritten.
 */
export async function applyAdd(db: Db, cellarId: string, fridges: FridgeView[], d: BottleDraft, taken: Set<string>): Promise<AddResult> {
  const { data: existing } = await db.from("wines").select("id").eq("cellar_id", cellarId).ilike("winery", d.winery).ilike("name", d.name).limit(1);
  const places = resolvePlaces(fridges, d.places, taken);
  const call = (withPlaces: typeof places) =>
    db.rpc("add_bottles", {
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
  if (res.error || !res.data?.length) return { ok: false };

  if (!existing?.length && (d.grape || d.country || d.region)) {
    const { data: v } = await db.from("bottles").select("vintage_id, wine_vintages(wine_id)").eq("id", res.data[0]).single();
    if (v?.wine_vintages) {
      await db.rpc("update_wine_details", {
        p_wine_id: v.wine_vintages.wine_id,
        p_vintage_id: v.vintage_id,
        p_grape: d.grape,
        p_country: d.country,
        p_region: d.region,
        p_kosher: "unknown",
        p_shape: "standard",
        // The generated types don't mark these as nullable; the function accepts null.
        p_alcohol: null as unknown as number,
        p_peak_from: null as unknown as number,
        p_peak_to: null as unknown as number,
        p_window_source: null as unknown as "critic",
        p_critics: [],
      });
    }
  }
  await attachDraftImage(db, res.data[0], d.image);
  return { ok: true, bottleIds: res.data, placed };
}

/** What a bottle looked like before a change: enough to put it back. */
async function before(db: Db, bottleId: string) {
  const { data } = await db.from("bottles").select("status, zone_id, slot").eq("id", bottleId).single();
  return data;
}

export type ActionResult = { ok: true; undo: Record<string, unknown> } | { ok: false };

const today = () => new Date().toLocaleDateString("en-CA");

/** "We drank it": the bottle leaves the cellar, with a tasting (and the score, on the wine and vintage). */
export async function applyDrink(db: Db, bottleId: string, a: Extract<ActionDraft, { kind: "drink" }>): Promise<ActionResult> {
  const was = await before(db, bottleId);
  const { data: v } = await db.from("bottles").select("vintage_id, wine_vintages(wine_id)").eq("id", bottleId).single();
  const { data: tasting, error } = await db.rpc("drink_bottle", { p_bottle_id: bottleId, p_tasted_on: a.date ?? today(), p_notes: a.notes || undefined });
  if (error || !was) return { ok: false };
  if (a.score !== null && v?.wine_vintages) {
    await db.rpc("set_rating", { p_wine_id: v.wine_vintages.wine_id, p_score: a.score, p_vintage_id: v.vintage_id });
  }
  return { ok: true, undo: { bottle: bottleId, tasting, status: was.status, zone_id: was.zone_id, slot: was.slot } };
}

/** Moves a bottle to a free place (target already checked by resolvePlaces). */
export async function applyMove(db: Db, bottleId: string, target: { zoneId: string; slot: number | null }): Promise<ActionResult> {
  const was = await before(db, bottleId);
  const { error } = await db.rpc("move_bottle", { p_bottle_id: bottleId, p_zone_id: target.zoneId, p_slot: target.slot ?? undefined });
  if (error || !was) return { ok: false };
  return { ok: true, undo: { bottle: bottleId, zone_id: was.zone_id, slot: was.slot } };
}
