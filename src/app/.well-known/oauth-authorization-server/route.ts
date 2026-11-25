import { supabaseUrl } from "@/lib/supabase/env";

/**
 * Some MCP clients look for the authorization server's metadata on the
 * resource's own origin. We pass on Supabase's document unchanged (its
 * endpoints still point to Supabase), so those clients find it too.
 */
export async function GET() {
  const res = await fetch(`${supabaseUrl}/auth/v1/.well-known/oauth-authorization-server`, { cache: "no-store" });
  if (!res.ok) return new Response("Not available", { status: 502 });
  return Response.json(await res.json());
}
