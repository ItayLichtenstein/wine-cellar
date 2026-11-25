import { supabaseUrl } from "@/lib/supabase/env";

/**
 * RFC 9728: tells an MCP client that /api/mcp is protected and that
 * Supabase Auth (our OAuth 2.1 server) issues its tokens. The client then
 * registers itself, sends the user to our consent screen, and comes back
 * with a token.
 */
export function GET(request: Request) {
  const origin = new URL(request.url).origin;
  return Response.json({
    resource: `${origin}/api/mcp`,
    authorization_servers: [`${supabaseUrl}/auth/v1`],
    bearer_methods_supported: ["header"],
    resource_name: "מרתף יין",
  });
}
