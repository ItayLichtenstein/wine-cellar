import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/database.types";
import { EMPTY_EXTRA, type WineExtra } from "@/lib/wine-extra";

export type WineType = Database["public"]["Enums"]["wine_type"];

/** Everything the bottle card shows, flattened from wine → vintage → bottle. */
export type BottleDetails = {
  id: string;
  status: string;
  wineId: string;
  vintageId: string;
  winery: string;
  name: string;
  type: WineType;
  year: number | null;
  drinkFrom: number | null;
  drinkTo: number | null;
  peakFrom: number | null;
  peakTo: number | null;
  paid: number | null;
  regular: number | null;
  isGift: boolean;
  note: string;
  vintageRating: number | null;
  wineRating: number | null;
  /** Grape, country, critics, link… (the "more details" part of the forms). */
  extra: WineExtra;
  /** Years of every bottle of this wine still in the cellar (this one included). */
  wineYears: (number | null)[];
  cellarId: string;
  /** Path of the wine's label photo in the private "labels" bucket. */
  labelPath: string | null;
};

export const WINE_TYPES: { value: WineType; label: string; other?: true }[] = [
  { value: "red", label: "אדום" },
  { value: "white", label: "לבן" },
  { value: "rose", label: "רוזה" },
  { value: "orange", label: "כתום", other: true },
  { value: "sparkling", label: "מבעבע", other: true },
  { value: "dessert", label: "קינוח", other: true },
  { value: "fortified", label: "מחוזק (פורט, שרי)", other: true },
  { value: "other", label: "אחר", other: true },
];

export const inputClass = "rounded-lg border border-muted/40 bg-surface px-3 py-2 text-base";

/** Price as in the old app: "₪110 (₪90)" for a deal, "₪250 · מתנה" for a gift. */
export function formatPrice(d: Pick<BottleDetails, "paid" | "regular" | "isGift">): string {
  const nis = (n: number) => `₪${n.toLocaleString("he-IL", { maximumFractionDigits: 1 })}`;
  if (d.isGift) return d.regular ? `${nis(d.regular)} · מתנה` : "מתנה";
  if (d.regular && d.paid !== null && d.paid !== d.regular) return `${nis(d.regular)} (${nis(d.paid)})`;
  if (d.paid !== null) return nis(d.paid);
  if (d.regular) return nis(d.regular);
  return "—";
}

/** Loads one bottle with its wine, vintage, price and the household's ratings. */
export async function loadBottleDetails(bottleId: string): Promise<BottleDetails> {
  const supabase = createClient();
  const { data: b, error } = await supabase
    .from("bottles")
    .select(
      "id, status, note, link_url, bottle_prices(paid, regular, is_gift), wine_vintages(id, year, drink_from, drink_to, peak_from, peak_to, alcohol, window_source, wine_id, critic_scores(critic, score), wines(winery, name, type, grape, country, region, kosher, shape, cellar_id, label_image_path))",
    )
    .eq("id", bottleId)
    .single();
  if (error || !b.wine_vintages) throw new Error("not found");

  const v = b.wine_vintages;
  const [{ data: ratings }, { data: siblings }] = await Promise.all([
    supabase.from("ratings").select("score, vintage_id").eq("wine_id", v.wine_id).is("rater_id", null),
    supabase
      .from("bottles")
      .select("wine_vintages!inner(year, wine_id)")
      .eq("wine_vintages.wine_id", v.wine_id)
      .neq("status", "consumed"),
  ]);

  // One price per bottle, but the composite foreign key makes the generated
  // type a list – accept both shapes.
  const prices = b.bottle_prices as unknown;
  const price = (Array.isArray(prices) ? prices[0] : prices) as
    | { paid: number | null; regular: number | null; is_gift: boolean }
    | null
    | undefined;

  return {
    id: b.id,
    status: b.status,
    wineId: v.wine_id,
    vintageId: v.id,
    winery: v.wines?.winery ?? "",
    name: v.wines?.name ?? "",
    type: v.wines?.type ?? "red",
    year: v.year,
    drinkFrom: v.drink_from,
    drinkTo: v.drink_to,
    peakFrom: v.peak_from,
    peakTo: v.peak_to,
    paid: price?.paid ?? null,
    regular: price?.regular ?? null,
    isGift: price?.is_gift ?? false,
    note: b.note ?? "",
    vintageRating: ratings?.find((r) => r.vintage_id === v.id)?.score ?? null,
    wineRating: ratings?.find((r) => r.vintage_id === null)?.score ?? null,
    extra: {
      ...EMPTY_EXTRA,
      grape: v.wines?.grape ?? "",
      country: v.wines?.country ?? "",
      region: v.wines?.region ?? "",
      kosher: v.wines?.kosher ?? "unknown",
      shape: v.wines?.shape ?? "standard",
      alcohol: v.alcohol !== null ? String(v.alcohol) : "",
      peakFrom: v.peak_from ? String(v.peak_from) : "",
      peakTo: v.peak_to ? String(v.peak_to) : "",
      windowSource: v.window_source ?? "",
      critics: v.critic_scores ?? [],
      link: b.link_url ?? "",
    },
    wineYears: (siblings ?? []).map((x) => x.wine_vintages.year),
    cellarId: v.wines?.cellar_id ?? "",
    labelPath: v.wines?.label_image_path ?? null,
  };
}

const intOrNull = (s: string) => (s.trim() === "" ? null : Number(s));

/**
 * Saves the "more details" part: wine + vintage fields and critics in one
 * transaction (update_wine_details), then the link on the given bottles.
 */
export async function saveExtra(wineId: string, vintageId: string, bottleIds: string[], e: WineExtra): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase.rpc("update_wine_details", {
    p_wine_id: wineId,
    p_vintage_id: vintageId,
    p_grape: e.grape,
    p_country: e.country,
    p_region: e.region,
    p_kosher: e.kosher,
    p_shape: e.shape,
    // The generated types don't mark these as nullable; the function accepts null.
    p_alcohol: intOrNull(e.alcohol) as number,
    p_peak_from: intOrNull(e.peakFrom) as number,
    p_peak_to: intOrNull(e.peakTo) as number,
    p_window_source: (e.windowSource || null) as WindowSourceDb,
    p_critics: e.critics.map((c) => ({ critic: c.critic.trim(), score: c.score })),
  });
  if (error) return false;
  const { error: linkError } = await supabase
    .from("bottles")
    .update({ link_url: e.link.trim() || null })
    .in("id", bottleIds);
  return !linkError;
}

type WindowSourceDb = Database["public"]["Enums"]["window_source"];
