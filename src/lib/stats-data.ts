import { createClient } from "@/lib/supabase/server";
import type { Db } from "./fridges";
import type { StatBottle, StatRating } from "./stats";

/** Every bottle ever (drunk ones too, for the pace and the year summary) and the ratings of one cellar. */
export async function getStatsData(cellarId: string, db?: Db): Promise<{ bottles: StatBottle[]; ratings: StatRating[] }> {
  const supabase = db ?? (await createClient());
  const [bottlesRes, ratingsRes] = await Promise.all([
    supabase
      .from("bottles")
      .select(
        "id, status, added_on, consumed_on, bottle_prices(paid, regular), wine_vintages(id, year, drink_from, drink_to, peak_from, peak_to, wines(id, winery, name, type, country, grape))",
      )
      .eq("cellar_id", cellarId),
    supabase.from("ratings").select("wine_id, vintage_id, score").eq("cellar_id", cellarId),
  ]);
  if (bottlesRes.error || ratingsRes.error) throw new Error("Could not load stats");

  const one = <T,>(x: T | T[] | null | undefined): T | undefined => (Array.isArray(x) ? x[0] : (x ?? undefined));
  const bottles = bottlesRes.data.flatMap((b): StatBottle[] => {
    const v = b.wine_vintages;
    const w = v?.wines;
    if (!v || !w) return [];
    const price = one(b.bottle_prices as unknown as { paid: number | null; regular: number | null } | null);
    return [
      {
        id: b.id,
        status: b.status,
        addedOn: b.added_on,
        consumedOn: b.consumed_on,
        price: price?.regular ?? price?.paid ?? null,
        wineId: w.id,
        vintageId: v.id,
        title: `${w.winery} – ${w.name}`,
        year: v.year,
        type: w.type,
        country: w.country ?? "",
        grape: w.grape ?? "",
        drinkFrom: v.drink_from,
        drinkTo: v.drink_to,
        peakFrom: v.peak_from,
        peakTo: v.peak_to,
      },
    ];
  });

  // Shared and personal scores of the same wine/vintage become one average.
  const grouped = new Map<string, StatRating & { all: number[] }>();
  for (const r of ratingsRes.data) {
    const key = `${r.wine_id}|${r.vintage_id}`;
    const g = grouped.get(key) ?? { wineId: r.wine_id, vintageId: r.vintage_id, score: 0, all: [] };
    g.all.push(Number(r.score));
    grouped.set(key, g);
  }
  const ratings = [...grouped.values()].map(({ all, ...r }) => ({ ...r, score: all.reduce((a, b) => a + b, 0) / all.length }));
  return { bottles, ratings };
}
