// An AI's change to a fridge's layout ("one more slot in shelf 5"), turned
// into the shelves update_fridge() takes. Pure, so it is tested. Ids are
// kept, so every bottle stays where it is; a change that would push a
// bottle out of the fridge is refused here (the user does that on the site).

import { estimateShelves, type ModelSpec } from "./fridge-catalog";
import { SHELF_PRESETS, LIMITS, bottlesLeaving, type PresetKey } from "./fridge-layout";

type Zone = { id: string; kind: "row" | "stack"; capacity: number; label: string; bottles: { slot: number | null }[] };
type Fridge = { name: string; shelves: { id: string; zones: Zone[] }[] };

export type FridgeShelfJson = { id?: string; zones: { id?: string; kind: "row" | "stack"; capacity: number; label: string }[] };

export type FridgeEdit = {
  /** New size of a zone: shelf from the top, zone 1 = back row / upper layer / only row. */
  resize?: { shelf: number; zone?: number; capacity: number }[];
  /** New shelves at the bottom of the fridge. */
  add_shelves?: { arrangement: PresetKey; size: number }[];
  /** Empty shelves to remove, by number from the top. */
  remove_shelves?: number[];
  name?: string;
};

/** The fridge as update_fridge() takes it (for an undo, too). */
export function fridgeJson(f: Fridge): FridgeShelfJson[] {
  return f.shelves.map((s) => ({ id: s.id, zones: s.zones.map(({ id, kind, capacity, label }) => ({ id, kind, capacity, label })) }));
}

export type FridgeEditResult = { ok: true; shelves: FridgeShelfJson[]; name: string; summary: string[] } | { ok: false; error: string };

export function applyFridgeEdit(f: Fridge, edit: FridgeEdit): FridgeEditResult {
  const shelves = fridgeJson(f);
  const summary: string[] = [];

  for (const r of edit.resize ?? []) {
    const zone = shelves[r.shelf - 1]?.zones[(r.zone ?? 1) - 1];
    if (!zone) return { ok: false, error: `shelf ${r.shelf} has no zone ${r.zone ?? 1} (see fridge_layout)` };
    if (r.capacity < LIMITS.capacity.min || r.capacity > LIMITS.capacity.max) {
      return { ok: false, error: `a zone holds ${LIMITS.capacity.min} to ${LIMITS.capacity.max} bottles` };
    }
    summary.push(`shelf ${r.shelf} zone ${r.zone ?? 1}: ${zone.capacity} → ${r.capacity} bottles`);
    zone.capacity = r.capacity;
  }

  const remove = new Set(edit.remove_shelves ?? []);
  for (const n of remove) {
    const shelf = f.shelves[n - 1];
    if (!shelf) return { ok: false, error: `there is no shelf ${n}` };
    if (shelf.zones.some((z) => z.bottles.length > 0)) return { ok: false, error: `shelf ${n} has bottles: move them first (suggest_move)` };
    summary.push(`shelf ${n} removed`);
  }
  const kept = shelves.filter((_, i) => !remove.has(i + 1));

  for (const a of edit.add_shelves ?? []) {
    const size = Math.min(LIMITS.capacity.max, Math.max(LIMITS.capacity.min, Math.round(a.size)));
    kept.push(SHELF_PRESETS[a.arrangement].make(size) as FridgeShelfJson);
    summary.push(`a new shelf at the bottom (${a.arrangement}, ${size})`);
  }

  if (kept.length < LIMITS.shelves.min || kept.length > LIMITS.shelves.max) {
    return { ok: false, error: `a fridge has ${LIMITS.shelves.min} to ${LIMITS.shelves.max} shelves` };
  }
  const leaving = bottlesLeaving(
    f.shelves.flatMap((s) => s.zones),
    kept.map((s) => s.zones),
  );
  if (leaving > 0) {
    return { ok: false, error: `this would take ${leaving} bottle(s) out of the fridge. Ask the user to do it on the site (fridge settings), or move those bottles first` };
  }
  const name = edit.name?.trim() || f.name;
  if (name !== f.name) summary.push(`renamed to "${name}"`);
  if (summary.length === 0) return { ok: false, error: "nothing to change" };
  return { ok: true, shelves: kept, name, summary };
}

/** The catalog's brands as an AI reads them off the fridge (in Latin letters). */
const BRAND_NAMES: Record<string, string> = { "לנדרס": "Landers", "וינופו": "Vinopo", "האייר": "Haier", "קאסו": "Caso", "ויין בר": "WineBar", "יורוקייב": "EuroCave" };

export type NewFridge = {
  name: string;
  kind?: "fridge" | "cabinet";
  brand?: string;
  model?: string;
  /** Shelves from the top, as the AI counted them (from a photo or the user's words). */
  shelves?: { arrangement: PresetKey; size: number }[];
};

export type NewFridgeResult =
  | { ok: true; name: string; kind: "fridge" | "cabinet"; brand: string | null; model: string | null; shelves: FridgeShelfJson[]; fromCatalog: boolean; summary: string }
  | { ok: false; error: string };

/**
 * A new fridge or cabinet for create_fridge(), as the AI describes it. The
 * shelves it counted win; without them a known model gets the same starting
 * layout as the site's model picker. A cabinet has no brand or model.
 */
export function buildNewFridge(input: NewFridge, catalog: { brand: string; models: ModelSpec[] }[], taken: string[]): NewFridgeResult {
  const name = input.name.trim();
  if (!name || name.length > LIMITS.name) return { ok: false, error: `the name must be 1 to ${LIMITS.name} characters` };
  if (taken.some((t) => t.trim().toLowerCase() === name.toLowerCase())) {
    return { ok: false, error: `there is already a fridge called "${name}": pick another name, or change that one with edit_fridge` };
  }
  const kind = input.kind ?? "fridge";
  let brand = kind === "cabinet" ? null : input.brand?.trim() || null;
  const model = kind === "cabinet" ? null : input.model?.trim() || null;
  const lower = (s: string) => s.toLowerCase().replace(/[\s-]/g, "");
  const asked = brand;
  const known = asked ? catalog.find((b) => lower(b.brand) === lower(asked) || lower(BRAND_NAMES[b.brand] ?? "") === lower(asked)) : undefined;
  const spec = known && model ? known.models.find((m) => lower(m.model) === lower(model)) : undefined;
  if (known) brand = known.brand; // as the site's picker names it

  let shelves: FridgeShelfJson[];
  if (input.shelves?.length) {
    shelves = input.shelves.map((s) => SHELF_PRESETS[s.arrangement].make(Math.min(LIMITS.capacity.max, Math.max(LIMITS.capacity.min, Math.round(s.size)))) as FridgeShelfJson);
  } else if (spec) {
    shelves = estimateShelves(spec) as FridgeShelfJson[];
  } else {
    return {
      ok: false,
      error: brand && model
        ? `"${brand} ${model}" is not in the app's model list, so pass the shelves you count (from the photo, or ask the user)`
        : "pass the shelves (from the top: arrangement and bottles per row), or a brand and model from the app's list",
    };
  }
  if (shelves.length < LIMITS.shelves.min || shelves.length > LIMITS.shelves.max) {
    return { ok: false, error: `a fridge has ${LIMITS.shelves.min} to ${LIMITS.shelves.max} shelves` };
  }
  const total = shelves.reduce((n, s) => n + s.zones.reduce((m, z) => m + z.capacity, 0), 0);
  const how = input.shelves?.length ? "the shelves you gave" : `the app's layout for ${brand} ${model}`;
  return { ok: true, name, kind, brand, model, shelves, fromCatalog: !input.shelves?.length, summary: `${shelves.length} shelves, ${total} bottles (${how})` };
}
