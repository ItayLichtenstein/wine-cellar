import type { Metadata } from "next";
import { getT } from "@/i18n/server";
import Link from "next/link";
import { Suspense } from "react";
import { BackLink } from "@/components/back-link";
import { getCurrentUser } from "@/lib/auth";
import { fridgeCapacity } from "@/lib/fridge-layout";
import { getFridges } from "@/lib/fridges";
import { FridgeList } from "./fridge-list";

export const metadata: Metadata = { title: "המקררים · מרתף יין" };

/** Every fridge in the cellar: order, edit, add. Part of the fridge tab. */
export default async function FridgesPage() {
  const t = await getT();
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 px-4 py-8">
      <header className="flex flex-col gap-1">
        <BackLink href="/" label={t.friends.toMine} />
        <h1 className="text-2xl font-bold">{t.fridgeSetup.listTitle}</h1>
      </header>
      <Suspense fallback={<p className="text-muted">{t.common.loading}</p>}>
        <Fridges />
      </Suspense>
    </main>
  );
}

async function Fridges() {
  const [user, t] = await Promise.all([getCurrentUser(), getT()]);
  const f = t.fridgeSetup;
  const fridges = await getFridges(user.cellarId);
  return (
    <section className="flex flex-col gap-2">
      {fridges.length === 0 && <p className="text-muted">{f.none}</p>}
      {fridges.length > 1 && <p className="text-sm text-muted">{f.firstShown}</p>}
      {fridges.length > 0 && (
        <FridgeList
          key={fridges.map((f) => f.id).join()} // a new fridge resets the local order
          canEdit={user.canEdit}
          fridges={fridges.map((fr) => ({
            id: fr.id,
            name: fr.name,
            details: [[fr.brand, fr.model].filter(Boolean).join(" "), f.roomFor(fridgeCapacity(fr.shelves))].filter(Boolean).join(" · "),
          }))}
        />
      )}
      {user.canEdit && (
        <Link href="/fridges/new" className="self-start rounded-full border border-muted/40 px-4 py-2 text-sm">
          {f.add}
        </Link>
      )}
    </section>
  );
}
