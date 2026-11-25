import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type CurrentUser = {
  id: string;
  /**
   * The user's own cellar. Every query of "my" data filters by it: once
   * friends exist, RLS lets a user read friends' cellars too (ADR 0008).
   */
  cellarId: string;
  displayName: string;
  /** False until the user confirmed a name (first sign-in). */
  onboarded: boolean;
  /** A viewer only reads (spec); the UI hides editing for them. RLS enforces it anyway. */
  canEdit: boolean;
};

/**
 * The signed-in user, or a redirect to /login.
 * One place for this check = the "Data Access Layer" pattern from the
 * Next.js docs. Must be called inside a <Suspense> boundary, because it
 * reads the request's cookies. `cache` = one lookup per request, however
 * many components ask.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser> => {
  const supabase = await createClient();

  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect("/login");

  // RLS lets a user read their own profile only (and their household's).
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, onboarded_at")
    .eq("id", userId)
    .single();

  const { data: member } = await supabase.from("cellar_members").select("cellar_id, role").eq("user_id", userId).maybeSingle();
  // Every user gets a cellar on sign-up (trigger), so this only fails mid-reset.
  if (!member) redirect("/login");

  return {
    id: userId,
    cellarId: member.cellar_id,
    displayName: profile?.display_name ?? "",
    onboarded: Boolean(profile?.onboarded_at),
    canEdit: member.role === "member",
  };
});
