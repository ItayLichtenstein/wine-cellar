import { fetchLabelImage } from "@/lib/web-image";
import { LABEL_BUCKET } from "@/lib/label-image";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { buildRows, drinkNow, EMPTY_FILTERS } from "../bottle-list";
import { DRAFT_FORMAT, DRAFT_TYPES, parseActionDraft, parseBottleDraft } from "../drafts";
import { describeFridges, findBottle, resolvePlaces } from "../draft-places";
import { applyAdd, applyDrink, applyMove } from "../ai-apply";
import { getCellarBottles, getFridges, getHistory, getLooseBottles, type Db } from "../fridges";
import { tasteProfile } from "../stats";
import { getStatsData } from "../stats-data";
import { formatHistory, formatRows, formatWineDetails, reportGaps } from "./format";

/**
 * The MCP server (stage 7, ADR 0001). A thin client of the same service
 * layer the site uses: every tool calls the site's own loaders with the
 * AI's token, so RLS applies, and the database lets that token only read
 * and add drafts (ADR 0009). Few, task-shaped tools, flat schemas, short
 * answers, errors that say how to fix (spec: robust for weaker models).
 */
export function buildMcpServer({ db, cellarId, siteUrl, canEdit = false }: { db: Db; cellarId: string; siteUrl: string; canEdit?: boolean }): McpServer {
  const server = new McpServer(
    { name: "wine-cellar", version: "1.0.0" },
    {
      instructions: [
        "This is the user's home wine cellar (Hebrew-first app; wine names are usually in their original language).",
        "Be an active, helpful cellar assistant, not a passive one.",
        "The first time the user mentions the cellar in a chat, answer and then offer, in one short list, what you can do:",
        "add bottles from a label photo, a receipt or just their words (into the exact place in the fridge); recommend what to open tonight;",
        "find what should be drunk soon; mark a bottle as drunk; move or rearrange bottles. After each action, offer the natural next step.",
        "Adding bottles: fill in what the user did not say yourself. Use web search to look up the drinking window, grape, country, region and",
        "a typical price for that exact wine and vintage before calling suggest_bottles. If you have no web search, do not guess:",
        "ask the user to turn on web search in this chat (the tools menu of the message box) so you can look it up, or to say they prefer to skip it.",
        "Afterwards tell the user, in one line, which details you found and which you could not, so they can fill those in on the site.",
        "Label photos: always try to give image_url for each bottle you add: the link to that exact wine's page at a shop or the winery",
        "(the server takes the product photo from the page), or a direct link to the image file. Never say a photo was added unless",
        "the tool reply says \"label image saved\" for that bottle; if it says NOT saved, tell the user why.",
        "Use search_cellar to see what they have, wine_details for everything about one wine, what_to_drink for a recommendation, history for what they drank.",
        "Changes: the user decides on the site, per AI and at any time, whether your changes take effect at once or wait for their approval",
        "as drafts. Every tool reply says which happened: repeat that to the user and never assume (a setting may have changed since your last call).",
        "delete_bottle removes a bottle entered by mistake. A deleted bottle is not a drunk one: before deleting, always ask the user",
        "whether they want to delete it or mark it as drunk, and delete only after they say delete.",
        "When the user tells you or shows you WHERE bottles are in the fridge, call fridge_layout first and pass `places` (shelf, zone, slot),",
        "so every bottle goes straight into its spot. Filling a whole fridge: go shelf by shelf (the fill_fridge prompt).",
        "To mark a bottle as drunk or move it, use suggest_drink / suggest_move. Answer the user in their language.",
      ].join(" "),
    },
  );

  const read = { readOnlyHint: true, openWorldHint: false } as const;
  const text = (t: string) => ({ content: [{ type: "text" as const, text: t }] });
  const fail = (t: string) => ({ isError: true, content: [{ type: "text" as const, text: t }] });

  // Edit mode: a change is logged as a draft that is already approved, with
  // what is needed to undo it (shown on the site's AI page).
  const logChange = async (kind: "add_bottles" | "drink" | "move" | "delete", payload: object, undo: Record<string, unknown>) => {
    const id = crypto.randomUUID();
    const { error } = await db.from("drafts").insert({ id, cellar_id: cellarId, kind, payload: payload as never, source: "mcp" as const });
    if (error) return;
    await db
      .from("drafts")
      .update({ status: "approved", decided_at: new Date().toISOString(), applied_by_ai: true, undo: undo as never })
      .eq("id", id)
      .eq("cellar_id", cellarId);
  };

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
        "Adds bottles (from a label photo, a receipt or the user's words): at once, or as drafts the user approves, by the user's setting; the reply says which." +
        " Before calling, look up missing details (drinking window, grape, region, typical price) with web search, and find each wine's page for image_url." +
        " Leave out only what you could not find; the reply lists what is still empty, to tell the user.",
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
              image_url: z
                .string()
                .optional()
                .describe(
                  "An https link for this wine's label photo: its product page at a shop or the winery (the server takes the page's main photo), or the image file itself (JPEG, PNG or WebP, up to 5MB). Not a search results page. The reply says for each bottle whether it was saved.",
                ),
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
      const errors = parsed.flatMap(({ i, r }) => (r.ok ? [] : [`Bottle ${i + 1}: ${r.error}`]));
      // Label photos from links: fetched and stored before the drafts, so a
      // draft only ever points at a photo that really exists.
      const imageNotes: string[] = [];
      const good = await Promise.all(
        parsed.flatMap(({ i, r }) => (r.ok ? [{ i, draft: r.draft }] : [])).map(async ({ i, draft }) => {
          const link = bottles[i].image_url?.trim();
          if (!link) return draft;
          const label = `Bottle ${i + 1} (${draft.winery} – ${draft.name})`;
          const img = await fetchLabelImage(link);
          if (!img.ok) {
            imageNotes.push(`${label}: label image NOT saved – ${img.reason}.`);
            return draft;
          }
          const path = `${cellarId}/web-${crypto.randomUUID()}.webp`;
          const { error: upError } = await db.storage.from(LABEL_BUCKET).upload(path, img.webp, { contentType: "image/webp" });
          if (upError) {
            imageNotes.push(`${label}: label image NOT saved – storage error.`);
            return draft;
          }
          imageNotes.push(`${label}: label image saved.`);
          return { ...draft, image: path };
        }),
      );
      if (canEdit && good.length > 0) {
        const fridges = await getFridges(cellarId, db);
        const taken = new Set<string>();
        const lines: string[] = [];
        for (const d of good) {
          const r = await applyAdd(db, cellarId, fridges, d, taken);
          if (!r.ok) {
            lines.push(`${d.winery} – ${d.name}: NOT added (the database refused it).`);
            continue;
          }
          await logChange("add_bottles", d, { bottles: r.bottleIds });
          lines.push(`${d.winery} – ${d.name}: added ${r.bottleIds.length} bottle(s), ${r.placed} in the requested place(s)${r.placed < r.bottleIds.length ? ", the rest outside the fridge" : ""}.`);
        }
        return text(
          [
            "Added at once (the user lets you make changes yourself).",
            ...lines,
            `The user can undo any of these on ${siteUrl}/ai.`,
            ...imageNotes,
            ...reportGaps(good),
            ...errors,
            errors.length ? `Fix and call again. Expected shape:\n${DRAFT_FORMAT}` : "",
          ]
            .filter(Boolean)
            .join("\n"),
        );
      }
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
          good.length
            ? `Not added yet: the user set you to suggest only, so ${good.length} draft(s) are waiting for their approval at ${siteUrl}/ai. Say so; never claim they were added.`
            : "No drafts were created.",
          ...imageNotes,
          ...(good.length ? reportGaps(good) : []),
          imageNotes.some((n) => n.includes("NOT saved"))
            ? "Tell the user which label images were not saved and why; they can try another direct image link from you, or take a photo on the site after approving."
            : "",
          ...errors,
          errors.length ? `Fix and call again. Expected shape:\n${DRAFT_FORMAT}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
      );
    },
  );

  // Suggesting changes to bottles already in the cellar: drafts the user
  // approves one by one on the site (never done directly).
  const placeSchema = z.object({
    fridge: z.string().optional(),
    shelf: z.number().int().min(1),
    zone: z.number().int().min(1).optional(),
    slot: z.number().int().min(1).optional(),
  });
  const bottleRef = {
    winery: z.string().describe("Exactly as in search_cellar"),
    name: z.string().describe("Exactly as in search_cellar"),
    year: z.number().int().nullable().optional().describe("Vintage; null for NV"),
    at: placeSchema.optional().describe("Where the bottle is, if there are several (see fridge_layout)"),
  };
  const saveAction = async (kind: "drink" | "move", payload: Record<string, unknown>, done: string) => {
    const r = parseActionDraft(kind, payload);
    if (!r.ok) return fail(r.error);
    if (canEdit) {
      const [fridges, loose] = await Promise.all([getFridges(cellarId, db), getLooseBottles(cellarId, db)]);
      const bottle = findBottle(fridges, loose, r.action);
      if (!bottle) return fail("No such bottle in the cellar. Check the exact winery, name and vintage with search_cellar.");
      let res;
      if (r.action.kind === "drink") res = await applyDrink(db, bottle.id, r.action);
      else {
        const target = resolvePlaces(fridges, [r.action.to])[0];
        if (!target) return fail("That place does not exist or is taken. Check fridge_layout for free places.");
        res = await applyMove(db, bottle.id, target);
      }
      if (!res.ok) return fail("It did not work (the bottle or the place may have changed). Nothing was changed.");
      await logChange(kind, r.action, res.undo);
      return text(`Done at once (the user lets you make changes yourself): ${kind === "drink" ? "marked as drunk" : "moved"}. The user can undo it on ${siteUrl}/ai.`);
    }
    const { error } = await db.from("drafts").insert({ cellar_id: cellarId, kind, payload: r.action, source: "mcp" as const });
    if (error) {
      return {
        isError: true,
        content: [{ type: "text" as const, text: error.hint === "too_many_drafts" ? "50 drafts are already waiting. Ask the user to approve or reject them first." : "Could not save the suggestion. Try again." }],
      };
    }
    return text(`${done} Not done yet: the user set you to suggest only, so it waits for their approval at ${siteUrl}/ai.`);
  };

  server.registerTool(
    "suggest_drink",
    {
      title: "Suggest marking a bottle as drunk",
      description: `When the user says they opened / drank a bottle from the cellar. At once or as a draft, by the user's setting; the reply says which. Optional score 1.0-5.0 and tasting notes.`,
      inputSchema: {
        ...bottleRef,
        date: z.string().optional().describe("YYYY-MM-DD, default today"),
        notes: z.string().max(1000).optional().describe("Tasting notes in the user's words"),
        score: z.number().min(1).max(5).optional().describe("The user's score, 1.0-5.0"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async (args) => saveAction("drink", args, "The drink suggestion is saved."),
  );

  server.registerTool(
    "suggest_move",
    {
      title: "Suggest moving a bottle",
      description: `Move a bottle to another place in the fridge (see fridge_layout for free slots). At once or as a draft, by the user's setting; the reply says which.`,
      inputSchema: { ...bottleRef, to: placeSchema.describe("The new place") },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async (args) => saveAction("move", args, "The move suggestion is saved."),
  );

  // Listed in both modes, so switching mode on the site works without
  // reconnecting (clients keep the tool list they got when connecting).
  {
    server.registerTool(
      "delete_bottle",
      {
        title: "Delete a bottle entered by mistake",
        description:
          "Removes a bottle that should not be in the cellar (entered by mistake, a duplicate). NOT for a bottle they drank: use suggest_drink. Ask the user first whether to delete it or mark it as drunk, and call this only after they say delete. Works only if the user lets you make changes yourself (the reply says); the user can undo it on the site.",
        inputSchema: { ...bottleRef, user_confirmed_delete: z.literal(true).describe("The user said to delete it (not that they drank it)") },
        annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
      },
      async (args) => {
        if (!canEdit) {
          return text(
            `Not deleted: the user set you to suggest only. Tell them they can delete it on the site, or tick "makes changes itself" for you on ${siteUrl}/ai (it applies at once, no need to reconnect) and ask again.`,
          );
        }
        const [fridges, loose] = await Promise.all([getFridges(cellarId, db), getLooseBottles(cellarId, db)]);
        const ref = { winery: args.winery, name: args.name, year: args.year ?? null, at: args.at ? { fridge: args.at.fridge ?? "", shelf: args.at.shelf, zone: args.at.zone ?? 1, slot: args.at.slot ?? null } : null };
        const bottle = findBottle(fridges, loose, ref);
        if (!bottle) return fail("No such bottle in the cellar. Check the exact winery, name and vintage with search_cellar.");
        const { data: snapshot, error } = await db.rpc("ai_delete_bottle", { p_bottle_id: bottle.id });
        if (error || !snapshot) return fail("It did not work. Nothing was deleted.");
        await logChange("delete", { winery: args.winery, name: args.name, year: ref.year }, snapshot as Record<string, unknown>);
        return text(`Deleted at once. The user can undo it on ${siteUrl}/ai.`);
      },
    );
  }

  server.registerPrompt(
    "scan_label",
    { title: "Add bottles from a photo", description: "Read wine labels or a receipt from a photo and suggest them as drafts." },
    () => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: "I'll attach a photo of wine labels or a receipt. Identify each wine (winery, name, vintage, type, and if you know them: grape, country, region, drinking window). Check search_cellar so the same wine uses the exact existing name. Look up what's missing on the web and find each wine's page for image_url. Then call suggest_bottles once with all of them, and tell me what the reply says (added, or waiting for my approval) and what is still empty.",
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
              "5. Tell me what the reply says (added, or waiting for my approval: then 'approve all' on the site puts them in place) and what is still empty. Then move on to the next shelf.",
              "Answer me in Hebrew.",
            ].join("\n"),
          },
        },
      ],
    }),
  );

  return server;
}
