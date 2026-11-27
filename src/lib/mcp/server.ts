import { countMissing, formatLabelPhotos, imageMatchSchema, missingNote, savedNote, saveWebLabel } from "./label-photos";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { buildRows, drinkNow, EMPTY_FILTERS } from "../bottle-list";
import { DRAFT_FORMAT, DRAFT_TYPES, parseActionDraft, parseBottleDraft } from "../drafts";
import { bottlePlaces, describeFridges, findBottle, pickFridge, resolvePlaces } from "../draft-places";
import { applyAdd, applyDrink, applyMove } from "../ai-apply";
import { getCellarBottles, getFridges, getHistory, getLooseBottles, type Db } from "../fridges";
import { tasteProfile } from "../stats";
import { getStatsData } from "../stats-data";
import { formatHistory, formatRows, formatWineDetails, reportGaps } from "./format";
import { registerMoreTools, type ChangeKind } from "./more-tools";

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
        "This is the user's home wine cellar (Hebrew-first app; wine names are usually in their original language). Answer in the user's language.",
        "Be an active, helpful cellar assistant: after each action, offer the natural next step.",
        // What to offer: the user does not know what is possible until told.
        "The first time the user mentions the cellar in a chat, answer and then offer, in one short list, what you can do:",
        "(1) add bottles from a photo of a whole shelf, a label, a receipt or just their words, each straight into its place in the fridge;",
        "(2) recommend what to open tonight and what should be drunk soon; (3) mark bottles as drunk, move or rearrange them;",
        "(4) fix a wine's details (drinking window, price, grape) and give wines a label photo from the web; (5) the wishlist and wines drunk outside the cellar (a restaurant);",
        "(6) change the fridge itself (e.g. one more slot on shelf 5).",
        // Photos of shelves.
        "Shelf photos: the user can send a photo of a whole shelf (or several, one per shelf). Call fridge_layout first, identify every bottle and where it sits",
        "(zone and slot, slot 1 = rightmost as the user looks at it), and add them in ONE suggest_bottles call with `places`, so the shelf goes in exactly as it is.",
        "If a label or a position is unclear, ask the user rather than guess. A whole fridge: shelf by shelf (the fill_fridge prompt).",
        "Not only wine: whisky, arak, liqueurs or any other bottle can be kept too. Use type 'other', the maker as winery, no drinking window,",
        "and year only if the label has one (otherwise null). Do not refuse or warn that the app is for wine.",
        // Details from the web.
        "Adding bottles: fill in what the user did not say. Use web search to look up the drinking window, grape, country, region and a typical price",
        "for that exact wine and vintage before calling suggest_bottles. If you have no web search, do not guess: ask the user to turn on web search in this chat",
        "(the tools menu of the message box), or to say they prefer to skip it. Afterwards tell the user, in one line, which details you found and which you could not.",
        // Label photos: what is possible and what to tell the user.
        "Label photos: photos the user sends you in the chat cannot be saved to the app (the chat does not pass files to tools), so never promise that.",
        "Instead, for each wine find its page at a shop or the winery (or a direct image link) and pass it as image_url, with image_match saying honestly",
        "whether it is this exact wine and vintage, another vintage, or only similar. When it is not exact, tell the user plainly what you used",
        "(e.g. \"I only found the 2022 label, not the 2021\") and that they can keep it or replace it with their own photo on the bottle's card in the app",
        `or at ${siteUrl}/labels (every wine without a photo, and the web photos, in one place). Wines already in the cellar get a photo with set_label_photo.`,
        "Never say a photo was added unless the tool reply says \"label image saved\" for it; if it says NOT saved, tell the user why.",
        // Reading.
        "Use search_cellar to see what they have, wine_details for everything about one wine (including its label photo), what_to_drink for a recommendation, history for what they drank.",
        // Changes and modes.
        "Changes: the user decides on the site, per AI and at any time, whether your changes take effect at once or wait for their approval as drafts.",
        "Every tool reply says which happened: repeat that to the user and never assume (a setting may have changed since your last call).",
        "Mark as drunk / move: suggest_drink / suggest_move. Details: edit_wine. Wishlist: wishlist / add_to_wishlist. Outside the cellar: log_tasting.",
        "The fridge's shelves and zones: edit_fridge. Label photos: set_label_photo. These last five work only when the user lets you make changes;",
        "otherwise the reply says so: tell the user they can do it on the site, or let you make changes on its AI page.",
        "delete_bottle removes a bottle entered by mistake. A deleted bottle is not a drunk one: before deleting, always ask the user",
        "whether they want to delete it or mark it as drunk, and delete only after they say delete.",
        "Every tool takes a list: several bottles go in ONE call, never in parallel calls.",
      ].join(" "),
    },
  );

  const read = { readOnlyHint: true, openWorldHint: false } as const;
  const text = (t: string) => ({ content: [{ type: "text" as const, text: t }] });

  // Edit mode: a change is logged as a draft that is already approved, with
  // what is needed to undo it (shown on the site's AI page).
  const logChange = async (kind: ChangeKind, payload: object, undo: Record<string, unknown>) => {
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
      const [bottles, fridges] = await Promise.all([getCellarBottles(cellarId, db), getFridges(cellarId, db)]);
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
      return text(`${rows.length} vintages, ${rows.reduce((n, r) => n + r.bottles.length, 0)} bottles.\n${formatRows(rows, 40, bottlePlaces(fridges))}`);
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
        "Everything about one wine (or a few): every vintage in the cellar with where each bottle is, readiness and price, its label photo (none, the user's own, or from the web), plus when the household drank it, their notes and rating.",
      inputSchema: { query: z.string().min(2).max(100).describe("Winery and/or wine name, e.g. 'Yatir Forest'") },
      annotations: read,
    },
    async ({ query }) => {
      const [bottles, history, fridges, { data: wines }] = await Promise.all([
        getCellarBottles(cellarId, db),
        getHistory(cellarId, db),
        getFridges(cellarId, db),
        db.from("wines").select("winery, name, label_image_path").eq("cellar_id", cellarId),
      ]);
      const rows = buildRows(bottles, { ...EMPTY_FILTERS, text: query }, "year");
      return text(formatWineDetails(rows, history, query, bottlePlaces(fridges)) + (rows.length ? formatLabelPhotos(wines ?? [], query, siteUrl) : ""));
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
        "Adds bottles (from a photo of a whole shelf, a label, a receipt or the user's words), each into its place when you give `places`: at once, or as drafts the user approves, by the user's setting; the reply says which." +
        " Before calling, look up missing details (drinking window, grape, region, typical price) with web search, and find each wine's page for image_url (with an honest image_match)." +
        " Leave out only what you could not find; the reply lists what is still empty, to tell the user.",
      inputSchema: {
        bottles: z
          .array(
            z.object({
              winery: z.string().describe("Producer"),
              name: z.string().describe("Wine name, without the producer"),
              type: z.enum(DRAFT_TYPES).optional().describe("Anything that is not wine (whisky, arak, a liqueur, a soft drink) is 'other'"),
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
              image_match: imageMatchSchema,
              places: z
                .array(
                  z.object({
                    fridge: z.string().optional().describe("Fridge name or number from fridge_layout; needed when there are several fridges"),
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
          const saved = await saveWebLabel(db, cellarId, link, bottles[i].image_match ?? "exact");
          if (!saved.ok) {
            imageNotes.push(`${label}: label image NOT saved – ${saved.reason}.`);
            return draft;
          }
          imageNotes.push(savedNote(label, bottles[i].image_match ?? "exact", siteUrl));
          const path = saved.path;
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
          lines.push(`${d.winery} – ${d.name}: added ${r.bottleIds.length} bottle(s), ${r.placed} in the requested place(s)${r.placed < r.bottleIds.length ? ", the rest outside the fridge" + (d.places.length > r.placed ? " (a place you gave does not exist, is taken, or names no fridge: check fridge_layout and move them with suggest_move)" : "") : ""}.`);
        }
        return text(
          [
            "Added at once (the user lets you make changes yourself).",
            ...lines,
            `The user can undo any of these on ${siteUrl}/ai.`,
            ...imageNotes,
            missingNote(await countMissing(db, cellarId, good), siteUrl),
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
            ? `Tell the user which label images were not saved and why; you can try another link, or they can take the photo themselves at ${siteUrl}/labels after approving.`
            : "",
          ...errors,
          errors.length ? `Fix and call again. Expected shape:\n${DRAFT_FORMAT}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
      );
    },
  );

  // Changes to bottles already in the cellar. Each tool takes a list, so
  // "drink / move / delete these three" is one call and one confirmation in
  // the AI's app (calls sent in parallel each ask, and some apps get stuck).
  // In edit mode they take effect at once; otherwise they become drafts.
  const placeSchema = z.object({
    fridge: z.string().optional().describe("Fridge name or number from fridge_layout; needed when there are several fridges"),
    shelf: z.number().int().min(1),
    zone: z.number().int().min(1).optional(),
    slot: z.number().int().min(1).optional(),
  });
  const bottleRef = {
    winery: z.string().describe("Exactly as in search_cellar"),
    name: z.string().describe("Exactly as in search_cellar"),
    year: z.number().int().nullable().optional().describe("Vintage; null for NV"),
    at: placeSchema.optional().describe("Where the bottle is, as search_cellar shows it; needed when the same wine is in several places"),
  };
  const ONE_CALL = "Put all the bottles in ONE call (the list), never several calls in parallel.";
  const label = (o: { winery: string; name: string; year?: number | null }) => `${o.winery} – ${o.name} ${o.year ?? "NV"}`;
  const notFound = "not found in the cellar (check the exact winery, name and vintage with search_cellar)";
  const tooMany = (error: { hint?: string } | null) => error?.hint === "too_many_drafts";

  /** One drink or move: done at once in edit mode, else saved as a draft. A line for the reply. */
  const oneAction = async (kind: "drink" | "move", payload: Record<string, unknown>): Promise<string> => {
    const r = parseActionDraft(kind, payload);
    const name = typeof payload.winery === "string" ? label(payload as { winery: string; name: string; year?: number | null }) : "?";
    if (!r.ok) return `${name}: NOT done – ${r.error}`;
    if (!canEdit) {
      const { error } = await db.from("drafts").insert({ cellar_id: cellarId, kind, payload: r.action, source: "mcp" as const });
      if (error) return `${name}: NOT saved – ${tooMany(error) ? "50 drafts are already waiting; ask the user to approve or reject them first" : "try again"}.`;
      return `${name}: waiting for the user's approval.`;
    }
    // Looked up again for each bottle, so two identical bottles in one list
    // are two different bottles.
    const [fridges, loose] = await Promise.all([getFridges(cellarId, db), getLooseBottles(cellarId, db)]);
    const bottle = findBottle(fridges, loose, r.action);
    if (!bottle) return `${name}: NOT done – ${notFound}.`;
    let res;
    if (r.action.kind === "drink") res = await applyDrink(db, bottle.id, r.action);
    else {
      const target = resolvePlaces(fridges, [r.action.to])[0];
      if (!target) {
        const why = r.action.to.fridge && !pickFridge(fridges, r.action.to.fridge) ? `there is no fridge "${r.action.to.fridge}"` : "that place does not exist or is taken";
        return `${name}: NOT moved – ${why} (see fridge_layout).`;
      }
      res = await applyMove(db, bottle.id, target);
    }
    if (!res.ok) return `${name}: NOT done – the bottle or the place changed meanwhile.`;
    await logChange(kind, r.action, res.undo);
    return `${name}: ${kind === "drink" ? "marked as drunk" : "moved"}.`;
  };

  const replyFor = (lines: string[]) =>
    text(
      [
        canEdit
          ? `Done at once (the user lets you make changes yourself). They can undo any of these on ${siteUrl}/ai.`
          : `Not done yet: the user set you to suggest only, so these wait for their approval at ${siteUrl}/ai. Say so; never claim they were done.`,
        ...lines,
        lines.some((l) => l.includes("NOT")) ? "Tell the user which ones did not work and why." : "",
      ]
        .filter(Boolean)
        .join("\n"),
    );

  server.registerTool(
    "suggest_drink",
    {
      title: "Mark bottles as drunk",
      description: `When the user says they opened / drank bottles from the cellar. At once or as drafts, by the user's setting; the reply says which. Optional score 1.0-5.0 and tasting notes per bottle. ${ONE_CALL}`,
      inputSchema: {
        bottles: z
          .array(
            z.object({
              ...bottleRef,
              date: z.string().optional().describe("YYYY-MM-DD, default today"),
              notes: z.string().max(1000).optional().describe("Tasting notes in the user's words"),
              score: z.number().min(1).max(5).optional().describe("The user's score, 1.0-5.0"),
            }),
          )
          .min(1)
          .max(30),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async ({ bottles }) => {
      const lines: string[] = [];
      for (const b of bottles) lines.push(await oneAction("drink", b));
      return replyFor(lines);
    },
  );

  server.registerTool(
    "suggest_move",
    {
      title: "Move bottles",
      description: `Move bottles to other places in the fridge (see fridge_layout for free slots). At once or as drafts, by the user's setting; the reply says which. ${ONE_CALL} Moves run in list order, so a swap is: A to a free slot, B to A's old place, A to B's old place.`,
      inputSchema: { bottles: z.array(z.object({ ...bottleRef, to: placeSchema.describe("The new place") })).min(1).max(30) },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async ({ bottles }) => {
      const lines: string[] = [];
      for (const b of bottles) lines.push(await oneAction("move", b));
      return replyFor(lines);
    },
  );

  // Listed in both modes, so switching mode on the site works without
  // reconnecting (clients keep the tool list they got when connecting).
  // Not marked destructive: every delete can be undone on the site, and apps
  // like Gemini otherwise ask again on every call, even after "always allow".
  server.registerTool(
    "delete_bottle",
    {
      title: "Delete bottles entered by mistake",
      description: `Removes bottles that should not be in the cellar (entered by mistake, duplicates). NOT for bottles they drank: use suggest_drink. Ask the user first whether to delete or mark as drunk, and call this only after they say delete. Works only if the user lets you make changes yourself (the reply says); the user can undo each one on the site. ${ONE_CALL}`,
      inputSchema: {
        bottles: z.array(z.object(bottleRef)).min(1).max(30),
        user_confirmed_delete: z.literal(true).describe("The user said to delete them (not that they drank them)"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async ({ bottles }) => {
      if (!canEdit) {
        return text(
          `Not deleted: the user set you to suggest only. Tell them they can delete bottles on the site, or turn on "helps manage the cellar" (in Hebrew: עוזר בניהול המרתף) for you on ${siteUrl}/ai (it applies at once, no need to reconnect) and ask again.`,
        );
      }
      const lines: string[] = [];
      for (const b of bottles) {
        const [fridges, loose] = await Promise.all([getFridges(cellarId, db), getLooseBottles(cellarId, db)]);
        const ref = { winery: b.winery, name: b.name, year: b.year ?? null, at: b.at ? { fridge: b.at.fridge ?? "", shelf: b.at.shelf, zone: b.at.zone ?? 1, slot: b.at.slot ?? null } : null };
        const bottle = findBottle(fridges, loose, ref);
        if (!bottle) {
          lines.push(`${label(b)}: NOT deleted – ${notFound}.`);
          continue;
        }
        const { data: snapshot, error } = await db.rpc("ai_delete_bottle", { p_bottle_id: bottle.id });
        if (error || !snapshot) {
          lines.push(`${label(b)}: NOT deleted – it did not work.`);
          continue;
        }
        await logChange("delete", { winery: b.winery, name: b.name, year: ref.year }, snapshot as Record<string, unknown>);
        lines.push(`${label(b)}: deleted.`);
      }
      return replyFor(lines);
    },
  );

  registerMoreTools(server, { db, cellarId, siteUrl, canEdit, logChange });

  server.registerPrompt(
    "scan_label",
    { title: "Add bottles from a photo", description: "Read wine labels or a receipt from a photo and suggest them as drafts." },
    () => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: "I'll attach a photo of wine labels or a receipt. Identify each wine (winery, name, vintage, type, and if you know them: grape, country, region, drinking window). Check search_cellar so the same wine uses the exact existing name. Look up what's missing on the web and find each wine's page for image_url, with an honest image_match. Then call suggest_bottles once with all of them, and tell me what the reply says (added, or waiting for my approval), what is still empty, and which label photos are not an exact match.",
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
              "   For each new wine, give image_url (its page at a shop or the winery) and an honest image_match; my own photos cannot be saved from the chat.",
              "5. Tell me what the reply says (added, or waiting for my approval: then 'approve all' on the site puts them in place), what is still empty,",
              "   and which label photos are not an exact match or missing (I can take those on the site's label photos page). Then move on to the next shelf.",
              "Answer me in Hebrew.",
            ].join("\n"),
          },
        },
      ],
    }),
  );

  return server;
}
