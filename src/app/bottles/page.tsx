import type { Metadata } from "next";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth";
import { getCellarBottles } from "@/lib/fridges";
import { BottleList } from "./bottle-list";

export const metadata: Metadata = { title: "רשימה · מרתף יין" };

export default function BottlesPage() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 px-4 py-8">
      <h1 className="text-2xl font-bold">רשימת הבקבוקים</h1>
      <Suspense fallback={<p className="text-muted">טוען…</p>}>
        <ListWithData />
      </Suspense>
    </main>
  );
}

async function ListWithData() {
  const { cellarId } = await getCurrentUser();
  return <BottleList bottles={await getCellarBottles(cellarId)} />;
}
