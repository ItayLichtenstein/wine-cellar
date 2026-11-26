import { pageTitle } from "@/i18n/metadata";
import { getConnectedAis } from "@/lib/ai-grants";
import { BackLink } from "@/components/back-link";
import { getT } from "@/i18n/server";
import { getCurrentUser } from "@/lib/auth";
import { Suspense } from "react";
import type { Place } from "@/components/fridge-preview";
import { getFridges, getWineNames, type FridgeView } from "@/lib/fridges";
import { createClient } from "@/lib/supabase/server";
import { resolvePlaces } from "@/lib/draft-places";
import { parseBottleDraft } from "@/lib/drafts";
import { AddBottlesForm, type Prefill } from "./add-bottles-form";

export const generateMetadata = pageTitle((t) => t.titles.addBottles);

type SearchParams = Promise<{ zone?: string; slot?: string; wish?: string; draft?: string }>;

export default async function AddBottlesPage({ searchParams }: { searchParams: SearchParams }) {
  const t = await getT();
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-1">
        <BackLink href="/" label={t.settings.back} />
        <h1 className="text-2xl font-bold">{t.bottleForm.addTitle}</h1>
      </header>
      {/* Loads the user's fridges and wines, so it streams in behind Suspense. */}
      <Suspense fallback={<p className="text-muted">{t.common.loading}</p>}>
        <FormWithData searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function FormWithData({ searchParams }: { searchParams: SearchParams }) {
  const { cellarId } = await getCurrentUser();
  const [fridges, wines, params, ais] = await Promise.all([
    getFridges(cellarId),
    getWineNames(cellarId),
    searchParams,
    getConnectedAis(),
  ]);
  return (
    <AddBottlesForm
      fridges={fridges}
      wines={wines}
      initialPlace={findEmptyPlace(fridges, params)}
      aiConnected={ais.length > 0}
      prefill={params.wish ? await loadWish(cellarId, params.wish) : params.draft ? await loadDraft(cellarId, params.draft, fridges) : undefined}
    />
  );
}

/** "קניתי" on the wishlist: the wish's wine pre-fills the form (own list only). */
async function loadWish(cellarId: string, id: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("wishlist_items").select("id, year, wines(winery, name, type)").eq("id", id).eq("cellar_id", cellarId).maybeSingle();
  if (!data?.wines) return undefined;
  return { wishId: data.id, winery: data.wines.winery, name: data.wines.name, type: data.wines.type, year: data.year };
}

/**
 * An AI draft opens the same form, pre-filled, as its approval screen.
 * The payload is checked again here (it was stored as JSON).
 */
async function loadDraft(cellarId: string, id: string, fridges: FridgeView[]): Promise<Prefill | undefined> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("drafts")
    .select("id, payload")
    .eq("id", id)
    .eq("cellar_id", cellarId)
    .eq("status", "pending")
    .maybeSingle();
  if (!data) return undefined;
  const r = parseBottleDraft(data.payload, new Date().getFullYear());
  if (!r.ok) return undefined;
  const d = r.draft;
  return {
    draftId: data.id,
    winery: d.winery,
    name: d.name,
    type: d.type,
    year: d.year,
    quantity: d.quantity,
    price: d.price,
    drinkFrom: d.drinkFrom,
    drinkTo: d.drinkTo,
    extra: { grape: d.grape, country: d.country, region: d.region },
    // Where the AI saw the bottles: picked already, when those spots are free.
    places: resolvePlaces(fridges, d.places),
  };
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
