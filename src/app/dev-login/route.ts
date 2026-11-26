import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseUrl } from "@/lib/supabase/env";

/**
 * DEVELOPMENT ONLY: signs in as a local test user from supabase/seed.sql,
 * so screens can be checked without Google keys.
 *
 *   /dev-login          → dev@example.com, the full (imported) cellar
 *   /dev-login?as=new   → new@example.com, emptied on every sign-in, so it
 *                         always looks like a brand-new sign-up
 *   /dev-login?as=new&keep → the same user, without the reset (to test it
 *                         as a member or viewer of a shared cellar)
 *   /dev-login?as=friend → friend@example.com, a small cellar of its own,
 *                         already a friend of dev@example.com (never reset).
 *                         Sign in as dev on localhost:3000 and as friend on
 *                         127.0.0.1:3000 – each host keeps its own cookies.
 *
 * Two independent guards keep it out of production:
 * 1. It answers 404 unless Next.js runs in development mode.
 * 2. It answers 404 unless the Supabase URL is on this computer.
 * And even if both failed, the cloud project has email sign-in turned off.
 */
const isLocalSupabase = /^http:\/\/(127\.0\.0\.1|localhost):/.test(supabaseUrl);

const USERS = {
  dev: "dev@example.com",
  new: "new@example.com",
  friend: "friend@example.com",
} as const;

function pickUser(as: string | null): keyof typeof USERS {
  return as === "new" || as === "friend" ? as : "dev";
}

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV !== "development" || !isLocalSupabase) {
    return new NextResponse(null, { status: 404 });
  }

  const as = pickUser(request.nextUrl.searchParams.get("as"));
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: USERS[as],
    password: "local-dev-password",
  });

  if (!error && as === "new" && !request.nextUrl.searchParams.has("keep")) {
    // Back to a fresh sign-up. Runs as the user itself, so RLS limits the
    // deletes to its own cellar. Deleting wines cascades to vintages,
    // bottles, prices, ratings and tastings; fridges cascade to shelves.
    // If it joined someone's cellar (invite tests), leave first – otherwise
    // the reset below would empty the SHARED cellar. Leaving gives it a
    // fresh cellar of its own; if it is alone this fails harmlessly.
    await supabase.rpc("leave_cellar");
    const { data: cellarId } = await supabase.rpc("my_cellar_id");
    if (cellarId) {
      await supabase.from("wines").delete().eq("cellar_id", cellarId);
      await supabase.from("fridges").delete().eq("cellar_id", cellarId);
    }
    await supabase
      .from("profiles")
      .update({ display_name: "משתמש חדש", onboarded_at: null })
      .eq("id", data.user.id);
  }

  const target = error ? "/login?error=auth" : "/";
  // The Host header, not nextUrl.origin: Next.js reports 127.0.0.1 as
  // localhost, which would land on the other host (and its other user).
  const origin = `${request.nextUrl.protocol}//${request.headers.get("host") ?? request.nextUrl.host}`;
  return NextResponse.redirect(new URL(target, origin));
}
