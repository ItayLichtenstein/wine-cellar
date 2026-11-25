import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { buildRows, drinkNow, EMPTY_FILTERS } from "../bottle-list";
import { DRAFT_FORMAT, DRAFT_TYPES, parseBottleDraft } from "../drafts";
import { getCellarBottles, getHistory, type Db } from "../fridges";
import { tasteProfile } from "../stats";
import { getStatsData } from "../stats-data";
import { formatHistory, formatRows } from "./format";

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
        "Use search_cellar to see what they have, what_to_drink for a recommendation, history for what they drank.",
        "To add bottles (from a label photo, a receipt, or the user's words) call suggest_bottles. It only creates",
        "drafts; the user approves each one on the site. Never claim a bottle was added – say it awaits approval.",
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
            }),
          )
          .min(1)
          .max(20),
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

  return server;
}
