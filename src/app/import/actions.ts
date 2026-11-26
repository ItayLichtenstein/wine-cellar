"use server";

import { z } from "zod";
import { MAX_BOTTLES } from "@/lib/import-csv";
import { createClient } from "@/lib/supabase/server";

// A public endpoint like every Server Action: the input is checked here with
// the same limits as the database columns, and the write itself runs as the
// signed-in user, so RLS decides whose cellar it may touch.
const year = z.number().int().min(1900).max(2200).optional();
const money = z.number().min(0).max(99_999_999).optional();
const date = z.iso.date().optional();
const text = (max: number) => z.string().trim().max(max).optional();

const Bottle = z.object({
  winery: z.string().trim().min(1).max(120),
  name: z.string().trim().min(1).max(120),
  type: z.enum(["red", "white", "rose", "orange", "sparkling", "dessert", "fortified", "other"]).optional(),
  year: z.number().int().min(1900).max(2100).optional(),
  status: z.enum(["unplaced", "in_transit", "consumed"]),
  grape: text(200),
  country: text(60),
  region: text(120),
  kosher: z.enum(["yes", "no"]).optional(),
  alcohol: z.number().min(0).max(25).optional(),
  drink_from: year,
  drink_to: year,
  peak_from: year,
  peak_to: year,
  added_on: date,
  consumed_on: date,
  note: text(1000),
  link_url: z.string().max(2048).regex(/^https?:\/\//i).optional(),
  paid: money,
  regular: money,
  is_gift: z.boolean().optional(),
});

const Input = z.object({
  source: z.literal("csv"),
  fileHash: z.string().regex(/^[0-9a-f]{64}$/).nullable(),
  bottles: z.array(Bottle).min(1).max(MAX_BOTTLES),
});

export type ImportResult = { ok: true; bottles: number; wines: number } | { ok: false; error: "invalid" | "notAllowed" | "failed" };

export async function importBottles(input: unknown): Promise<ImportResult> {
  const parsed = Input.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return { ok: false, error: "notAllowed" };

  const { source, fileHash, bottles } = parsed.data;
  const { data, error } = await supabase.rpc("import_cellar", { p_source: source, p_file_hash: fileHash as string /* may be null: the column allows it */, p_bottles: bottles });
  if (error) {
    // Details stay in the server log; the user gets a plain message.
    console.error("import_cellar failed", error.code);
    return { ok: false, error: error.code === "42501" ? "notAllowed" : "failed" };
  }
  const result = data as { bottles: number; wines: number };
  return { ok: true, bottles: result.bottles, wines: result.wines };
}
