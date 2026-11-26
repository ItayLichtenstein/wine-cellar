import type { Metadata } from "next";
import { getT } from "@/i18n/server";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Wishlist, type Wish } from "./wishlist";

export const metadata: Metadata = { title: "Wishlist · מרתף יין" };

export default async function WishlistPage() {
  const t = await getT();
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 px-4 py-8">
      <h1 className="text-2xl font-bold">Wishlist</h1>
      <Suspense fallback={<p className="text-muted">{t.common.loading}</p>}>
        <WithData />
      </Suspense>
    </main>
  );
}

async function WithData() {
  const [supabase, user] = await Promise.all([createClient(), getCurrentUser()]);
  const { data } = await supabase
    .from("wishlist_items")
    .select("id, year, note, link_url, source_note, wines(winery, name, type)")
    .eq("cellar_id", user.cellarId)
    .order("created_at", { ascending: false });
  const wishes: Wish[] = (data ?? []).map((w) => ({
    id: w.id,
    winery: w.wines?.winery ?? "",
    name: w.wines?.name ?? "",
    year: w.year,
    note: w.note ?? "",
    link: w.link_url ?? "",
    source: w.source_note ?? "",
  }));
  return <Wishlist wishes={wishes} canEdit={user.canEdit} />;
}
