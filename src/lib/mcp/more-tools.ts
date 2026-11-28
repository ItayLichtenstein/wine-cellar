// More MCP tools (ADR 0013): edit a wine's details, the wishlist, a drink
// outside the cellar or a past one, and the fridges (new or changed; never deleted). They change data only for an
// AI the user lets make changes; a label photo too; one that only suggests is told so, and the
// user makes the change on the site. Every change can be undone on /ai.

import { DRINK_WINDOW_SOURCES, LABEL_SOURCES } from "../drink-window-sources";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { BODIES } from "../wine-extra";
import { DRAFT_TYPES } from "../drafts";
import { findBottle, pickFridge } from "../draft-places";
import { applyFridgeEdit, buildNewFridge, fridgeJson } from "../fridge-edit";
import { CATALOG } from "../fridge-catalog";
import { CHOOSABLE_PRESETS } from "../fridge-layout";
import { getCellarBottles, getFridges, getHistory, getLooseBottles, type Db } from "../fridges";
import { imageMatchSchema, labelsPage, savedNote, saveWebLabel } from "./label-photos";
import { APPROVE_ALL, optionalLeft } from "./format";

export type ChangeKind = "add_bottles" | "drink" | "move" | "delete" | "edit" | "wishlist" | "taste" | "fridge" | "label";

type Ctx = {
  db: Db;
  cellarId: string;
  siteUrl: string;
  canEdit: boolean;
  logChange: (kind: ChangeKind, payload: object, undo: Record<string, unknown>) => Promise<void>;
};

const text = (t: string) => ({ content: [{ type: "text" as const, text: t }] });
const write = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false } as const;
const ONE_CALL = "Put everything in ONE call (the list), never several calls in parallel.";
const label = (o: { winery: string; name: string; year?: number | null }) => `${o.winery} – ${o.name}${o.year === undefined ? "" : ` ${o.year ?? "NV"}`}`;

export function registerMoreTools(server: McpServer, { db, cellarId, siteUrl, canEdit, logChange }: Ctx) {
  const suggestOnly = (what: string) =>
    text(
      `Not done: the user set you to suggest only, so you cannot ${what}. Tell them they can do it on the site, or turn on "helps manage the cellar" (in Hebrew: עוזר בניהול המרתף) for you on ${siteUrl}/ai (it applies at once, no need to reconnect) and ask again.`,
    );
  const done = (lines: string[]) =>
    text(
      [`Done at once (the user lets you make changes yourself). They can undo any of these on ${siteUrl}/ai.`, ...lines, lines.some((l) => l.includes("NOT")) ? "Tell the user which ones did not work and why." : "", APPROVE_ALL]
        .filter(Boolean)
        .join("\n"),
    );

  const placeSchema = z.object({
    fridge: z.string().optional().describe("Fridge name or number from fridge_layout"),
    shelf: z.number().int().min(1),
    zone: z.number().int().min(1).optional(),
    slot: z.number().int().min(1).optional(),
  });

  server.registerTool(
    "edit_wine",
    {
      title: "Fix a wine's details",
      description:
        "Change details of wines already in the cellar: drinking window, peak, grape, country, region, type, body, kosher, bottle shape, alcohol, the price paid, or the user's note on the bottles. Window, alcohol and wine details apply to every bottle of that wine and vintage; the price and the note to every bottle of that vintage, or only the one at `at`. Only what you pass changes. Works only if the user lets you make changes yourself. " +
        ONE_CALL,
      inputSchema: {
        wines: z
          .array(
            z.object({
              winery: z.string().describe("Exactly as in search_cellar"),
              name: z.string().describe("Exactly as in search_cellar"),
              year: z.number().int().nullable().optional().describe("Vintage; null for NV"),
              at: placeSchema.optional().describe("Only for the price or note of one bottle: where it is"),
              drink_from: z.number().int().nullable().optional().describe(DRINK_WINDOW_SOURCES),
              drink_to: z.number().int().nullable().optional(),
              peak_from: z.number().int().nullable().optional(),
              peak_to: z.number().int().nullable().optional(),
              price: z.number().min(0).nullable().optional().describe("Paid per bottle, in ₪"),
              type: z.enum(DRAFT_TYPES).optional(),
              grape: z.string().max(200).optional(),
              country: z.string().max(100).optional(),
              region: z.string().max(100).optional(),
              body: z.enum(BODIES).nullable().optional().describe("light, medium, medium_full or full; null if not known"),
              kosher: z.enum(["yes", "no", "unknown"]).optional(),
              shape: z.enum(["standard", "burgundy"]).optional().describe("burgundy = the wide, sloping bottle (Pinot Noir, Chardonnay); it takes more room"),
              alcohol: z.number().min(0).max(25).nullable().optional().describe("% ABV, as on the label"),
              note: z.string().max(1000).optional().describe("The user's own note on the bottles (replaces the note there); empty to clear"),
            }),
          )
          .min(1)
          .max(30),
      },
      annotations: write,
    },
    async ({ wines }) => {
      if (!canEdit) return suggestOnly("change wine details");
      const lines: string[] = [];
      for (const w of wines) {
        const year = w.year ?? null;
        const name = label({ ...w, year });
        const all = (await getCellarBottles(cellarId, db)).filter(
          (b) => b.winery.toLowerCase() === w.winery.toLowerCase() && b.name.toLowerCase() === w.name.toLowerCase() && (b.year ?? null) === year,
        );
        if (all.length === 0) {
          lines.push(`${name}: NOT changed – not in the cellar (check the exact winery, name and vintage with search_cellar).`);
          continue;
        }
        let bottleIds = all.map((b) => b.id);
        if (w.at) {
          const [fridges, loose] = await Promise.all([getFridges(cellarId, db), getLooseBottles(cellarId, db)]);
          const one = findBottle(fridges, loose, { winery: w.winery, name: w.name, year, at: { fridge: w.at.fridge ?? "", shelf: w.at.shelf, zone: w.at.zone ?? 1, slot: w.at.slot ?? null } });
          if (!one) {
            lines.push(`${name}: NOT changed – no bottle of it at that place.`);
            continue;
          }
          bottleIds = [one.id];
        }
        const changes = Object.fromEntries(
          (["drink_from", "drink_to", "peak_from", "peak_to", "price", "type", "grape", "country", "region", "body", "kosher", "shape", "alcohol", "note"] as const)
            .filter((k) => w[k] !== undefined)
            .map((k) => [k, w[k]]),
        );
        if (Object.keys(changes).length === 0) {
          lines.push(`${name}: NOT changed – nothing to change was given.`);
          continue;
        }
        const { data: undo, error } = await db.rpc("ai_edit_wine", { p_vintage_id: all[0].vintageId, p_bottle_ids: bottleIds, p_changes: changes });
        if (error || !undo) {
          lines.push(`${name}: NOT changed – the database refused it (check the values).`);
          continue;
        }
        await logChange("edit", { winery: w.winery, name: w.name, year }, undo as Record<string, unknown>);
        lines.push(`${name}: updated ${Object.keys(changes).join(", ")}${"price" in changes || "note" in changes ? ` (${bottleIds.length} bottle(s))` : ""}.`);
      }
      return done(lines);
    },
  );

  server.registerTool(
    "wishlist",
    {
      title: "The wishlist",
      description: "The wines the household wants to buy, with notes and where they saw them.",
      inputSchema: {},
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async () => {
      const { data } = await db
        .from("wishlist_items")
        .select("year, note, source_note, link_url, wines(winery, name, type)")
        .eq("cellar_id", cellarId)
        .order("created_at", { ascending: false })
        .limit(100);
      if (!data?.length) return text("The wishlist is empty.");
      return text(
        data
          .map((i) => {
            const w = i.wines as { winery: string; name: string; type: string } | null;
            return `- ${w ? `${w.winery} – ${w.name}` : "?"} ${i.year ?? "(any vintage)"}${i.note ? ` · ${i.note}` : ""}${i.source_note ? ` · ${i.source_note}` : ""}${i.link_url ? ` · ${i.link_url}` : ""}`;
          })
          .join("\n"),
      );
    },
  );

  server.registerTool(
    "add_to_wishlist",
    {
      title: "Add to the wishlist",
      description: `Add wines the user wants to buy (not bottles they have: those are suggest_bottles). Works only if the user lets you make changes yourself. ${ONE_CALL}`,
      inputSchema: {
        wines: z
          .array(
            z.object({
              winery: z.string().min(1).max(100),
              name: z.string().min(1).max(100),
              type: z.enum(DRAFT_TYPES).optional(),
              year: z.number().int().nullable().optional().describe("A specific vintage; omit for any vintage"),
              note: z.string().max(500).optional(),
              link: z.string().url().max(500).optional().describe("A shop or winery page"),
            }),
          )
          .min(1)
          .max(30),
      },
      annotations: write,
    },
    async ({ wines }) => {
      if (!canEdit) return suggestOnly("add to the wishlist");
      const lines: string[] = [];
      for (const w of wines) {
        const { data: item, error } = await db.rpc("add_to_wishlist", {
          p_winery: w.winery,
          p_name: w.name,
          p_type: w.type ?? "red",
          p_year: w.year ?? undefined,
          p_note: w.note,
          p_link: w.link,
        });
        if (error || !item) {
          lines.push(`${label(w)}: NOT added – ${error?.hint === "cellar_full" ? "the wishlist is full" : "the database refused it"}.`);
          continue;
        }
        await logChange("wishlist", { winery: w.winery, name: w.name, year: w.year ?? null }, { item });
        lines.push(`${label(w)}: added to the wishlist.`);
        lines.push(optionalLeft(label(w), [w.year == null ? "a specific vintage" : "", w.link ? "" : "a link to a shop or the winery", w.note ? "" : "a note (e.g. who recommended it)"].filter(Boolean)));
      }
      return done(lines);
    },
  );

  server.registerTool(
    "remove_from_wishlist",
    {
      title: "Remove from the wishlist",
      description:
        "Takes wines off the wishlist: the user bought them, or no longer wants them. If they bought it, also add the bottles with suggest_bottles (ask how many and where). " +
        `Works only if the user lets you make changes yourself. ${ONE_CALL}`,
      inputSchema: {
        wines: z
          .array(
            z.object({
              winery: z.string().describe("Exactly as in wishlist"),
              name: z.string().describe("Exactly as in wishlist"),
              year: z.number().int().nullable().optional().describe("The vintage as in wishlist; omit if it says any vintage"),
            }),
          )
          .min(1)
          .max(30),
      },
      annotations: write,
    },
    async ({ wines }) => {
      if (!canEdit) return suggestOnly("change the wishlist");
      const { data: items } = await db.from("wishlist_items").select("id, year, wines(winery, name)").eq("cellar_id", cellarId);
      const lines: string[] = [];
      for (const w of wines) {
        const year = w.year ?? null;
        const same = (items ?? []).filter((i) => {
          const x = i.wines as { winery: string; name: string } | null;
          return x && x.winery.toLowerCase() === w.winery.toLowerCase() && x.name.toLowerCase() === w.name.toLowerCase();
        });
        const item = same.find((i) => i.year === year) ?? (w.year === undefined && same.length === 1 ? same[0] : undefined);
        if (!item) {
          lines.push(`${label({ ...w, year })}: NOT removed – not on the wishlist (check the exact names and vintage with wishlist).`);
          continue;
        }
        const { data: removed, error } = await db.rpc("ai_remove_wishlist_item", { p_item: item.id });
        if (error || !removed) {
          lines.push(`${label({ ...w, year })}: NOT removed – the database refused it.`);
          continue;
        }
        await logChange("wishlist", { winery: w.winery, name: w.name, year: item.year, removed: true }, { removed });
        lines.push(`${label({ ...w, year: item.year })}: removed from the wishlist.`);
      }
      return done(lines);
    },
  );

  server.registerTool(
    "log_tasting",
    {
      title: "A wine drunk outside the cellar",
      description: `Record a wine the user drank that was NOT from their cellar (a restaurant, at friends), with date, place, notes and score. For a bottle from the cellar use suggest_drink. Works only if the user lets you make changes yourself. ${ONE_CALL}`,
      inputSchema: {
        wines: z
          .array(
            z.object({
              winery: z.string().min(1).max(100),
              name: z.string().min(1).max(100),
              type: z.enum(DRAFT_TYPES).optional(),
              year: z.number().int().nullable().optional(),
              date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("YYYY-MM-DD, default today"),
              place: z.string().max(200).optional().describe("e.g. the restaurant"),
              notes: z.string().max(1000).optional().describe("Tasting notes in the user's words"),
              score: z.number().min(1).max(5).optional().describe("The user's score, 1.0-5.0"),
            }),
          )
          .min(1)
          .max(30),
      },
      annotations: write,
    },
    async ({ wines }) => {
      if (!canEdit) return suggestOnly("record tastings");
      const lines: string[] = [];
      for (const w of wines) {
        const { data: tasting, error } = await db.rpc("log_tasting", {
          p_winery: w.winery,
          p_name: w.name,
          p_type: w.type ?? "red",
          p_year: w.year ?? undefined,
          p_tasted_on: w.date,
          p_place: w.place,
          p_notes: w.notes,
          p_score: w.score === undefined ? undefined : Math.round(w.score * 10) / 10,
        });
        if (error || !tasting) {
          lines.push(`${label(w)}: NOT recorded – the database refused it.`);
          continue;
        }
        await logChange("taste", { winery: w.winery, name: w.name, year: w.year ?? null }, { tasting });
        lines.push(`${label(w)}: recorded in the history${w.place ? ` (${w.place})` : ""}.`);
        lines.push(optionalLeft(label(w), [w.score === undefined ? "a score (1-5)" : "", w.place ? "" : "where they drank it", w.notes ? "" : "tasting notes"].filter(Boolean)));
      }
      return done(lines);
    },
  );

  server.registerTool(
    "edit_tasting",
    {
      title: "Correct a past tasting",
      description:
        "Changes a wine the household already drank, as the history shows it: its score (1.0-5.0, the household's score for that wine and vintage), tasting notes, place or date. " +
        "Call history first. Only what you pass changes; notes replace the old ones, so to add to them pass the old notes with the addition. " +
        `Works only if the user lets you make changes yourself. ${ONE_CALL}`,
      inputSchema: {
        tastings: z
          .array(
            z.object({
              winery: z.string().describe("Exactly as in history"),
              name: z.string().describe("Exactly as in history"),
              year: z.number().int().nullable().optional().describe("Vintage as in history; null for NV"),
              date: z.string().optional().describe("YYYY-MM-DD as in history; needed when it was drunk more than once"),
              score: z.number().min(1).max(5).optional(),
              notes: z.string().max(1000).optional(),
              place: z.string().max(120).optional(),
              new_date: z.string().optional().describe("YYYY-MM-DD, only to correct the date"),
            }),
          )
          .min(1)
          .max(30),
      },
      annotations: write,
    },
    async ({ tastings }) => {
      if (!canEdit) return suggestOnly("change the history");
      const history = await getHistory(cellarId, db);
      const lines: string[] = [];
      for (const t of tastings) {
        const name = label(t);
        const title = `${t.winery} – ${t.name}`.toLowerCase();
        const same = history.filter((h) => h.title.toLowerCase() === title && (t.year === undefined || h.year === (t.year ?? null)) && (!t.date || h.tastedOn === t.date));
        if (same.length !== 1) {
          lines.push(`${name}: NOT changed – ${same.length ? `drunk ${same.length} times: pass the date (${same.map((h) => h.tastedOn).join(", ")})` : "not in the history (check with history)"}.`);
          continue;
        }
        const changes = Object.fromEntries(
          ([["score", t.score], ["notes", t.notes], ["place", t.place], ["tasted_on", t.new_date]] as const).filter(([, v]) => v !== undefined),
        );
        if (Object.keys(changes).length === 0) {
          lines.push(`${name}: NOT changed – nothing to change was given.`);
          continue;
        }
        const { data: edited, error } = await db.rpc("ai_edit_tasting", { p_tasting: same[0].id, p_changes: changes });
        if (error || !edited) {
          lines.push(`${name}: NOT changed – the database refused it (a date cannot be in the future).`);
          continue;
        }
        await logChange("taste", { winery: t.winery, name: t.name, year: same[0].year, edited: true }, { edited });
        lines.push(`${name} (${same[0].tastedOn}): updated ${Object.keys(changes).join(", ")}.`);
      }
      return done(lines);
    },
  );

  const shelfSchema = z.object({
    arrangement: z.enum(CHOOSABLE_PRESETS as [string, ...string[]]).describe("twoRows (back and front row), oneRow, doubleStack (a pile, two layers) or twoStacks (two piles, back and front)"),
    size: z.number().int().min(1).max(50).describe("Bottles in the back row / the bottom layer"),
    front: z.number().int().min(0).max(50).optional().describe("Bottles lying across the front of the shelf, in front of the rows or pile (e.g. 2 in front of a pile); leave out if none"),
  });
  server.registerTool(
    "edit_fridge",
    {
      title: "Change the fridge's layout",
      description:
        "Change a fridge's shelves as on the site's fridge settings: the number of bottles a zone holds (e.g. one more slot on shelf 5), bottles lying across the front of a shelf, new shelves at the bottom, removing an empty shelf, its name, brand or model. Call fridge_layout first for the numbers. A change that would take bottles out of the fridge is refused. Works only if the user lets you make changes yourself.",
      inputSchema: {
        fridge: z.string().optional().describe("Fridge name or number from fridge_layout; needed when there are several"),
        resize: z
          .array(z.object({ shelf: z.number().int().min(1), zone: z.number().int().min(1).optional().describe("Default 1"), capacity: z.number().int().min(1).max(50).describe("The new number of bottles") }))
          .max(60)
          .optional(),
        add_shelves: z.array(shelfSchema).max(10).optional(),
        front: z
          .array(z.object({ shelf: z.number().int().min(1), bottles: z.number().int().min(0).max(50).describe("How many lie across the front; 0 removes the front row") }))
          .max(30)
          .optional()
          .describe("Bottles lying across the front of a shelf, in front of its rows or pile (adds, resizes or removes that row)"),
        remove_shelves: z.array(z.number().int().min(1)).max(10).optional().describe("Empty shelves to remove, by number"),
        name: z.string().min(1).max(60).optional().describe("A new name for the fridge"),
        brand: z.string().max(60).optional().describe("Fill in or correct the brand (\"\" clears it)"),
        model: z.string().max(60).optional().describe("Fill in or correct the model, as on its label (\"\" clears it)"),
      },
      annotations: write,
    },
    async ({ fridge, resize, add_shelves, front, remove_shelves, name, brand, model }) => {
      if (!canEdit) return suggestOnly("change the fridge");
      const fridges = await getFridges(cellarId, db);
      const f = pickFridge(fridges, fridge);
      if (!f) return text(fridges.length ? `NOT changed – there is no fridge "${fridge}" (see fridge_layout).` : "NOT changed – there is no fridge yet: set one up with create_fridge.");
      const r = applyFridgeEdit(f, { resize, add_shelves: add_shelves as never, front, remove_shelves, name, brand, model });
      if (!r.ok) return text(`NOT changed – ${r.error}.`);
      const { error } = await db.rpc("update_fridge", { p_fridge_id: f.id, p_name: r.name, p_shelves: r.shelves, p_brand: r.brand ?? undefined, p_model: r.model ?? undefined });
      if (error) return text("NOT changed – the database refused it (check the numbers with fridge_layout).");
      await logChange("fridge", { fridge: r.name }, { fridge: f.id, name: f.name, brand: f.brand, model: f.model, shelves: fridgeJson(f) });
      return done([`"${f.name}": ${r.summary.join("; ")}.`]);
    },
  );
  server.registerTool(
    "create_fridge",
    {
      title: "Set up a new fridge or cabinet",
      description:
        "Adds a new wine fridge, or a cabinet / rack (kind), as on the site's \"new fridge\" page: e.g. from a photo of it or the user's words. " +
        "Pass the shelves from the top as you count them (in a photo: every shelf, how the bottles lie, how many in the back row, and any bottles lying across the front). " +
        "Before you create a fridge, ask the user for its brand and model if you cannot read them (they are on a sticker inside, often on the side wall); if the user does not know, go on without. " +
        "A model in the app's list gets its usual layout when you pass no shelves. " +
        "Then show the user what you set up and offer to fill it shelf by shelf (the fill_fridge prompt); the shelves can be changed later with edit_fridge. " +
        "Works only if the user lets you make changes yourself.",
      inputSchema: {
        name: z.string().min(1).max(60).describe("What the user calls it, e.g. \"Kitchen\" or \"מקרר סלון\""),
        kind: z.enum(["fridge", "cabinet"]).optional().describe("fridge (default), or cabinet for a cupboard, rack or shelf unit"),
        brand: z.string().max(60).optional().describe("Fridges only, e.g. Landers, Vinopo"),
        model: z.string().max(60).optional().describe("Fridges only, as on its label or the maker's site"),
        shelves: z
          .array(shelfSchema)
          .min(1)
          .max(30)
          .optional()
          .describe("From the top shelf down"),
      },
      annotations: write,
    },
    async ({ name, kind, brand, model, shelves }) => {
      if (!canEdit) return suggestOnly("set up a fridge");
      const fridges = await getFridges(cellarId, db);
      const r = buildNewFridge({ name, kind, brand, model, shelves: shelves as never }, CATALOG, fridges.map((f) => f.name));
      if (!r.ok) return text(`NOT created – ${r.error}.`);
      const { data: id, error } = await db.rpc("ai_create_fridge", {
        p_name: r.name,
        p_shelves: r.shelves,
        p_kind: r.kind,
        p_brand: r.brand ?? undefined,
        p_model: r.model ?? undefined,
      });
      if (error || !id) return text("NOT created – the database refused it (at most 20 fridges, 30 shelves and 6 zones a shelf).");
      await logChange("fridge", { fridge: r.name, created: true }, { created: id });
      const what = r.kind === "cabinet" ? "Cabinet" : "Fridge";
      return done([
        `${what} "${r.name}" set up: ${r.summary}.${r.fromCatalog ? " This is the app's estimate for the model: ask the user whether the shelves match." : ""}`,
        optionalLeft(`"${r.name}"`, r.kind === "fridge" ? [r.brand ? "" : "brand", r.model ? "" : "model (on a sticker inside the fridge; add it with edit_fridge)"].filter(Boolean) : []),
        "Call fridge_layout to see it, then offer to fill it.",
      ]);
    },
  );
  server.registerTool(
    "set_label_photo",
    {
      title: "Add or replace label photos",
      description:
        "Gives wines already in the cellar a label photo from the web, or replaces the one they have (e.g. the user says the photo is wrong). " +
        "For each wine, find its page at a shop or the winery, or a direct image link, and say honestly how well it matches (image_match). " +
        `The user's own photos cannot be saved from the chat: for those, send them to ${labelsPage(siteUrl)}. Works only if the user lets you make changes yourself. ` +
        LABEL_SOURCES + " " +
        ONE_CALL,
      inputSchema: {
        wines: z
          .array(
            z.object({
              winery: z.string().describe("Exactly as in search_cellar"),
              name: z.string().describe("Exactly as in search_cellar"),
              image_url: z.string().describe("The wine's page at a shop or the winery (the server takes its main photo), or the image file (JPEG, PNG or WebP). Not a search results page."),
              image_match: imageMatchSchema,
            }),
          )
          .min(1)
          .max(30),
      },
      annotations: { ...write, openWorldHint: true },
    },
    async ({ wines }) => {
      if (!canEdit) return suggestOnly(`add label photos (they can take them themselves at ${labelsPage(siteUrl)})`);
      const { data: all } = await db.from("wines").select("id, winery, name, label_image_path, label_thumb").eq("cellar_id", cellarId);
      const lines: string[] = [];
      for (const w of wines) {
        const name = label(w);
        const wine = (all ?? []).find((x) => x.winery.toLowerCase() === w.winery.toLowerCase() && x.name.toLowerCase() === w.name.toLowerCase());
        if (!wine) {
          lines.push(`${name}: NOT saved – not in the cellar (check the exact winery and name with search_cellar).`);
          continue;
        }
        const match = w.image_match ?? "exact";
        const saved = await saveWebLabel(db, cellarId, w.image_url.trim(), match);
        if (!saved.ok) {
          lines.push(`${name}: label image NOT saved – ${saved.reason}. Try another link, or the user can take it at ${labelsPage(siteUrl)}.`);
          continue;
        }
        // The old photo stays in storage, so the undo can bring it back. The
        // fridge thumbnail is made again on the user's next visit.
        const { error } = await db.from("wines").update({ label_image_path: saved.path, label_thumb: null }).eq("id", wine.id);
        if (error) {
          lines.push(`${name}: label image NOT saved – the database refused it.`);
          continue;
        }
        await logChange("label", { winery: wine.winery, name: wine.name }, { wine: wine.id, path: wine.label_image_path, thumb: wine.label_thumb });
        lines.push(`${wine.label_image_path ? "Replaced. " : ""}${savedNote(name, match, siteUrl)}`);
      }
      return done(lines);
    },
  );
}
