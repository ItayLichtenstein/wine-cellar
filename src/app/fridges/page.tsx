import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BackLink } from "@/components/back-link";
import { getCurrentUser } from "@/lib/auth";
import { fridgeCapacity } from "@/lib/fridge-layout";
import { getFridges } from "@/lib/fridges";
import { FridgeList } from "./fridge-list";

export const metadata: Metadata = { title: "המקררים · מרתף יין" };

/** Every fridge in the cellar: order, edit, add. Part of the fridge tab. */
export default function FridgesPage() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 px-4 py-8">
      <header className="flex flex-col gap-1">
        <BackLink href="/" label="המקרר" />
        <h1 className="text-2xl font-bold">המקררים</h1>
      </header>
      <Suspense fallback={<p className="text-muted">טוען…</p>}>
        <Fridges />
      </Suspense>
    </main>
  );
}

async function Fridges() {
  const user = await getCurrentUser();
  const fridges = await getFridges(user.cellarId);
  return (
    <section className="flex flex-col gap-2">
      {fridges.length === 0 && <p className="text-muted">עוד אין כאן מקרר.</p>}
      {fridges.length > 1 && <p className="text-sm text-muted">המקרר הראשון ברשימה הוא זה שנפתח במסך הראשי.</p>}
      {fridges.length > 0 && (
        <FridgeList
          key={fridges.map((f) => f.id).join()} // a new fridge resets the local order
          canEdit={user.canEdit}
          fridges={fridges.map((f) => ({
            id: f.id,
            name: f.name,
            details: [[f.brand, f.model].filter(Boolean).join(" "), `מקום ל־${fridgeCapacity(f.shelves)}`].filter(Boolean).join(" · "),
          }))}
        />
      )}
      {user.canEdit && (
        <Link href="/fridges/new" className="self-start rounded-full border border-muted/40 px-4 py-2 text-sm">
          + הוספת מקרר
        </Link>
      )}
    </section>
  );
}
