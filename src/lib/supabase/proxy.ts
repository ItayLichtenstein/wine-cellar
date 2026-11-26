import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseKey, supabaseUrl } from "./env";

// Pages anyone may open without signing in.
// /dev-login guards itself (404 outside local development).
const PUBLIC_PATHS = ["/login", "/auth", "/privacy", "/dev-login", "/join", "/friend-invite", "/shared", "/api/mcp", "/api/health", "/.well-known", "/opengraph-image", "/manifest.webmanifest", "/pwa-icon", "/apple-icon"];

function isPublic(path: string) {
  return PUBLIC_PATHS.some((p) => path === p || path.startsWith(p + "/"));
}

/**
 * Runs before every page (called from src/proxy.ts):
 * 1. Refreshes the login session and writes fresh cookies.
 * 2. Sends signed-out visitors to /login, and signed-in ones away from it.
 *
 * Step 2 is for convenience only. The real protection is RLS in the
 * database: even without this redirect, a signed-out visitor gets no data.
 * (Relying on middleware/proxy for authorization is a known pitfall –
 * see CVE-2025-29927 in docs/security.md.)
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        // Headers like Cache-Control: no-store, so a CDN never caches a
        // response that carries someone's session cookie.
        for (const [key, value] of Object.entries(headers ?? {})) {
          response.headers.set(key, value);
        }
      },
    },
  });

  // Verifies the session and refreshes it if it expired.
  // Don't put code between createServerClient and this call.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims);
  const path = request.nextUrl.pathname;

  if (!signedIn && !isPublic(path)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    // Keep the query too: the OAuth consent page needs ?authorization_id=…
    // (safeNextPath still checks it on the way back).
    url.searchParams.set("next", path + request.nextUrl.search);
    return NextResponse.redirect(url);
  }

  if (signedIn && path === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}
