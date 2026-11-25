import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { Suspense } from "react";
import type { Place } from "@/components/fridge-preview";
import { getFridges, getWineNames, type FridgeView } from "@/lib/fridges";
import { createClient } from "@/lib/supabase/server";
import { AddBottlesForm } from "./add-bottles-form";

export const metadata: Metadata = { title: "הוספת בקבוקים · מרתף יין" };

type SearchParams = Promise<{ zone?: string; slot?: string; wish?: string }>;

export default function AddBottlesPage({ searchParams }: { searchParams: SearchParams }) {
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
        <FormWithData searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function FormWithData({ searchParams }: { searchParams: SearchParams }) {
  const { cellarId } = await getCurrentUser();
  const [fridges, wines, params] = await Promise.all([getFridges(cellarId), getWineNames(cellarId), searchParams]);
  return (
    <AddBottlesForm
      fridges={fridges}
      wines={wines}
      initialPlace={findEmptyPlace(fridges, params)}
      fromWish={params.wish ? await loadWish(cellarId, params.wish) : undefined}
    />
  );
}

/** "קניתי" on the wishlist: the wish's wine pre-fills the form (own list only). */
async function loadWish(cellarId: string, id: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("wishlist_items").select("id, year, wines(winery, name, type)").eq("id", id).eq("cellar_id", cellarId).maybeSingle();
  if (!data?.wines) return undefined;
  return { id: data.id, winery: data.wines.winery, name: data.wines.name, type: data.wines.type, year: data.year };
}

/**
 * ?zone=…&slot=… comes from tapping an empty slot on the home page.
 * The URL is user input, so it is used only if it names an empty place
 * in one of the user's own fridges; anything else is ignored.
 */
function findEmptyPlace(fridges: FridgeView[], { zone, slot }: { zone?: string; slot?: string }): Place | undefined {
  const z = fridges.flatMap((f) => f.shelves.flatMap((s) => s.zones)).find((x) => x.id === zone);
  if (!z) return undefined;
  if (z.kind === "stack") return z.bottles.length < z.capacity ? { zoneId: z.id, slot: null } : undefined;
  const n = Number(slot);
  if (!Number.isInteger(n) || n < 1 || n > z.capacity || z.bottles.some((b) => b.slot === n)) return undefined;
  return { zoneId: z.id, slot: n };
}
