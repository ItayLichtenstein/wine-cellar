import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/database.types";

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
      "id, status, note, bottle_prices(paid, regular, is_gift), wine_vintages(id, year, drink_from, drink_to, peak_from, peak_to, wine_id, wines(winery, name, type))",
    )
    .eq("id", bottleId)
    .single();
  if (error || !b.wine_vintages) throw new Error("not found");

  const v = b.wine_vintages;
  const { data: ratings } = await supabase
    .from("ratings")
    .select("score, vintage_id")
    .eq("wine_id", v.wine_id)
    .is("rater_id", null);

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
  };
}
