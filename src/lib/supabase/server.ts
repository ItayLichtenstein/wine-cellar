import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";
import type { Database } from "@/lib/database.types";
import { supabaseKey, supabaseUrl } from "./env";

/**
 * Supabase client for code that runs on the server
 * (Server Components, Route Handlers, Server Actions).
 * It acts as the signed-in user, so RLS applies exactly as in the browser.
 */
export async function createClient() {
  // Tell Next.js this work belongs to one request and must never be cached
  // or prerendered. (Supabase checks token expiry with Date.now(), which
  // Cache Components refuses to bake into a shared static page.)
  await connection();
  const cookieStore = await cookies();

  return createServerClient<Database>(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components can't set cookies. That's fine: the proxy
          // (src/proxy.ts) refreshes the session before every page.
        }
      },
    },
  });
}
