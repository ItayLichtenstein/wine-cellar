/**
 * Where an import script writes, and as whom: the local Supabase from
 * .env.local, signed in as the local test user (IMPORT_EMAIL /
 * IMPORT_PASSWORD override it). Real users import from the site (/import),
 * so there is deliberately no production path here any more.
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
  const env = readEnv(".env.local");
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  const { error } = await supabase.auth.signInWithPassword({
    email: process.env.IMPORT_EMAIL ?? "dev@example.com",
    password: process.env.IMPORT_PASSWORD ?? "local-dev-password",
  });
  if (error) throw new Error(`Sign-in failed: ${error.message}`);
  return { supabase, where: "local" };
}
