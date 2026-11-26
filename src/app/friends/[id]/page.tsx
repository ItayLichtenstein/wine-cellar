import type { Metadata } from "next";
import { BackLink } from "@/components/back-link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CellarView } from "@/app/cellar-view";
import { drinkNow } from "@/lib/bottle-list";
import { cellarTitle } from "@/lib/cellar-title";
import { getCellarBottles, getFridges, getLooseBottles } from "@/lib/fridges";
import { createClient } from "@/lib/supabase/server";
import { bottles as countBottles } from "@/lib/plural";

export const metadata: Metadata = { title: "מרתף של חברים · מרתף יין" };

export default function FriendCellarPage({ params }: PageProps<"/friends/[id]">) {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-8">
      <Suspense fallback={<p className="text-muted">טוען…</p>}>
        <FriendCellar params={params} />
      </Suspense>
    </main>
  );
}

/**
 * A friend's cellar, read-only. The same loaders as my own fridge, with the
 * friend's cellar id; RLS decides what comes back (prices only if shared).
 */
async function FriendCellar({ params }: { params: PageProps<"/friends/[id]">["params"] }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: friends }, { data: custom }] = await Promise.all([supabase.rpc("my_friends"), supabase.rpc("friend_cellar_names")]);
  const friend = friends?.find((f) => f.cellar_id === id);
  if (!friend) notFound();

  const [fridges, loose, all] = await Promise.all([getFridges(id), getLooseBottles(id), getCellarBottles(id)]);
  const stored = fridges.flatMap((f) => f.shelves.flatMap((s) => s.zones.flatMap((z) => z.bottles))).length;

  return (
    <>
      <header className="flex flex-col gap-1">
        <BackLink href="/sharing" label="שיתוף" />
        <h1 className="text-2xl font-bold" dir="auto">
          {cellarTitle(friend.names, custom?.find((c) => c.cellar_id === id)?.custom_name)}
        </h1>
        <p className="text-sm text-muted">
          <span className="inline-block">{countBottles(stored)} במקרר · צפייה בלבד.</span>{" "}
          <span className="inline-block">לחיצה על בקבוק – ואפשר להוסיף אותו ל־Wishlist.</span>
        </p>
      </header>
      {fridges.length === 0 ? (
        <p className="text-muted">עוד אין להם מקרר.</p>
      ) : (
        <CellarView fridges={fridges} loose={loose} drinkNow={drinkNow(all)} canEdit={false} />
      )}
    </>
  );
}
