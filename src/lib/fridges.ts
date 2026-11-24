import { createClient } from "@/lib/supabase/server";
import type { Shelf, ZoneKind } from "@/lib/fridge-layout";

export type FridgeSummary = {
  id: string;
  name: string;
  brand: string | null;
  model: string | null;
  shelves: Shelf[];
};

/**
 * The fridges of the signed-in user's cellar, with their layout.
 * No cellar filter is needed here: RLS only returns the user's own rows.
 */
export async function getMyFridges(): Promise<FridgeSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("fridges")
    .select("id, name, brand, model, position, shelves(position, shelf_zones(position, kind, capacity, label))")
    .order("position");

  if (error) throw new Error("Could not load fridges");

  return (data ?? []).map((f) => ({
    id: f.id,
    name: f.name,
    brand: f.brand,
    model: f.model,
    shelves: [...f.shelves]
      .sort((a, b) => a.position - b.position)
      .map((s) => ({
        zones: [...s.shelf_zones]
          .sort((a, b) => a.position - b.position)
          .map((z) => ({ kind: z.kind as ZoneKind, capacity: z.capacity, label: z.label ?? "" })),
      })),
  }));
}
