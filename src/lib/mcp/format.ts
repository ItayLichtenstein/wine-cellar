// Short, plain-text answers for AI tools (spec: short answers, robust for
// weaker models). Pure, so they are tested.

import type { ListRow } from "../bottle-list";
import type { HistoryEntry } from "../fridges";

import type { DrinkState } from "../drink-state";

const STATE_EN: Record<DrinkState, string> = {
  past: "past its peak – drink soon",
  now: "at its peak",
  soon: "at peak, can wait a year",
  hold: "at peak, can hold for years",
  near: "window opens next year",
  young: "not ready yet",
  none: "no drinking window recorded",
};

/** One line per vintage: "Yatir – Forest 2019 ×2 · at its peak · shelf 3 · ₪180". */
export function formatRows(rows: ListRow[], limit = 40, places?: Map<string, string>): string {
  if (rows.length === 0) return "No bottles match.";
  const lines = rows.slice(0, limit).map((r) => {
    const b = r.first;
    const parts = [
      `${b.winery} – ${b.name} ${b.year ?? "NV"}${r.bottles.length > 1 ? ` ×${r.bottles.length}` : ""}`,
      b.type,
      STATE_EN[b.state],
      b.drinkBy ? `drink by ${b.drinkBy}` : "",
      places ? whereAll(r, places) : b.where,
      b.price !== null ? `₪${b.price}` : "",
    ];
    return `- ${parts.filter(Boolean).join(" · ")}`;
  });
  const more = rows.length > limit ? `\n…and ${rows.length - limit} more. Narrow the search.` : "";
  return lines.join("\n") + more;
}

/** Where each bottle of a vintage is, exactly (fridge, shelf, zone, slot): the AI needs it to name one of them. */
function whereAll(r: ListRow, places: Map<string, string>): string {
  const all = r.bottles.map((b) => places.get(b.id) ?? (b.status === "in_transit" ? "on the way" : "outside the fridge"));
  const counted = new Map<string, number>();
  for (const w of all) counted.set(w, (counted.get(w) ?? 0) + 1);
  return [...counted].map(([w, n]) => (n > 1 ? `${w} (×${n})` : w)).join("; ");
}

export function formatHistory(entries: HistoryEntry[], limit: number): string {
  if (entries.length === 0) return "Nothing drunk yet.";
  return entries
    .slice(0, limit)
    .map((t) => `- ${t.tastedOn}: ${t.title} ${t.year ?? "NV"}${t.place ? ` (${t.place})` : ""}${t.score !== null ? ` · rated ${t.score}/5` : ""}${t.notes ? ` – ${t.notes}` : ""}`)
    .join("\n");
}

/**
 * Everything about the wines matching a search: each vintage with its
 * bottles (where, readiness, price) and what the household said when they
 * drank it. For "what do we know about X?" questions.
 */
export function formatWineDetails(rows: ListRow[], history: HistoryEntry[], query: string, places?: Map<string, string>): string {
  const q = query.trim().toLowerCase();
  const drank = history.filter((h) => h.title.toLowerCase().includes(q));
  if (rows.length === 0 && drank.length === 0) return `Nothing in the cellar or the history matches "${query}". Try search_cellar with fewer words.`;
  const lines: string[] = [];
  if (rows.length) {
    lines.push("In the cellar:", formatRows(rows, 15, places));
  }
  if (drank.length) {
    lines.push("", "Drunk before:", formatHistory(drank, 10));
  }
  return lines.join("\n");
}

type DraftGaps = { winery: string; name: string; price: number | null; grape: string; country: string; region: string; drinkFrom: number | null; drinkTo: number | null; image: string };

/**
 * What is still empty in bottles the AI just added or suggested, so it has
 * to tell the user (weaker models skip the server instructions, but always
 * read a tool's reply). The label photo is reported separately.
 */
export function reportGaps(drafts: DraftGaps[]): string[] {
  const lines = drafts.flatMap((d) => {
    const missing = [
      d.drinkFrom === null && d.drinkTo === null ? "drinking window" : "",
      d.price === null ? "price" : "",
      d.grape ? "" : "grape",
      d.country || d.region ? "" : "country/region",
      d.image ? "" : "label photo",
    ].filter(Boolean);
    return missing.length ? [`${d.winery} – ${d.name}: still empty – ${missing.join(", ")}.`] : [];
  });
  return [
    ...lines,
    "Now tell the user, in one or two short lines: which details you looked up on the web, which you filled from your own knowledge (say they are estimates),",
    lines.length ? "and which are still empty (listed above), so they can fill them in on the site or ask you to search again." : "and that everything was filled in.",
  ];
}
