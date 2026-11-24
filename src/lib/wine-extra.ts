// The "more details" of a wine: types, defaults and small display helpers.
// Pure – shared by the add form, the edit form and the bottle card.

export type Kosher = "yes" | "no" | "unknown";
export type Shape = "standard" | "burgundy";
export type WindowSource = "critic" | "estimate";
export type CriticScore = { critic: string; score: number };

export type WineExtra = {
  grape: string;
  country: string;
  region: string;
  kosher: Kosher;
  shape: Shape;
  alcohol: string; // kept as typed; parsed on save
  peakFrom: string;
  peakTo: string;
  windowSource: WindowSource | "";
  critics: CriticScore[];
  link: string;
};

export const EMPTY_EXTRA: WineExtra = {
  grape: "",
  country: "",
  region: "",
  kosher: "unknown",
  shape: "standard",
  alcohol: "",
  peakFrom: "",
  peakTo: "",
  windowSource: "",
  critics: [],
  link: "",
};

/** "94 · 3 מבקרים" (rounded average, like Wine-Searcher), or "94 · Suckling" for one critic. */
export function criticSummary(scores: CriticScore[]): string | null {
  if (scores.length === 0) return null;
  const avg = Math.round(scores.reduce((s, c) => s + c.score, 0) / scores.length);
  return scores.length === 1 ? `${avg} · ${scores[0].critic}` : `${avg} · ${scores.length} מבקרים`;
}

// Sites people link to, named the way they know them.
const SITE_NAMES: Record<string, string> = {
  "wineroute.co.il": "דרך היין",
  "wine-searcher.com": "Wine-Searcher",
  "vivino.com": "Vivino",
  "haturki.com": "הטורקי",
  "paneco.co.il": "פנקו",
};

/** A short name for a link, from its domain: "דרך היין", else "example.com". */
export function linkLabel(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    const host = u.hostname.replace(/^www\./, "");
    const known = Object.keys(SITE_NAMES).find((d) => host === d || host.endsWith(`.${d}`));
    return known ? SITE_NAMES[known] : host;
  } catch {
    return null;
  }
}

/** Problems a user can fix, in Hebrew; empty when everything is fine. */
export function validateExtra(e: WineExtra): string | null {
  const year = (s: string) => s.trim() === "" || /^(19|20|21)\d\d$/.test(s.trim());
  if (!year(e.peakFrom) || !year(e.peakTo)) return "שנות השיא צריכות להיות שנים בנות 4 ספרות.";
  if (e.peakFrom && e.peakTo && Number(e.peakFrom) > Number(e.peakTo)) return "שנת תחילת השיא אחרי סופו.";
  if (e.alcohol.trim() && !(Number(e.alcohol) >= 0 && Number(e.alcohol) <= 25)) return "אחוז האלכוהול צריך להיות בין 0 ל־25.";
  if (e.critics.some((c) => !c.critic.trim() || !(c.score >= 50 && c.score <= 100))) return "ציון מבקר צריך שם וציון בין 50 ל־100.";
  if (e.link.trim() && !linkLabel(e.link.trim())) return "הקישור צריך להתחיל ב־https://";
  return null;
}

/** "4 × 2021, 1 × 2020, 2 × NV": how many bottles of each vintage, newest first. */
export function vintageBreakdown(years: (number | null)[]): string {
  const counts = new Map<number | null, number>();
  for (const y of years) counts.set(y, (counts.get(y) ?? 0) + 1);
  return [...counts.entries()]
    .sort(([a], [b]) => (b ?? -Infinity) - (a ?? -Infinity))
    .map(([y, n]) => `${n} × ${y ?? "NV"}`)
    .join(", ");
}
