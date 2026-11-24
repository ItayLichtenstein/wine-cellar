import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type CurrentUser = {
  id: string;
  displayName: string;
};

/**
 * The signed-in user, or a redirect to /login.
 * One place for this check = the "Data Access Layer" pattern from the
 * Next.js docs. Must be called inside a <Suspense> boundary, because it
 * reads the request's cookies.
 */
export async function getCurrentUser(): Promise<CurrentUser> {
  const supabase = await createClient();

  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect("/login");

  // RLS lets a user read their own profile only (and their household's).
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", userId)
    .single();

  return { id: userId, displayName: profile?.display_name ?? "" };
}
