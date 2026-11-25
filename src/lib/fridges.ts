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
  label: string; // short text for the labels view: the wine's name
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
  shelves: { id: string; zones: ZoneView[] }[];
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
      .select("id, name, brand, model, position, shelves(id, position, shelf_zones(id, position, kind, capacity, label))")
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
      label: v.wines?.name ?? "",
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
        id: s.id,
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

/** A bottle that is not in a fridge: outside it, or still on its way. */
export type LooseBottle = {
  id: string;
  status: "unplaced" | "in_transit";
  year: number | null;
  state: DrinkState;
  title: string;
};

export async function getLooseBottles(): Promise<LooseBottle[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bottles")
    .select("id, status, wine_vintages(year, drink_from, drink_to, peak_from, peak_to, wines(winery, name))")
    .in("status", ["unplaced", "in_transit"])
    .order("added_on", { ascending: false });
  if (error) throw new Error("Could not load bottles");

  const year = new Date().getFullYear();
  return data.map((b) => {
    const v = b.wine_vintages;
    return {
      id: b.id,
      status: b.status as LooseBottle["status"],
      year: v?.year ?? null,
      state: v
        ? drinkState({ drinkFrom: v.drink_from, drinkTo: v.drink_to, peakFrom: v.peak_from, peakTo: v.peak_to }, year)
        : "none",
      title: v?.wines ? `${v.wines.winery} – ${v.wines.name}` : "",
    };
  });
}

/** Every bottle still in the cellar (stored, outside the fridge, on its way), for the list page. */
export async function getCellarBottles(): Promise<import("./bottle-list").ListBottle[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bottles")
    .select(
      "id, status, bottle_prices(paid, regular), shelf_zones(shelves(position)), wine_vintages(id, year, drink_from, drink_to, peak_from, peak_to, wines(winery, name, type, country, kosher, shape))",
    )
    .neq("status", "consumed");
  if (error) throw new Error("Could not load bottles");

  const year = new Date().getFullYear();
  const WHERE = { unplaced: "מחוץ למקרר", in_transit: "בדרך אלינו" } as const;

  return data.flatMap((b) => {
    const v = b.wine_vintages;
    const w = v?.wines;
    if (!v || !w) return [];
    // One-to-one joins over composite foreign keys may come back as a list.
    const one = <T,>(x: T | T[] | null | undefined): T | undefined => (Array.isArray(x) ? x[0] : (x ?? undefined));
    const price = one(b.bottle_prices as unknown as { paid: number | null; regular: number | null } | null);
    const shelf = one(one(b.shelf_zones as unknown as { shelves: { position: number } | null } | null)?.shelves);
    const status = b.status as "stored" | "unplaced" | "in_transit";
    return [
      {
        id: b.id,
        status,
        vintageId: v.id,
        winery: w.winery,
        name: w.name,
        type: w.type,
        year: v.year,
        country: w.country ?? "",
        kosher: w.kosher,
        shape: w.shape,
        state: drinkState({ drinkFrom: v.drink_from, drinkTo: v.drink_to, peakFrom: v.peak_from, peakTo: v.peak_to }, year),
        drinkBy: v.peak_to ?? v.drink_to,
        price: price?.regular ?? price?.paid ?? null,
        where: status === "stored" ? (shelf ? `מדף ${shelf.position}` : "במקרר") : WHERE[status],
      },
    ];
  });
}

export type HistoryEntry = {
  id: string;
  tastedOn: string; // YYYY-MM-DD
  title: string;
  year: number | null;
  place: string;
  notes: string;
};

/** Bottles we drank, newest first. */
export async function getHistory(): Promise<HistoryEntry[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tastings")
    .select("id, tasted_on, place, notes, wine_vintages(year), wines(winery, name)")
    .order("tasted_on", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error("Could not load history");
  return data.map((t) => ({
    id: t.id,
    tastedOn: t.tasted_on,
    title: t.wines ? `${t.wines.winery} – ${t.wines.name}` : "",
    year: t.wine_vintages?.year ?? null,
    place: t.place ?? "",
    notes: t.notes ?? "",
  }));
}

export type WinePage = {
  id: string;
  winery: string;
  name: string;
  type: string;
  grape: string;
  country: string;
  region: string;
  labelPath: string | null;
  vintages: {
    id: string;
    year: number | null;
    state: DrinkState;
    drinkFrom: number | null;
    drinkTo: number | null;
    inCellar: number;
    drunk: number;
    firstBottleId: string | null; // to open a bottle card from the page
  }[];
  ratings: { score: number; year: number | null; rater: string | null }[];
  tastings: { id: string; tastedOn: string; year: number | null; place: string; notes: string }[];
};

/** One wine with all its vintages, ratings and history (RLS: own cellar only). */
export async function getWine(id: string): Promise<WinePage | null> {
  const supabase = await createClient();
  const { data: w } = await supabase
    .from("wines")
    .select(
      "id, winery, name, type, grape, country, region, label_image_path, wine_vintages(id, year, drink_from, drink_to, peak_from, peak_to, bottles(id, status)), ratings(score, vintage_id, profiles(display_name)), tastings(id, tasted_on, place, notes, vintage_id)",
    )
    .eq("id", id)
    .maybeSingle();
  if (!w) return null;

  const year = new Date().getFullYear();
  const yearOf = new Map(w.wine_vintages.map((v) => [v.id, v.year]));
  return {
    id: w.id,
    winery: w.winery,
    name: w.name,
    type: w.type,
    grape: w.grape ?? "",
    country: w.country ?? "",
    region: w.region ?? "",
    labelPath: w.label_image_path,
    vintages: [...w.wine_vintages]
      .sort((a, b) => (b.year ?? -Infinity) - (a.year ?? -Infinity))
      .map((v) => {
        const open = v.bottles.filter((b) => b.status !== "consumed");
        return {
          id: v.id,
          year: v.year,
          state: drinkState({ drinkFrom: v.drink_from, drinkTo: v.drink_to, peakFrom: v.peak_from, peakTo: v.peak_to }, year),
          drinkFrom: v.drink_from,
          drinkTo: v.drink_to,
          inCellar: open.length,
          drunk: v.bottles.length - open.length,
          firstBottleId: open[0]?.id ?? v.bottles[0]?.id ?? null,
        };
      }),
    ratings: w.ratings.map((r) => ({
      score: r.score,
      year: r.vintage_id ? (yearOf.get(r.vintage_id) ?? null) : null,
      rater: r.profiles?.display_name ?? null,
    })),
    tastings: [...w.tastings]
      .sort((a, b) => b.tasted_on.localeCompare(a.tasted_on))
      .map((t) => ({
        id: t.id,
        tastedOn: t.tasted_on,
        year: t.vintage_id ? (yearOf.get(t.vintage_id) ?? null) : null,
        place: t.place ?? "",
        notes: t.notes ?? "",
      })),
  };
}
