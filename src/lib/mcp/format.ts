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
export function formatRows(rows: ListRow[], limit = 40): string {
  if (rows.length === 0) return "No bottles match.";
  const lines = rows.slice(0, limit).map((r) => {
    const b = r.first;
    const parts = [
      `${b.winery} – ${b.name} ${b.year ?? "NV"}${r.bottles.length > 1 ? ` ×${r.bottles.length}` : ""}`,
      b.type,
      STATE_EN[b.state],
      b.drinkBy ? `drink by ${b.drinkBy}` : "",
      b.where,
      b.price !== null ? `₪${b.price}` : "",
    ];
    return `- ${parts.filter(Boolean).join(" · ")}`;
  });
  const more = rows.length > limit ? `\n…and ${rows.length - limit} more. Narrow the search.` : "";
  return lines.join("\n") + more;
}

export function formatHistory(entries: HistoryEntry[], limit: number): string {
  if (entries.length === 0) return "Nothing drunk yet.";
  return entries
    .slice(0, limit)
    .map((t) => `- ${t.tastedOn}: ${t.title} ${t.year ?? "NV"}${t.place ? ` (${t.place})` : ""}${t.notes ? ` – ${t.notes}` : ""}`)
    .join("\n");
}
