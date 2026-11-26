import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * For uptime checks: one real, harmless database query (the same one the
 * keep-alive job sends: a share link token that cannot exist). Returns no
 * data at all, only whether the site and the database answer.
 */
export async function GET() {
  await connection();
  const supabase = await createClient();
  const { error } = await supabase.rpc("shared_cellar", { p_token: "health-check" });
  return Response.json({ ok: !error }, { status: error ? 503 : 200, headers: { "Cache-Control": "no-store" } });
}
