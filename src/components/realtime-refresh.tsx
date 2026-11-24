"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

const TABLES = [
  "bottles", "bottle_prices", "wines", "wine_vintages", "critic_scores", "ratings",
  "tastings", "fridges", "shelves", "shelf_zones", "cellar_members",
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

    const channel = supabase.channel("cellar-changes");
    for (const table of TABLES) {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, refresh);
    }
    channel.subscribe();

    return () => {
      clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [router]);

  return null;
}
