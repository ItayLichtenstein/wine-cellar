import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { buildRows, drinkNow, EMPTY_FILTERS } from "../bottle-list";
import { DRAFT_FORMAT, DRAFT_TYPES, parseBottleDraft } from "../drafts";
import { describeFridges } from "../draft-places";
import { getCellarBottles, getFridges, getHistory, type Db } from "../fridges";
import { tasteProfile } from "../stats";
import { getStatsData } from "../stats-data";
import { formatHistory, formatRows, formatWineDetails } from "./format";

/**
 * The MCP server (stage 7, ADR 0001). A thin client of the same service
 * layer the site uses: every tool calls the site's own loaders with the
 * AI's token, so RLS applies, and the database lets that token only read
 * and add drafts (ADR 0009). Few, task-shaped tools, flat schemas, short
 * answers, errors that say how to fix (spec: robust for weaker models).
 */
export function buildMcpServer({ db, cellarId, siteUrl }: { db: Db; cellarId: string; siteUrl: string }): McpServer {
  const server = new McpServer(
    { name: "wine-cellar", version: "1.0.0" },
    {
      instructions: [
        "This is the user's home wine cellar (Hebrew-first app; wine names are usually in their original language).",
        "Use search_cellar to see what they have, wine_details for everything about one wine, what_to_drink for a recommendation, history for what they drank.",
        "To add bottles (from a label photo, a receipt, or the user's words) call suggest_bottles. It only creates",
        "drafts; the user approves them on the site (one by one, or all at once). Never claim a bottle was added – say it awaits approval.",
        "When the user tells you or shows you WHERE bottles are in the fridge, call fridge_layout first and pass `places` (shelf, zone, slot) –",
        "then approving puts every bottle straight into its spot. Filling a whole fridge: go shelf by shelf (the fill_fridge prompt).",
        "You cannot change, move or delete anything. Answer the user in their language.",
      ].join(" "),
    },
  );

  const read = { readOnlyHint: true, openWorldHint: false } as const;
  const text = (t: string) => ({ content: [{ type: "text" as const, text: t }] });

  server.registerTool(
    "search_cellar",
    {
      title: "Search the cellar",
      description: "List the bottles in the cellar, one line per vintage, with readiness, where it is and price. All filters are optional.",
      inputSchema: {
        query: z.string().max(100).optional().describe("Words from the winery, wine or country, e.g. 'barolo' or 'Yatir'"),
        type: z.enum(DRAFT_TYPES).optional().describe("Wine type"),
        ready_now: z.boolean().optional().describe("true = only bottles at or past their peak"),
      },
      annotations: read,
    },
    async ({ query, type, ready_now }) => {
      const bottles = await getCellarBottles(cellarId, db);
      const rows = buildRows(
        bottles,
        {
          ...EMPTY_FILTERS,
          text: query ?? "",
          types: type ? [type] : [],
          states: ready_now ? ["past", "now", "soon", "hold"] : [],
        },
        "state",
      );
      return text(`${rows.length} vintages, ${rows.reduce((n, r) => n + r.bottles.length, 0)} bottles.\n${formatRows(rows)}`);
    },
  );

  server.registerTool(
    "what_to_drink",
    {
      title: "What to drink",
      description:
        "The bottles that most need drinking, plus what the household likes. Use it with the occasion the user describes to recommend 1–3 bottles from the cellar.",
      inputSchema: {},
      annotations: read,
    },
    async () => {
      const [bottles, stats] = await Promise.all([getCellarBottles(cellarId, db), getStatsData(cellarId, db)]);
      const urgent = drinkNow(bottles, 12);
      const likes = (["type", "country", "grape"] as const)
        .flatMap((f) => tasteProfile(stats.bottles, stats.ratings, f).slice(0, 3))
        .map((l) => `${l.label} (${l.average}/5 over ${l.wines} wines)`);
      return text(
        [
          "Most urgent to drink:",
          formatRows(urgent),
          "",
          likes.length ? `They rate highest: ${likes.join(", ")}.` : "Not enough ratings yet for a taste profile.",
          "For a specific occasion, also call search_cellar (e.g. by type) to see everything that fits.",
        ].join("\n"),
      );
    },
  );

  server.registerTool(
    "wine_details",
    {
      title: "Wine details",
      description:
        "Everything about one wine (or a few): every vintage in the cellar with where each bottle is, readiness and price, plus when the household drank it, their notes and rating.",
      inputSchema: { query: z.string().min(2).max(100).describe("Winery and/or wine name, e.g. 'Yatir Forest'") },
      annotations: read,
    },
    async ({ query }) => {
      const [bottles, history] = await Promise.all([getCellarBottles(cellarId, db), getHistory(cellarId, db)]);
      const rows = buildRows(bottles, { ...EMPTY_FILTERS, text: query }, "year");
      return text(formatWineDetails(rows, history, query));
    },
  );

  server.registerTool(
    "history",
    {
      title: "What we drank",
      description: "The most recent bottles the household drank, with date, place and tasting notes.",
      inputSchema: { limit: z.number().int().min(1).max(50).optional().describe("How many, default 15") },
      annotations: read,
    },
    async ({ limit }) => text(formatHistory(await getHistory(cellarId, db), limit ?? 15)),
  );

  server.registerTool(
    "fridge_layout",
    {
      title: "Fridge layout",
      description:
        "The fridges as the site shows them: shelves from the top, the zones on each shelf (rows with numbered slots, or piles), and which slots are free. Use these numbers in suggest_bottles `places`.",
      inputSchema: {},
      annotations: read,
    },
    async () => text(describeFridges(await getFridges(cellarId, db))),
  );

  server.registerTool(
    "suggest_bottles",
    {
      title: "Suggest bottles to add",
      description:
        "Creates DRAFTS for bottles to add (e.g. read from a label photo or receipt). Nothing is added until the user approves each draft on the site. Fill only what you are confident about.",
      inputSchema: {
        bottles: z
          .array(
            z.object({
              winery: z.string().describe("Producer"),
              name: z.string().describe("Wine name, without the producer"),
              type: z.enum(DRAFT_TYPES).optional(),
              year: z.number().int().nullable().optional().describe("Vintage; null for NV"),
              quantity: z.number().int().min(1).max(48).optional(),
              price: z.number().nullable().optional().describe("Per bottle, in ₪"),
              grape: z.string().optional(),
              country: z.string().optional(),
              region: z.string().optional(),
              drink_from: z.number().int().nullable().optional(),
              drink_to: z.number().int().nullable().optional(),
              note: z.string().optional(),
              places: z
                .array(
                  z.object({
                    fridge: z.string().optional().describe("Fridge name; omit for the first fridge"),
                    shelf: z.number().int().min(1).describe("Shelf number from the top, as in fridge_layout"),
                    zone: z.number().int().min(1).optional().describe("Zone on the shelf (1 = back row / upper layer / only row), default 1"),
                    slot: z.number().int().min(1).optional().describe("Slot in a row; omit for a pile"),
                  }),
                )
                .optional()
                .describe("Where each bottle of this wine is (at most `quantity`). Omit if unknown: those bottles wait outside the fridge."),
            }),
          )
          .min(1)
          .max(30),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async ({ bottles }) => {
      const year = new Date().getFullYear();
      const parsed = bottles.map((b, i) => ({ i, r: parseBottleDraft(b, year) }));
      const good = parsed.flatMap(({ r }) => (r.ok ? [r.draft] : []));
      const errors = parsed.flatMap(({ i, r }) => (r.ok ? [] : [`Bottle ${i + 1}: ${r.error}`]));
      if (good.length > 0) {
        const { error } = await db
          .from("drafts")
          .insert(good.map((d) => ({ cellar_id: cellarId, kind: "add_bottles" as const, payload: d, source: "mcp" as const })));
        if (error) {
          return {
            isError: true,
            content: [{ type: "text" as const, text: error.hint === "too_many_drafts" ? "50 drafts are already waiting. Ask the user to approve or reject them first." : "Could not save the drafts. Try again." }],
          };
        }
      }
      return text(
        [
          good.length ? `${good.length} draft(s) are waiting for the user's approval at ${siteUrl}/ai.` : "No drafts were created.",
          ...errors,
          errors.length ? `Fix and call again. Expected shape:\n${DRAFT_FORMAT}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
      );
    },
  );

  server.registerPrompt(
    "scan_label",
    { title: "Add bottles from a photo", description: "Read wine labels or a receipt from a photo and suggest them as drafts." },
    () => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: "I'll attach a photo of wine labels or a receipt. Identify each wine (winery, name, vintage, type, and if you know them: grape, country, region, drinking window). Check search_cellar so the same wine uses the exact existing name. Then call suggest_bottles once with all of them, and tell me they await my approval.",
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    "drink_tonight",
    {
      title: "What to open tonight",
      description: "Recommend bottles from the cellar for an occasion.",
      argsSchema: { occasion: z.string().max(200).describe("e.g. Italian dinner with friends") },
    },
    ({ occasion }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Occasion: ${occasion}. Call what_to_drink, and search_cellar if needed. Recommend up to 3 bottles from my cellar, weighing readiness, the occasion, style and price, with one short reason each.`,
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    "fill_fridge",
    {
      title: "Fill my fridge",
      description: "Enter all the bottles you already have, in their places: shelf by shelf from photos, or everything at once.",
    },
    () => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: [
              "Help me enter every bottle I already have into my wine cellar app, each in its place.",
              "1. Call fridge_layout to see my shelves, zones and free slots.",
              "2. Ask me for photos one shelf at a time (from the front, labels visible as much as possible), or a list if I prefer to type.",
              "3. For each shelf: identify every wine (winery, name, vintage, type; grape/country/region and drinking window if you know them),",
              "   and where it sits (zone and slot, slot 1 = rightmost as I look at it). If unsure about a bottle, ask me rather than guess.",
              "4. Call suggest_bottles once per shelf with all its bottles and their `places`. Reuse exact names from search_cellar for wines I already have.",
              "5. Tell me how many await my approval, and that 'approve all' on the site puts them in place. Then move on to the next shelf.",
              "Answer me in Hebrew.",
            ].join("\n"),
          },
        },
      ],
    }),
  );

  return server;
}
