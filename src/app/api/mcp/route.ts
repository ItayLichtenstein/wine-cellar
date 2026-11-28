import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { buildMcpServer } from "@/lib/mcp/server";
import { supabaseKey, supabaseUrl } from "@/lib/supabase/env";

/**
 * The MCP endpoint (Streamable HTTP, stateless: a new server per request,
 * which suits serverless hosting). Every request must carry a Supabase
 * access token from our OAuth server; without one the client is told where
 * to sign in (RFC 9728 protected-resource metadata).
 */
async function handle(request: Request): Promise<Response> {
  const origin = new URL(request.url).origin;
  const unauthorized = () =>
    new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: {
        "Content-Type": "application/json",
        "WWW-Authenticate": `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource"`,
      },
    });

  const token = request.headers.get("authorization")?.match(/^Bearer (\S+)$/i)?.[1];
  if (!token) return unauthorized();

  // A client that acts as the token's user: RLS and the read-only rule for
  // AI clients (ADR 0009) apply to every query it makes.
  const db = createClient<Database>(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  // Verifies the signature and expiry, not just that a token is present.
  // getClaims alone checks the signature locally (asymmetric keys), so a
  // token of a disconnected AI would still work until it expires (up to an
  // hour). getUser asks the auth server, which refuses a token whose session
  // ended (the user disconnected the AI, or signed out everywhere).
  const [{ data: claims, error }, { error: sessionError }] = await Promise.all([db.auth.getClaims(token), db.auth.getUser(token)]);
  if (error || sessionError || !claims?.claims?.sub) return unauthorized();

  const { data: cellarId } = await db.rpc("my_cellar_id");
  if (!cellarId) return unauthorized();

  // Edit mode: the user chose "make changes itself" for this AI (ADR 0013).
  // The database guard checks the same row on every write.
  const clientId = typeof claims.claims.client_id === "string" ? claims.claims.client_id : null;
  const { data: grant } = clientId
    ? await db.from("ai_edit_grants").select("client_id").eq("client_id", clientId).maybeSingle()
    : { data: null };

  const server = buildMcpServer({ db, cellarId, siteUrl: origin, canEdit: grant !== null });
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await server.connect(transport);
  return transport.handleRequest(request);
}

export const POST = handle;
export const GET = handle;
export const DELETE = handle;
