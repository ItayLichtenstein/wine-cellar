import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getMyFridges, getMyWineNames } from "@/lib/fridges";
import { AddBottlesForm } from "./add-bottles-form";

export const metadata: Metadata = { title: "הוספת בקבוקים · מרתף יין" };

export default function AddBottlesPage() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-1">
        <Link href="/" className="text-sm text-muted underline-offset-2 hover:underline">
          → חזרה
        </Link>
        <h1 className="text-2xl font-bold">הוספת בקבוקים</h1>
      </header>
      {/* Loads the user's fridges and wines, so it streams in behind Suspense. */}
      <Suspense fallback={<p className="text-muted">טוען…</p>}>
        <FormWithData />
      </Suspense>
    </main>
  );
}

async function FormWithData() {
  const [fridges, wines] = await Promise.all([getMyFridges(), getMyWineNames()]);
  return <AddBottlesForm fridges={fridges} wines={wines} />;
}
