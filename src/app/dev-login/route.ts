import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseUrl } from "@/lib/supabase/env";

/**
 * DEVELOPMENT ONLY: signs in as the local test user from supabase/seed.sql,
 * so screens can be checked without Google keys.
 *
 * Two independent guards keep it out of production:
 * 1. It answers 404 unless Next.js runs in development mode.
 * 2. It answers 404 unless the Supabase URL is on this computer.
 * And even if both failed, the cloud project has email sign-in turned off.
 */
const isLocalSupabase = /^http:\/\/(127\.0\.0\.1|localhost):/.test(supabaseUrl);

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV !== "development" || !isLocalSupabase) {
    return new NextResponse(null, { status: 404 });
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: "dev@example.com",
    password: "local-dev-password",
  });

  const target = error ? "/login?error=auth" : "/";
  return NextResponse.redirect(new URL(target, request.nextUrl.origin));
}
