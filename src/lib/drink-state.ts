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

/** Badge colors. Digits are always black on the colored square (spec). */
export const DRINK_STATES: Record<DrinkState, { label: string; color: string }> = {
  past:  { label: "עבר את השיא",              color: "#f2a23c" }, // orange
  now:   { label: "בשיא",                       color: "#2e9e4a" }, // dark green
  soon:  { label: "בשיא, אפשר לחכות שנה",      color: "#7bd877" }, // light green
  hold:  { label: "בשיא, אפשר להחזיק כמה שנים", color: "#4fc3d4" }, // turquoise
  near:  { label: "נכנס לחלון בשנה הבאה",       color: "#9db4cc" }, // blue-grey: visible on the light bottle
  young: { label: "עוד לא בשיא",              color: "#8f8885" }, // dark grey
  none:  { label: "בלי חלון שתייה",            color: "#e8e1da" }, // neutral
};

/** Order for legends and for "what to drink now" (most urgent first). */
export const DRINK_STATE_ORDER: DrinkState[] = ["past", "now", "soon", "hold", "near", "young", "none"];
