import { createClient } from "@/lib/supabase/server";
import type { ZoneKind } from "@/lib/fridge-layout";
import { drinkState, type DrinkState } from "@/lib/drink-state";

/** A bottle sitting in a zone (a slot number in a row, none in a stack). */
export type PlacedBottle = {
  id: string;
  slot: number | null;
  year: number | null;
  state: DrinkState;
  title: string; // "יקב – שם"
};

export type ZoneView = {
  id: string;
  kind: ZoneKind;
  capacity: number;
  label: string;
  bottles: PlacedBottle[];
};

export type FridgeView = {
  id: string;
  name: string;
  brand: string | null;
  model: string | null;
  shelves: { zones: ZoneView[] }[];
};

/**
 * The fridges of the signed-in user's cellar: layout plus the bottles in it.
 * No cellar filter is needed: RLS only returns the user's own rows.
 */
export async function getMyFridges(): Promise<FridgeView[]> {
  const supabase = await createClient();

  const [fridgesRes, bottlesRes] = await Promise.all([
    supabase
      .from("fridges")
      .select("id, name, brand, model, position, shelves(position, shelf_zones(id, position, kind, capacity, label))")
      .order("position"),
    supabase
      .from("bottles")
      .select("id, zone_id, slot, wine_vintages(year, drink_from, drink_to, peak_from, peak_to, wines(winery, name))")
      .eq("status", "stored"),
  ]);
  if (fridgesRes.error || bottlesRes.error) throw new Error("Could not load fridges");

  // The year is read per request (createClient already marked it dynamic).
  const year = new Date().getFullYear();

  const byZone = new Map<string, PlacedBottle[]>();
  for (const b of bottlesRes.data) {
    const v = b.wine_vintages;
    if (!b.zone_id || !v) continue;
    const list = byZone.get(b.zone_id) ?? [];
    list.push({
      id: b.id,
      slot: b.slot,
      year: v.year,
      state: drinkState(
        { drinkFrom: v.drink_from, drinkTo: v.drink_to, peakFrom: v.peak_from, peakTo: v.peak_to },
        year,
      ),
      title: v.wines ? `${v.wines.winery} – ${v.wines.name}` : "",
    });
    byZone.set(b.zone_id, list);
  }

  return fridgesRes.data.map((f) => ({
    id: f.id,
    name: f.name,
    brand: f.brand,
    model: f.model,
    shelves: [...f.shelves]
      .sort((a, b) => a.position - b.position)
      .map((s) => ({
        zones: [...s.shelf_zones]
          .sort((a, b) => a.position - b.position)
          .map((z) => ({
            id: z.id,
            kind: z.kind as ZoneKind,
            capacity: z.capacity,
            label: z.label ?? "",
            bottles: byZone.get(z.id) ?? [],
          })),
      })),
  }));
}

/** Winery + name of every wine in the cellar, for autocomplete. */
export async function getMyWineNames(): Promise<{ winery: string; name: string }[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("wines").select("winery, name").order("winery");
  if (error) throw new Error("Could not load wines");
  return data;
}

/** How many bottles are outside the fridge / on their way. */
export async function getLooseBottleCounts(): Promise<{ unplaced: number; inTransit: number }> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("bottles").select("status").in("status", ["unplaced", "in_transit"]);
  if (error) throw new Error("Could not load bottles");
  return {
    unplaced: data.filter((b) => b.status === "unplaced").length,
    inTransit: data.filter((b) => b.status === "in_transit").length,
  };
}
