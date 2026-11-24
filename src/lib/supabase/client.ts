import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/database.types";
import { supabaseKey, supabaseUrl } from "./env";

/** Supabase client for code that runs in the browser ("use client" components). */
export function createClient() {
  return createBrowserClient<Database>(supabaseUrl, supabaseKey);
}
