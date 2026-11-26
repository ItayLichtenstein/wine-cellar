/**
 * Imports a cellar export from the old single-file app into Wine Cellar.
 *
 *   node --experimental-strip-types scripts/import-old-app.ts <export.html>
 *
 * Signs in as a user (default: the local test user from supabase/seed.sql)
 * and writes through the normal API, so RLS applies exactly as in the app.
 * The export holds personal data: this script never prints its contents.
 *
 * Target and identity: see scripts/import-target.ts (local by default;
 * production as yourself, via .env.import.local).
 */
import { readFileSync } from "node:fs";
import { connect } from "./import-target.ts";

// ---------- Old app format (only the fields we use) ----------

type OldBottle = {
  status: "cellar" | "consumed";
  winery?: string;
  name?: string;
  type?: string;
  vintage?: number | null;
  country?: string;
  region?: string;
  grape?: string;
  alcohol?: string;
  kosher?: string;
  shape?: string;
  drinkFrom?: number;
  drinkTo?: number;
  peakFrom?: number;
  peakTo?: number;
  windowSource?: string;
  parker?: string;
  price?: number;
  listPrice?: number;
  priceNote?: string;
  priceUrl?: string;
  wineryUrl?: string;
  notes?: string;
  tasting?: string;
  buyAgain?: string;
  myRating?: string;
  consumedAt?: string;
  shelf?: number;
  row?: "f" | "b" | "x";
  slot?: number;
};
type OldShelf = { front: number; back: number; extra?: number };
type Snapshot = { date: string; bottles: OldBottle[]; config: { shelves: OldShelf[] } };

// ---------- Helpers ----------

function readSnapshot(path: string): Snapshot {
  const html = readFileSync(path, "utf8");
  const marker = "window.CELLAR_SNAPSHOT=";
  const start = html.indexOf(marker);
  if (start < 0) throw new Error("Not an export file: CELLAR_SNAPSHOT not found");
  const end = html.indexOf("</script>", start);
  const json = html.slice(start + marker.length, end).trim().replace(/;$/, "");
  return JSON.parse(json) as Snapshot;
}

const cut = (s: string | undefined, max: number) => (s ? s.trim().slice(0, max) : null);
const key = (b: OldBottle) => `${(b.winery ?? "").trim().toLowerCase()}|${(b.name ?? "").trim().toLowerCase()}`;
const first = <T>(xs: OldBottle[], f: (b: OldBottle) => T | undefined | null) =>
  xs.map(f).find((v) => v !== undefined && v !== null && v !== "") ?? null;

const TYPES = new Set(["red", "white", "rose", "orange", "sparkling", "dessert", "fortified", "other"]);
const wineType = (t?: string) => (t && TYPES.has(t) ? t : "other");
const kosher = (k?: string) => (k === "כן" ? "yes" : k === "לא" ? "no" : "unknown");
const shape = (s?: string) => (s === "burgundy" ? "burgundy" : "standard");
const windowSource = (s?: string) => (!s ? null : s.includes("הערכה") ? "estimate" : "critic");
const alcohol = (a?: string) => {
  const n = a ? parseFloat(a) : NaN;
  return Number.isFinite(n) && n > 0 && n <= 25 ? n : null;
};

/** "Suckling 92, Peñín 89" -> [{critic, score}]. Skips scores marked for another vintage. */
function critics(parker?: string): { critic: string; score: number }[] {
  if (!parker) return [];
  return parker
    .split(",")
    .filter((part) => !part.includes("בציר"))
    .flatMap((part) => {
      const m = part.trim().match(/^(.+?)\s+(\d{2,3})/);
      const score = m ? Number(m[2]) : NaN;
      return m && score >= 50 && score <= 100 ? [{ critic: m[1].trim().slice(0, 60), score }] : [];
    });
}

/** Old layout -> create_fridge() input. Shelf 11 is the pile: two layers + a front row. */
function fridgeLayout(shelves: OldShelf[]) {
  return shelves.map((s, i) => {
    const isPile = i === shelves.length - 1;
    const zones = isPile
      ? [
          { kind: "stack", capacity: s.back, label: "שכבה עליונה" },
          { kind: "stack", capacity: s.front, label: "שכבה תחתונה" },
        ]
      : [
          { kind: "row", capacity: s.back, label: "אחורית" },
          { kind: "row", capacity: s.front, label: "קדמית" },
        ];
    if (s.extra) zones.push({ kind: "row", capacity: s.extra, label: "בחזית" });
    return { zones: zones.filter((z) => z.capacity > 0) };
  });
}

// ---------- Import ----------

async function main() {
  const file = process.argv[2];
  if (!file) throw new Error("Usage: node --experimental-strip-types scripts/import-old-app.ts <export.html>");

  const { supabase, where } = await connect();
  console.log(`Importing into: ${where}`);

  const { data: cellarId } = await supabase.rpc("my_cellar_id");
  // Own cellar only: RLS also shows friends' wines.
  const { count } = await supabase.from("wines").select("id", { count: "exact", head: true }).eq("cellar_id", cellarId);
  if (count) throw new Error(`This cellar already has ${count} wines. Import into an empty cellar only.`);

  const snap = readSnapshot(file);
  const exportDate = snap.date.split(".").reverse().join("-"); // "24.11.2026" -> "2026-11-24"

  // 1. Fridge, then a lookup "shelf|zonePosition" -> zone id.
  const { data: fridgeId, error: fErr } = await supabase.rpc("create_fridge", {
    p_name: "מקרר יין",
    p_shelves: fridgeLayout(snap.config.shelves),
  });
  if (fErr) throw fErr;
  const { data: zoneRows } = await supabase
    .from("shelf_zones")
    .select("id, position, kind, shelves!inner(position, fridge_id)")
    .eq("shelves.fridge_id", fridgeId);
  const zoneId = new Map<string, string>();
  for (const z of zoneRows ?? []) {
    // A zone has one shelf; the untyped client may still describe it as a list.
    const shelf = (Array.isArray(z.shelves) ? z.shelves[0] : z.shelves) as { position: number };
    zoneId.set(`${shelf.position}|${z.position}`, z.id);
  }

  const pileShelf = snap.config.shelves.length;
  const placeOf = (b: OldBottle): { zone_id: string; slot: number | null } | null => {
    if (b.status !== "cellar" || !b.shelf) return null;
    const pos = b.row === "x" ? 3 : b.row === "b" ? 1 : 2; // back, front, extra
    const zone = zoneId.get(`${b.shelf}|${pos}`);
    if (!zone) return null;
    return { zone_id: zone, slot: b.shelf === pileShelf && b.row !== "x" ? null : (b.slot ?? null) };
  };

  // 2. Group bottles: wine (winery+name) -> vintage (year).
  const wines = new Map<string, OldBottle[]>();
  for (const b of snap.bottles) wines.set(key(b), [...(wines.get(key(b)) ?? []), b]);

  let bottlesDone = 0;
  for (const group of wines.values()) {
    const { data: wine, error: wErr } = await supabase
      .from("wines")
      .insert({
        cellar_id: cellarId,
        winery: cut(group[0].winery, 120) || "לא ידוע",
        name: cut(group[0].name, 120) || "לא ידוע",
        type: wineType(first(group, (b) => b.type) ?? undefined),
        grape: cut(first(group, (b) => b.grape) ?? undefined, 200),
        country: cut(first(group, (b) => b.country) ?? undefined, 60),
        region: cut(first(group, (b) => b.region) ?? undefined, 120),
        kosher: kosher(first(group, (b) => b.kosher) ?? undefined),
        shape: shape(first(group, (b) => b.shape) ?? undefined),
      } as never)
      .select("id")
      .single();
    if (wErr) throw wErr;

    const byYear = new Map<number | null, OldBottle[]>();
    for (const b of group) byYear.set(b.vintage ?? null, [...(byYear.get(b.vintage ?? null) ?? []), b]);

    for (const [year, bottles] of byYear) {
      const { data: vintage, error: vErr } = await supabase
        .from("wine_vintages")
        .insert({
          wine_id: wine.id,
          cellar_id: cellarId,
          year,
          drink_from: first(bottles, (b) => b.drinkFrom),
          drink_to: first(bottles, (b) => b.drinkTo),
          peak_from: first(bottles, (b) => b.peakFrom),
          peak_to: first(bottles, (b) => b.peakTo),
          window_source: windowSource(first(bottles, (b) => b.windowSource) ?? undefined),
          alcohol: alcohol(first(bottles, (b) => b.alcohol) ?? undefined),
        } as never)
        .select("id")
        .single();
      if (vErr) throw vErr;

      const scores = critics(first(bottles, (b) => b.parker) ?? undefined);
      if (scores.length) {
        await supabase.from("critic_scores").insert(scores.map((s) => ({ ...s, vintage_id: vintage.id, cellar_id: cellarId })) as never);
      }

      const rating = Math.max(...bottles.map((b) => Number(b.myRating) || 0));
      if (rating >= 1) {
        await supabase.rpc("set_rating", { p_wine_id: wine.id, p_score: Math.min(rating, 5), p_vintage_id: vintage.id });
      }

      for (const b of bottles) {
        const place = placeOf(b);
        const consumed = b.status === "consumed";
        const consumedOn = consumed ? (b.consumedAt?.slice(0, 10) ?? exportDate) : null;
        const note = [b.notes, b.priceNote && `מחיר: ${b.priceNote}`].filter(Boolean).join(" · ");

        const { data: bottle, error: bErr } = await supabase
          .from("bottles")
          .insert({
            cellar_id: cellarId,
            vintage_id: vintage.id,
            status: consumed ? "consumed" : place ? "stored" : "unplaced",
            zone_id: place?.zone_id ?? null,
            slot: place?.slot ?? null,
            link_url: first([b], (x) => x.priceUrl || x.wineryUrl),
            note: cut(note, 1000),
            added_on: exportDate,
            consumed_on: consumedOn,
          } as never)
          .select("id")
          .single();
        if (bErr) throw bErr;

        if (b.price || b.listPrice || b.priceNote?.includes("מתנה")) {
          await supabase.from("bottle_prices").insert({
            bottle_id: bottle.id,
            cellar_id: cellarId,
            paid: b.price ?? null,
            regular: b.listPrice ?? null,
            is_gift: Boolean(b.priceNote?.includes("מתנה")),
          } as never);
        }

        if (consumed) {
          const tastingNotes = [b.tasting, b.buyAgain && `לקנות שוב: ${b.buyAgain}`].filter(Boolean).join(" · ");
          await supabase.from("tastings").insert({
            cellar_id: cellarId,
            wine_id: wine.id,
            vintage_id: vintage.id,
            bottle_id: bottle.id,
            tasted_on: consumedOn,
            place: b.consumedAt ? null : "יובא מהאפליקציה הקודמת – תאריך לא ידוע",
            notes: cut(tastingNotes, 4000),
          } as never);
        }
        bottlesDone++;
      }
    }
  }

  // Only counts – never the contents of the export.
  console.log(`Imported ${wines.size} wines and ${bottlesDone} bottles into cellar ${cellarId}.`);
}

main().catch((e) => {
  console.error("Import failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
