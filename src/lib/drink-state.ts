// Where a vintage stands in its drinking window – the colored year badge.
// Always COMPUTED from the window and the current year, never stored:
// a stored state would go stale every January 1st.
// Algorithm and colors come from the existing app (docs/product-spec.md).

export type DrinkState = "past" | "now" | "soon" | "hold" | "near" | "young" | "none";

export type DrinkWindow = {
  drinkFrom: number | null;
  drinkTo: number | null;
  peakFrom?: number | null;
  peakTo?: number | null;
};

export function drinkState(w: DrinkWindow, year: number): DrinkState {
  const from = w.drinkFrom ?? 0;
  const to = w.drinkTo ?? 0;
  if (!from && !to) return "none";
  if (to && to < year) return "past";
  if (from && from > year) return from === year + 1 ? "near" : "young";

  // Inside the window: judge by the end of the peak (or of the window).
  const peakTo = w.peakTo ?? 0;
  const end = peakTo || to;
  if (peakTo && peakTo < year) return "now";
  if (end && end === year) return "now";
  if (end && end === year + 1) return "soon";
  return "hold";
}

/**
 * Badge colors: one clearly different HUE per state, not shades of one
 * color (26 Nov 2026: two rounds of soft greens were still too hard to tell
 * apart on the fridge). No red/orange, which read as an error, and no
 * yellow for wine at its peak. 28 Nov 2026: the peak states are all
 * greens (deep → light → turquoise), and "next year" is a pale blue-gray,
 * so a wine not yet in its window never looks like one that is. Digits are always black (spec), so every
 * color stays light enough for black text.
 */
export const DRINK_STATES: Record<DrinkState, { label: string; color: string }> = {
  past:  { label: "עבר את חלון השתייה",       color: "#C49A74" }, // warm brown
  now:   { label: "מוכן לשתייה, כדאי לפתוח השנה", color: "#2E9E4A" }, // deep green
  soon:  { label: "מוכן לשתייה, אפשר לחכות שנה", color: "#86D97A" }, // light green
  hold:  { label: "מוכן לשתייה, אפשר להחזיק כמה שנים", color: "#43C4A8" }, // green-turquoise
  near:  { label: "נכנס עוד שנה לחלון השתייה",   color: "#BCD0E2" }, // pale blue-gray
  young: { label: "עוד לא מוכן לשתייה",         color: "#949BA8" }, // gray
  none:  { label: "בלי חלון שתייה",            color: "#E6E1DA" }, // neutral
};

/** Order for legends and for "what to drink now" (most urgent first). */
export const DRINK_STATE_ORDER: DrinkState[] = ["past", "now", "soon", "hold", "near", "young", "none"];
