// Turning an AI's "shelf 3, zone 1, slot 2" into a real place in a fridge,
// and describing the fridges back to the AI in the same words. Pure, so
// both directions are tested; used by the MCP server and the approval screen.

import type { Locale } from "@/i18n/locales";
import type { DraftPlace } from "./drafts";
import { zoneLabel } from "./zone-label";

type Zone = { id: string; kind: "row" | "stack"; capacity: number; label: string; bottles: { slot: number | null; id?: string; title?: string; year?: number | null }[] };
type Fridge = { name: string; kind?: "fridge" | "cabinet"; shelves: { zones: Zone[] }[] };
export type ResolvedPlace = { zoneId: string; slot: number | null };

/**
 * The fridge an AI named: by name (any case), or by number ("2", "Fridge 2",
 * as fridge_layout numbers them). No name = the first fridge. A name that
 * matches nothing is undefined, never a guess: with two fridges, a wrong
 * name must not put a bottle in the other one.
 */
export function pickFridge<F extends { name: string }>(fridges: F[], name: string | undefined | null): F | undefined {
  const n = (name ?? "").trim().toLowerCase();
  if (!n) return fridges[0];
  const byName = fridges.find((f) => f.name.trim().toLowerCase() === n);
  if (byName) return byName;
  const num = n.match(/^(?:fridge|מקרר)?\s*#?(\d+)$/);
  if (num) return fridges[Number(num[1]) - 1];
  return fridges.length === 1 ? fridges[0] : undefined; // one fridge: the name cannot be wrong
}

/** Every stored bottle's exact place, in the words fridge_layout uses (for the AI). */
export function bottlePlaces(fridges: Fridge[]): Map<string, string> {
  const out = new Map<string, string>();
  const multi = fridges.length > 1;
  for (const f of fridges) {
    for (const [si, shelf] of f.shelves.entries()) {
      for (const [zi, z] of shelf.zones.entries()) {
        for (const b of z.bottles) {
          if (!b.id) continue;
          out.set(b.id, [multi ? `fridge "${f.name}"` : "", `shelf ${si + 1}`, shelf.zones.length > 1 ? `zone ${zi + 1}` : "", b.slot ? `slot ${b.slot}` : ""].filter(Boolean).join(" "));
        }
      }
    }
  }
  return out;
}

/**
 * Resolves each place to a free spot. A place that does not exist, or is
 * taken (by a bottle already there, or by an earlier place in this batch),
 * is skipped: that bottle goes "out of the fridge" instead of failing.
 * `taken` is shared across a whole batch, so two drafts never get one slot.
 */
export function resolvePlaces(fridges: Fridge[], places: DraftPlace[], taken: Set<string> = new Set()): ResolvedPlace[] {
  const out: ResolvedPlace[] = [];
  for (const p of places) {
    const zone = pickFridge(fridges, p.fridge)?.shelves[p.shelf - 1]?.zones[p.zone - 1];
    if (!zone) continue;
    if (zone.kind === "stack") {
      const used = zone.bottles.length + [...taken].filter((k) => k.startsWith(`${zone.id}:stack`)).length;
      if (used >= zone.capacity) continue;
      taken.add(`${zone.id}:stack:${used}`);
      out.push({ zoneId: zone.id, slot: null });
      continue;
    }
    if (p.slot === null || p.slot > zone.capacity) continue;
    const key = `${zone.id}:${p.slot}`;
    if (taken.has(key) || zone.bottles.some((b) => b.slot === p.slot)) continue;
    taken.add(key);
    out.push({ zoneId: zone.id, slot: p.slot });
  }
  return out;
}

/** The fridges as the AI should read them: numbered like the screen, with free slots. */
export function describeFridges(fridges: Fridge[]): string {
  if (fridges.length === 0) return "No fridge yet. Offer to set one up with create_fridge (from a photo of it, its brand and model, or the user's description), or the user can do it on the site.";
  return fridges
    .map((f, i) => {
      const shelves = f.shelves.map((s, si) => {
        const zones = s.zones.map((z, zi) => {
          if (z.kind === "stack") return `zone ${zi + 1} "${z.label}" (pile, no slots): ${z.bottles.length}/${z.capacity} used`;
          const free = Array.from({ length: z.capacity }, (_, k) => k + 1).filter((n) => !z.bottles.some((b) => b.slot === n));
          return `zone ${zi + 1} "${z.label}" (row, slots 1-${z.capacity}, slot 1 = rightmost as seen on the site): free ${free.length ? free.join(",") : "none"}`;
        });
        return `  shelf ${si + 1} (from the top): ${zones.join("; ")}`;
      });
      // A cabinet is stored like a fridge; the AI should call it what it is.
      const cabinet = f.kind === "cabinet" ? " (a cabinet or rack, not a fridge: call it that)" : "";
      return [`Fridge ${i + 1}: "${f.name}"${cabinet}`, ...shelves].join("\n");
    })
    .join("\n")
    .concat(fridges.length > 1 ? `\n${fridges.length} fridges: always pass \`fridge\` (its name, or its number as above) in every place.` : "");
}

/** "מדף 1 (מקומות 1, 2) · מדף 2 (3 בקבוקים)": where a draft's bottles go, short. */
export function placesSummary(places: DraftPlace[]): string {
  const byShelf = new Map<string, DraftPlace[]>();
  for (const p of places) {
    const key = `${p.fridge ? `${p.fridge}, ` : ""}מדף ${p.shelf}`;
    byShelf.set(key, [...(byShelf.get(key) ?? []), p]);
  }
  return [...byShelf]
    .map(([shelf, ps]) => {
      const slots = ps.map((p) => p.slot).filter((n): n is number => n !== null);
      if (slots.length === ps.length) return `${shelf} (${slots.length === 1 ? "מקום" : "מקומות"} ${slots.join(", ")})`;
      return ps.length === 1 ? shelf : `${shelf} (${ps.length} בקבוקים)`;
    })
    .join(" · ");
}

/** A bottle the AI named: where it is now (null = outside the fridge). */
export type FoundBottle = { id: string; where: string };

/**
 * Finds the bottle an action draft means: same wine (winery – name, any
 * case) and vintage; if the AI said where it is, the one there. Bottles in
 * the fridge first, then the ones outside it. Null = not found.
 */
export function findBottle(
  fridges: Fridge[],
  loose: { id: string; title: string; year: number | null }[],
  ref: { winery: string; name: string; year: number | null; at: DraftPlace | null },
): FoundBottle | null {
  const title = `${ref.winery} – ${ref.name}`.toLowerCase();
  const same = (b: { title?: string; year?: number | null }) => b.title?.toLowerCase() === title && (b.year ?? null) === ref.year;
  const multi = fridges.length > 1;
  for (const f of fridges) {
    for (const [si, shelf] of f.shelves.entries()) {
      for (const [zi, z] of shelf.zones.entries()) {
        for (const b of z.bottles) {
          if (!b.id || !same(b)) continue;
          if (ref.at) {
            const fridgeOk = !ref.at.fridge || pickFridge(fridges, ref.at.fridge) === f;
            if (!fridgeOk || ref.at.shelf !== si + 1 || ref.at.zone !== zi + 1 || (ref.at.slot !== null && b.slot !== ref.at.slot)) continue;
          }
          return { id: b.id, where: `${multi ? `${f.name}, ` : ""}מדף ${si + 1}${b.slot ? `, מקום ${b.slot}` : ""}` };
        }
      }
    }
  }
  if (ref.at) return null; // it was supposed to be in the fridge, at that place
  const outside = loose.find(same);
  return outside ? { id: outside.id, where: "מחוץ למקרר" } : null;
}

/** "מדף 1, קדמי, מקום 1": one place in words, with the zone's own name from the fridge. */
export function placeText(fridges: Fridge[], p: DraftPlace, locale: Locale = "he"): string {
  const fridge = pickFridge(fridges, p.fridge);
  const zone = fridge?.shelves[p.shelf - 1]?.zones[p.zone - 1];
  const en = locale === "en";
  return [
    fridges.length > 1 && fridge ? fridge.name : "",
    en ? `Shelf ${p.shelf}` : `מדף ${p.shelf}`,
    zone?.label ? zoneLabel(zone.label, locale) : "",
    p.slot ? (en ? `Place ${p.slot}` : `מקום ${p.slot}`) : "",
  ]
    .filter(Boolean)
    .join(", ");
}
