import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CellarView } from "@/app/cellar-view";
import { FriendsPicker } from "@/components/friends-picker";
import { getLocale, getT } from "@/i18n/server";
import { drinkNow } from "@/lib/bottle-list";
import { getFriendList } from "@/lib/friend-list";
import { getCellarBottles, getFridges, getLooseBottles } from "@/lib/fridges";

export const metadata: Metadata = { title: "מרתף של חברים · מרתף יין" };

export default async function FriendCellarPage({ params }: PageProps<"/friends/[id]">) {
  const t = await getT();
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-8">
      <Suspense fallback={<p className="text-muted">{t.common.loading}</p>}>
        <FriendCellar params={params} />
      </Suspense>
    </main>
  );
}

/**
 * A friend's cellar, read-only. The same loaders as my own fridge, with the
 * friend's cellar id; RLS decides what comes back (prices only if shared).
 * The way back to my own fridge is a clear button, not a small "up" link:
 * a tester got lost here and could not find her own fridge again.
 */
async function FriendCellar({ params }: { params: PageProps<"/friends/[id]">["params"] }) {
  const { id } = await params;
  const [friends, t, locale] = await Promise.all([getFriendList(), getT(), getLocale()]);
  const friend = friends.find((f) => f.id === id);
  if (!friend) notFound();

  const [fridges, loose, all] = await Promise.all([getFridges(id), getLooseBottles(id), getCellarBottles(id, undefined, locale)]);
  const stored = fridges.flatMap((f) => f.shelves.flatMap((s) => s.zones.flatMap((z) => z.bottles))).length;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href="/" className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-white dark:text-black">
          <span aria-hidden="true" className="inline-block ltr:-scale-x-100">→</span> {t.friends.toMine}
        </Link>
        {friends.length > 1 && <FriendsPicker friends={friends} currentId={id} />}
      </div>
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold" dir={locale === "en" ? "ltr" : "auto"}>
          {friend.title}
        </h1>
        <p className="text-sm text-muted">
          <span className="inline-block">
            {t.home.inFridge(stored)} · {t.friends.viewOnly}
          </span>{" "}
          <span className="inline-block">({t.friends.tapToWish})</span>
        </p>
      </header>
      {fridges.length === 0 ? (
        <p className="text-muted">{t.friends.noFridge}</p>
      ) : (
        <CellarView fridges={fridges} loose={loose} drinkNow={drinkNow(all)} canEdit={false} />
      )}
    </>
  );
}
