import type { SupabaseClient } from "@supabase/supabase-js";
import type { Locale } from "@/i18n/locales";
import { whereLabel } from "./where";
import type { Database } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";

/** A database client: the signed-in user's (default) or an AI's token (MCP). */
export type Db = SupabaseClient<Database>;
import type { ZoneKind } from "@/lib/fridge-layout";
import { drinkState, type DrinkState } from "@/lib/drink-state";
import { shownScore } from "@/lib/shown-score";

/** A bottle sitting in a zone (a slot number in a row, none in a stack). */
export type PlacedBottle = {
  id: string;
  slot: number | null;
  year: number | null;
  state: DrinkState;
  title: string; // "יקב – שם"
  label: string; // the labels view without a photo: the wine's name, as the user wrote it
  thumb: string | null; // the label photo, ~4KB data: URL (wines.label_thumb)
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
 * The fridges of a cellar: layout plus the bottles in it. The cellar filter
 * says which cellar we want; RLS says whether we may (ADR 0008).
 */
export async function getFridges(cellarId: string, db?: Db): Promise<FridgeView[]> {
  const supabase = db ?? (await createClient());

  const [fridgesRes, bottlesRes] = await Promise.all([
    supabase
      .from("fridges")
      .select("id, name, brand, model, position, shelves(id, position, shelf_zones(id, position, kind, capacity, label))")
      .eq("cellar_id", cellarId)
      .order("position")
      .order("created_at"), // ties (equal positions) keep a stable order
    supabase
      .from("bottles")
      .select("id, zone_id, slot, wine_vintages(year, drink_from, drink_to, peak_from, peak_to, wines(winery, name, label_thumb))")
      .eq("cellar_id", cellarId)
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
      thumb: v.wines?.label_thumb ?? null,
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
export async function getWineNames(cellarId: string): Promise<{ winery: string; name: string }[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("wines").select("winery, name").eq("cellar_id", cellarId).order("winery");
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

export async function getLooseBottles(cellarId: string): Promise<LooseBottle[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bottles")
    .select("id, status, wine_vintages(year, drink_from, drink_to, peak_from, peak_to, wines(winery, name))")
    .eq("cellar_id", cellarId)
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
export async function getCellarBottles(cellarId: string, db?: Db, locale: Locale = "he"): Promise<import("./bottle-list").ListBottle[]> {
  const supabase = db ?? (await createClient());
  const { data, error } = await supabase
    .from("bottles")
    .select(
      "id, status, bottle_prices(paid, regular), shelf_zones(shelves(position)), wine_vintages(id, year, drink_from, drink_to, peak_from, peak_to, wines(winery, name, type, country, kosher, shape))",
    )
    .eq("cellar_id", cellarId)
    .neq("status", "consumed");
  if (error) throw new Error("Could not load bottles");

  const year = new Date().getFullYear();

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
        where: whereLabel(status, shelf?.position, locale),
      },
    ];
  });
}

export type HistoryEntry = {
  id: string;
  tastedOn: string; // YYYY-MM-DD
  wineId: string | null; // null in the guest view (no wine pages there)
  title: string;
  year: number | null;
  place: string;
  notes: string;
  score: number | null; // the household's rating of that wine (or vintage), out of 5
};

/** Bottles we drank, newest first. */
export async function getHistory(cellarId: string, db?: Db): Promise<HistoryEntry[]> {
  const supabase = db ?? (await createClient());
  const [tastings, ratings] = await Promise.all([
    supabase
      .from("tastings")
      .select("id, tasted_on, place, notes, wine_id, vintage_id, wine_vintages(year), wines(winery, name)")
      .eq("cellar_id", cellarId)
      .order("tasted_on", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase.from("ratings").select("wine_id, vintage_id, score").eq("cellar_id", cellarId),
  ]);
  if (tastings.error || ratings.error) throw new Error("Could not load history");
  const scores = ratings.data.map((r) => ({ wineId: r.wine_id, vintageId: r.vintage_id, score: r.score }));
  return tastings.data.map((t) => ({
    id: t.id,
    tastedOn: t.tasted_on,
    wineId: t.wine_id,
    title: t.wines ? `${t.wines.winery} – ${t.wines.name}` : "",
    year: t.wine_vintages?.year ?? null,
    place: t.place ?? "",
    notes: t.notes ?? "",
    score: shownScore(scores, t.wine_id, t.vintage_id),
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

/** One wine of a cellar with all its vintages, ratings and history. */
export async function getWine(cellarId: string, id: string): Promise<WinePage | null> {
  const supabase = await createClient();
  const { data: w } = await supabase
    .from("wines")
    .select(
      "id, winery, name, type, grape, country, region, label_image_path, wine_vintages(id, year, drink_from, drink_to, peak_from, peak_to, bottles(id, status)), ratings(score, vintage_id, profiles(display_name)), tastings(id, tasted_on, place, notes, vintage_id)",
    )
    .eq("id", id)
    .eq("cellar_id", cellarId)
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
