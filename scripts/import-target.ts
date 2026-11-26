/**
 * Where an import script writes, and as whom.
 *
 * Local (default): the Supabase URL/key from .env.local, signed in as the
 * local test user (IMPORT_EMAIL / IMPORT_PASSWORD override it).
 *
 * Production: put three lines in .env.import.local (git ignores it):
 *   IMPORT_SUPABASE_URL=https://<ref>.supabase.co
 *   IMPORT_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
 *   IMPORT_ACCESS_TOKEN=<your access token from the site, valid ~1 hour>
 * The script then acts as you, through the normal API, so RLS applies just
 * as on the site. No secret / service_role key is ever needed or read.
 * Nothing from that file is printed.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";

function readEnv(path: string): Record<string, string> {
  if (!existsSync(path)) return {};
  return Object.fromEntries(
    readFileSync(path, "utf8")
      .split("\n")
      .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
      .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
  );
}

export async function connect(): Promise<{ supabase: SupabaseClient; where: string }> {
  const prod = readEnv(".env.import.local");
  if (prod.IMPORT_ACCESS_TOKEN) {
    const { IMPORT_SUPABASE_URL: url, IMPORT_SUPABASE_PUBLISHABLE_KEY: key, IMPORT_ACCESS_TOKEN: token } = prod;
    if (!url?.startsWith("https://") || !key?.startsWith("sb_publishable_")) {
      throw new Error(".env.import.local needs IMPORT_SUPABASE_URL (https://…) and IMPORT_SUPABASE_PUBLISHABLE_KEY (sb_publishable_…)");
    }
    const supabase = createClient(url, key, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) throw new Error("The access token was not accepted (expired? copy a fresh one from the site).");
    return { supabase, where: `production (${new URL(url).host})` };
  }

  const env = readEnv(".env.local");
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  const { error } = await supabase.auth.signInWithPassword({
    email: process.env.IMPORT_EMAIL ?? "dev@example.com",
    password: process.env.IMPORT_PASSWORD ?? "local-dev-password",
  });
  if (error) throw new Error(`Sign-in failed: ${error.message}`);
  return { supabase, where: "local" };
}
