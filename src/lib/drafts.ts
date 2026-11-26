// AI drafts: the one shape every AI write takes (ADR 0001), checked here
// for both the MCP server and "paste the AI's answer". Pure, so it is tested.
// Written to be forgiving of weaker models: loose field names, numbers as
// strings, Hebrew type names, and error messages that say how to fix it.

export const DRAFT_TYPES = ["red", "white", "rose", "orange", "sparkling", "dessert", "fortified", "other"] as const;
export type DraftWineType = (typeof DRAFT_TYPES)[number];

/** A suggested purchase / bottles seen in a photo, before a person approves it. */
export type BottleDraft = {
  winery: string;
  name: string;
  type: DraftWineType;
  year: number | null;
  quantity: number;
  price: number | null;
  grape: string;
  country: string;
  region: string;
  drinkFrom: number | null;
  drinkTo: number | null;
  note: string;
  /** Where the AI saw / suggests each bottle (at most `quantity`); the rest go "out of the fridge". */
  places: DraftPlace[];
};

/**
 * A place as a person (or AI) says it: "fridge X, shelf 3, the front row,
 * slot 2". Shelves and slots count from 1, as on screen; zone 1 is the
 * first part of the shelf (back row / upper layer / the only row), zone 2
 * the next (front row / lower layer), and so on. No fridge = the first one.
 */
export type DraftPlace = { fridge: string; shelf: number; zone: number; slot: number | null };

const TYPE_ALIASES: Record<string, DraftWineType> = {
  red: "red", אדום: "red", rouge: "red", tinto: "red", rosso: "red",
  white: "white", לבן: "white", blanc: "white", blanco: "white", bianco: "white",
  rose: "rose", rosé: "rose", רוזה: "rose", rosado: "rose",
  orange: "orange", כתום: "orange",
  sparkling: "sparkling", מבעבע: "sparkling", champagne: "sparkling", שמפניה: "sparkling", cava: "sparkling", prosecco: "sparkling",
  dessert: "dessert", קינוח: "dessert", sweet: "dessert",
  fortified: "fortified", מחוזק: "fortified", port: "fortified", porto: "fortified", sherry: "fortified",
  other: "other", אחר: "other",
};

const text = (v: unknown, max: number) => (typeof v === "string" || typeof v === "number" ? String(v).trim().slice(0, max) : "");
function int(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v.replace(/[^\d.]/g, "")) : NaN;
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}
/** First of several keys an AI might use for the same field. */
const pick = (o: Record<string, unknown>, ...keys: string[]) => keys.map((k) => o[k]).find((v) => v !== undefined && v !== null && v !== "");

export type ParseResult = { ok: true; draft: BottleDraft } | { ok: false; error: string };

export function parseBottleDraft(input: unknown, thisYear: number): ParseResult {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ok: false, error: "Each bottle must be an object like {\"winery\": \"...\", \"name\": \"...\"}." };
  }
  const o = input as Record<string, unknown>;
  const winery = text(pick(o, "winery", "producer", "יקב"), 120);
  const name = text(pick(o, "name", "wine", "שם"), 120);
  if (!winery || !name) return { ok: false, error: "\"winery\" and \"name\" are required (the producer and the wine's name)." };

  const rawType = text(pick(o, "type", "color", "סוג"), 30).toLowerCase();
  const type = rawType ? TYPE_ALIASES[rawType] : "red";
  if (!type) return { ok: false, error: `"type" must be one of: ${DRAFT_TYPES.join(", ")}.` };

  const rawYear = pick(o, "year", "vintage", "בציר");
  const nv = typeof rawYear === "string" && /^n\.?v\.?$/i.test(rawYear.trim());
  const year = nv ? null : int(rawYear);
  if (year !== null && (year < 1900 || year > thisYear)) return { ok: false, error: `"year" must be between 1900 and ${thisYear}, or null for NV.` };

  const quantity = int(pick(o, "quantity", "count", "bottles", "כמות")) ?? 1;
  if (quantity > 48) return { ok: false, error: "\"quantity\" is at most 48 per wine." };

  const drinkFrom = int(pick(o, "drink_from", "drinkFrom", "from"));
  const drinkTo = int(pick(o, "drink_to", "drinkTo", "to"));
  if (drinkFrom !== null && drinkTo !== null && drinkTo < drinkFrom) return { ok: false, error: "\"drink_to\" must not be before \"drink_from\"." };
  const outOfRange = (y: number | null) => y !== null && (y < 1900 || y > 2100);
  if (outOfRange(drinkFrom) || outOfRange(drinkTo)) return { ok: false, error: "Drinking window years must be between 1900 and 2100." };

  const price = int(pick(o, "price", "paid", "מחיר"));
  const rawPlaces = pick(o, "places", "place", "location", "locations", "מיקום");
  const places = (Array.isArray(rawPlaces) ? rawPlaces : rawPlaces ? [rawPlaces] : []).flatMap(parsePlace).slice(0, quantity);
  return {
    ok: true,
    draft: {
      winery,
      name,
      type,
      year,
      quantity,
      price: price !== null && price <= 100000 ? price : null,
      grape: text(pick(o, "grape", "grapes", "variety", "זן"), 100),
      country: text(pick(o, "country", "ארץ"), 60),
      region: text(pick(o, "region", "אזור"), 80),
      drinkFrom,
      drinkTo,
      note: text(pick(o, "note", "notes", "הערה"), 300),
      places,
    },
  };
}

/** One place; anything unusable is dropped (that bottle just lands outside the fridge). */
export function parsePlace(input: unknown): DraftPlace[] {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return [];
  const o = input as Record<string, unknown>;
  const shelf = int(pick(o, "shelf", "מדף"));
  if (shelf === null || shelf > 30) return [];
  const zone = int(pick(o, "zone", "row", "layer", "part")) ?? 1;
  const slot = int(pick(o, "slot", "position", "מקום"));
  return [{ fridge: text(pick(o, "fridge", "מקרר"), 60), shelf, zone: Math.min(zone, 6), slot: slot !== null && slot <= 50 ? slot : null }];
}

/**
 * Finds the JSON in an AI's free-text answer (it may add prose or a ```json
 * fence) and parses every bottle. Returns the good ones and why others failed.
 */
export function parseAiAnswer(answer: string, thisYear: number): { drafts: BottleDraft[]; errors: string[] } {
  const start = answer.search(/[[{]/);
  const end = Math.max(answer.lastIndexOf("]"), answer.lastIndexOf("}"));
  if (start === -1 || end < start) return { drafts: [], errors: ["לא מצאנו בתשובה רשימה של בקבוקים (JSON)."] };
  let data: unknown;
  try {
    data = JSON.parse(answer.slice(start, end + 1));
  } catch {
    return { drafts: [], errors: ["התשובה לא בפורמט JSON תקין. בקשו מה־AI להחזיר רק את הרשימה."] };
  }
  const items = Array.isArray(data) ? data : typeof data === "object" && data && "bottles" in data ? (data as { bottles: unknown }).bottles : [data];
  if (!Array.isArray(items) || items.length === 0) return { drafts: [], errors: ["הרשימה ריקה."] };

  const drafts: BottleDraft[] = [];
  const errors: string[] = [];
  items.slice(0, 30).forEach((item, i) => {
    const r = parseBottleDraft(item, thisYear);
    if (r.ok) drafts.push(r.draft);
    // The reason stays in English on purpose: it is written for the AI, and
    // the user can paste it back so the AI fixes its answer.
    else errors.push(`בקבוק ${i + 1} לא נקלט. אפשר להעביר ל־AI: ${r.error}`);
  });
  if (items.length > 30) errors.push("נלקחו רק 30 היינות הראשונים.");
  return { drafts, errors };
}

/** The format the AI is asked to answer in (shared by the paste prompt and MCP tool docs). */
export const DRAFT_FORMAT = `[
  {
    "winery": "Producer",
    "name": "Wine name (without the producer)",
    "type": "red | white | rose | orange | sparkling | dessert | fortified | other",
    "year": 2020,            // null for NV
    "quantity": 1,
    "price": 120,            // per bottle in ₪, or null
    "grape": "", "country": "", "region": "",
    "drink_from": 2024, "drink_to": 2030,   // drinking window if you know it, else null
    "note": "",
    "places": [{ "shelf": 3, "zone": 1, "slot": 2 }]   // optional: where each bottle is (see the fridge layout); omit if unknown
  }
]`;

export type CellarLine = { title: string; year: number | null; count: number; state: string; where: string };

/** "Copy for AI": the cellar plus clear instructions, for any AI without MCP. */
export function buildPrompt(task: "add" | "drink", cellar: CellarLine[], extra: string, layout = ""): string {
  const list = cellar.map((c) => `- ${c.title} ${c.year ?? "NV"} ×${c.count} (${c.state}; ${c.where})`).join("\n");
  if (task === "drink") {
    return [
      "You are helping me choose a wine from my home cellar.",
      extra ? `The occasion: ${extra}` : "Suggest what to open tonight.",
      "Weigh how ready each wine is to drink (prefer ones at or past their peak), the occasion, and style.",
      "Suggest 3 bottles from the list only, with one short reason each. Answer in Hebrew.",
      "",
      "My cellar:",
      list || "(empty)",
    ].join("\n");
  }
  return [
    "I will send you a photo of wine labels or a receipt (or describe bottles). Identify every wine.",
    "Fill in what you are confident about; leave unknown fields empty or null rather than guessing.",
    "If you know the wine's typical drinking window, add it.",
    extra ? `Extra details from me: ${extra}` : "",
    "",
    "Answer with ONLY a JSON list in exactly this format (comments are for you, do not include them):",
    DRAFT_FORMAT,
    "",
    "Wines I already have (reuse the exact winery and name when it is the same wine):",
    list || "(none yet)",
    ...(layout
      ? [
          "",
          "If I tell you or show you where bottles are in my fridge, add `places` with these numbers (otherwise leave it out):",
          layout,
        ]
      : []),
  ]
    .filter((l, i, a) => l !== "" || a[i - 1] !== "")
    .join("\n");
}

/**
 * A suggested action on a bottle already in the cellar: drink it, or move
 * it. The AI names the bottle as a person would (wine + vintage, and where
 * it is if there are several); the site finds it and shows which one.
 */
export type ActionDraft =
  | { kind: "drink"; winery: string; name: string; year: number | null; at: DraftPlace | null; date: string | null; notes: string; score: number | null }
  | { kind: "move"; winery: string; name: string; year: number | null; at: DraftPlace | null; to: DraftPlace };

export function parseActionDraft(kind: string, input: unknown): { ok: true; action: ActionDraft } | { ok: false; error: string } {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return { ok: false, error: "Expected an object." };
  const o = input as Record<string, unknown>;
  const winery = text(pick(o, "winery", "producer"), 120);
  const name = text(pick(o, "name", "wine"), 120);
  if (!winery || !name) return { ok: false, error: "\"winery\" and \"name\" are required, exactly as in search_cellar." };
  const rawYear = pick(o, "year", "vintage");
  const year = typeof rawYear === "string" && /^n\.?v\.?$/i.test(rawYear.trim()) ? null : int(rawYear);
  const at = parsePlace(pick(o, "at", "from", "place"))[0] ?? null;
  if (kind === "move") {
    const to = parsePlace(pick(o, "to", "destination"))[0];
    if (!to) return { ok: false, error: "\"to\" is required: { \"shelf\": 2, \"zone\": 1, \"slot\": 3 } (see fridge_layout)." };
    return { ok: true, action: { kind: "move", winery, name, year, at, to } };
  }
  if (kind === "drink") {
    const rawDate = text(pick(o, "date", "tasted_on"), 10);
    const date = /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : null;
    const rawScore = Number(pick(o, "score", "rating"));
    const score = Number.isFinite(rawScore) && rawScore >= 1 && rawScore <= 5 ? Math.round(rawScore * 10) / 10 : null;
    return { ok: true, action: { kind: "drink", winery, name, year, at, date, notes: text(pick(o, "notes", "note"), 1000), score } };
  }
  return { ok: false, error: "Unknown kind." };
}
