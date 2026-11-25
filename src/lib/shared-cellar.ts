import type { ListBottle } from "./bottle-list";
import { drinkState } from "./drink-state";
import type { ZoneKind } from "./fridge-layout";
import type { FridgeView, HistoryEntry, LooseBottle, PlacedBottle } from "./fridges";

/** What shared_cellar(token) returns (see migration 0021). */
export type SharedCellarJson = {
  names: string[];
  hide_prices: boolean;
  hide_history: boolean;
  fridges: {
    id: string;
    name: string;
    brand: string | null;
    model: string | null;
    shelves: { id: string; zones: { id: string; kind: string; capacity: number; label: string | null }[] }[];
  }[];
  bottles: {
    id: string;
    status: "stored" | "unplaced" | "in_transit";
    zone_id: string | null;
    slot: number | null;
    shelf: number | null;
    year: number | null;
    drink_from: number | null;
    drink_to: number | null;
    peak_from: number | null;
    peak_to: number | null;
    winery: string;
    name: string;
    type: string;
    country: string | null;
    kosher: ListBottle["kosher"];
    shape: ListBottle["shape"];
    price: number | null;
  }[];
  history: { id: string; tasted_on: string; place: string | null; notes: string | null; year: number | null; winery: string; name: string }[];
};

export type SharedCellar = {
  names: string[];
  hidePrices: boolean;
  hideHistory: boolean;
  fridges: FridgeView[];
  loose: LooseBottle[];
  bottles: ListBottle[];
  history: HistoryEntry[];
};

const WHERE = { unplaced: "מחוץ למקרר", in_transit: "בדרך אלינו" } as const;

/**
 * The guest's JSON → the same shapes the app's own loaders return, so the
 * guest page reuses the fridge and list components. Pure, so it is tested.
 */
export function fromSharedCellar(json: SharedCellarJson, year: number): SharedCellar {
  const placed = new Map<string, PlacedBottle[]>();
  const loose: LooseBottle[] = [];
  const bottles: ListBottle[] = [];

  for (const b of json.bottles) {
    const window = { drinkFrom: b.drink_from, drinkTo: b.drink_to, peakFrom: b.peak_from, peakTo: b.peak_to };
    const state = drinkState(window, year);
    const title = `${b.winery} – ${b.name}`;
    if (b.status === "stored" && b.zone_id) {
      const list = placed.get(b.zone_id) ?? [];
      list.push({ id: b.id, slot: b.slot, year: b.year, state, title, label: b.name });
      placed.set(b.zone_id, list);
    } else if (b.status !== "stored") {
      loose.push({ id: b.id, status: b.status, year: b.year, state, title });
    }
    bottles.push({
      id: b.id,
      status: b.status,
      vintageId: `${b.winery}|${b.name}|${b.year ?? "NV"}`, // groups the list rows; no ids of vintages are shared
      winery: b.winery,
      name: b.name,
      type: b.type,
      year: b.year,
      country: b.country ?? "",
      kosher: b.kosher,
      shape: b.shape,
      state,
      drinkBy: b.peak_to ?? b.drink_to,
      price: b.price,
      where: b.status === "stored" ? (b.shelf ? `מדף ${b.shelf}` : "במקרר") : WHERE[b.status],
    });
  }

  return {
    names: json.names,
    hidePrices: json.hide_prices,
    hideHistory: json.hide_history,
    fridges: json.fridges.map((f) => ({
      id: f.id,
      name: f.name,
      brand: f.brand,
      model: f.model,
      shelves: f.shelves.map((s) => ({
        id: s.id,
        zones: s.zones.map((z) => ({
          id: z.id,
          kind: z.kind as ZoneKind,
          capacity: z.capacity,
          label: z.label ?? "",
          bottles: placed.get(z.id) ?? [],
        })),
      })),
    })),
    loose,
    bottles,
    history: json.history.map((t) => ({
      id: t.id,
      tastedOn: t.tasted_on,
      title: `${t.winery} – ${t.name}`,
      year: t.year,
      place: t.place ?? "",
      notes: t.notes ?? "",
    })),
  };
}
