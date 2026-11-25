"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

const TABLES = [
  "bottles", "bottle_prices", "wines", "wine_vintages", "critic_scores", "ratings",
  "tastings", "fridges", "shelves", "shelf_zones", "cellar_members", "wishlist_items",
] as const;

/**
 * Keeps the screen in sync with the rest of the household: any change to
 * the cellar (by anyone, in any tab) reloads the page's server data.
 * Events are only a signal – the data itself is re-read through the normal
 * RLS-protected queries. Many changes at once (adding 6 bottles) are
 * batched into one refresh.
 */
export function RealtimeRefresh() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 400);
    };

    // Friends can read our cellar and we theirs (RLS), so listen to our own
    // cellar only: a friend adding a bottle should not reload our screen.
    // (Deletes cannot be filtered by Supabase; they arrive for every cellar.)
    let channel: ReturnType<typeof supabase.channel> | undefined;
    let stopped = false;
    supabase.rpc("my_cellar_id").then(({ data: cellarId }) => {
      if (stopped || !cellarId) return;
      channel = supabase.channel("cellar-changes");
      const filter = `cellar_id=eq.${cellarId}`;
      for (const table of TABLES) {
        channel.on("postgres_changes", { event: "*", schema: "public", table, filter }, refresh);
      }
      channel.on("postgres_changes", { event: "*", schema: "public", table: "friend_links" }, refresh);
      channel.subscribe();
    });

    return () => {
      stopped = true;
      clearTimeout(timer);
      if (channel) supabase.removeChannel(channel);
    };
  }, [router]);

  return null;
}
