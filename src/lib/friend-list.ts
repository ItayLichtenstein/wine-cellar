import { getLocale } from "@/i18n/server";
import { cellarTitle } from "@/lib/cellar-title";
import { createClient } from "@/lib/supabase/server";

export type FriendEntry = { id: string; title: string };

/** My friends' cellars with their display titles ("המרתף של מאיה"), sorted by title. */
export async function getFriendList(): Promise<FriendEntry[]> {
  const [supabase, locale] = await Promise.all([createClient(), getLocale()]);
  const [{ data: friends }, { data: custom }] = await Promise.all([supabase.rpc("my_friends"), supabase.rpc("friend_cellar_names")]);
  return (friends ?? [])
    .map((f) => ({
      id: f.cellar_id,
      title: cellarTitle(f.names, custom?.find((c) => c.cellar_id === f.cellar_id)?.custom_name, locale),
    }))
    .sort((a, b) => a.title.localeCompare(b.title, locale));
}
