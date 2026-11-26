"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { FridgePreview, type Place } from "@/components/fridge-preview";
import type { ListRow } from "@/lib/bottle-list";
import { DRINK_STATES } from "@/lib/drink-state";
import { fridgeCapacity } from "@/lib/fridge-layout";
import type { FridgeView, LooseBottle } from "@/lib/fridges";
import { useT } from "@/i18n/provider";
import { createClient } from "@/lib/supabase/client";
import { BottleSheet } from "./bottle-sheet";
import { useFridgeView } from "./use-fridge-view";

/**
 * The interactive part of the home page:
 * tap a bottle → its card; "move" → tap a new place (an occupied slot swaps).
 */
export function CellarView({
  fridges,
  loose,
  drinkNow,
  canEdit = true,
  sheet,
}: {
  fridges: FridgeView[];
  loose: LooseBottle[];
  drinkNow: ListRow[];
  /** false for a viewer: no "add here" on empty slots. */
  canEdit?: boolean;
  /**
   * What opens when a bottle is tapped. Default: the full bottle card (reads
   * the database as the signed-in user). The guest page passes its own,
   * built from the data it already has.
   */
  sheet?: (bottleId: string, close: () => void) => React.ReactNode;
}) {
  const router = useRouter();
  const t = useT();
  const [openId, setOpenId] = useState<string | null>(null);
  // "?move=<id>" (from the list page's "move" button) starts in move mode –
  // only for a bottle that is really in this cellar.
  const moveParam = useSearchParams().get("move");
  const known = (id: string | null) =>
    !!id &&
    (loose.some((b) => b.id === id) ||
      fridges.some((f) => f.shelves.some((s) => s.zones.some((z) => z.bottles.some((b) => b.id === id)))));
  const [movingId, setMovingId] = useState<string | null>(known(moveParam) ? moveParam : null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useFridgeView();
  // Several fridges: one at a time, with tabs (a long page of fridges is
  // hard to use on a phone). A moved bottle can still go to another fridge.
  const [fridgeId, setFridgeId] = useState<string | null>(null);
  const shown = fridges.length > 1 ? fridges.filter((f) => f.id === (fridgeId ?? fridges[0].id)) : fridges;

  function refresh() {
    setOpenId(null);
    setMovingId(null);
    router.refresh();
  }

  async function moveTo(place: Place | null) {
    if (!movingId) return;
    setError(null);
    const { error: rpcError } = await createClient().rpc("move_bottle", {
      p_bottle_id: movingId,
      p_zone_id: place?.zoneId as string, // null = out of the fridge
      p_slot: place?.slot ?? undefined,
    });
    if (rpcError) {
      setError(rpcError.code === "23514" ? t.cellar.noRoom : t.cellar.moveFailed);
      return;
    }
    refresh();
  }

  const unplaced = loose.filter((b) => b.status === "unplaced");
  const inTransit = loose.filter((b) => b.status === "in_transit");

  return (
    <>
      {movingId && (
        <div className="sticky top-2 z-30 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-accent px-4 py-3 text-white shadow-lg dark:text-black">
          <span className="font-medium">{t.cellar.moving}</span>
          <span className="flex gap-2 text-sm">
            <button type="button" onClick={() => moveTo(null)} className="underline underline-offset-2">
              {t.cellar.takeOut}
            </button>
            <button type="button" onClick={() => setMovingId(null)} className="underline underline-offset-2">
              {t.cellar.cancel}
            </button>
          </span>
        </div>
      )}
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">
          {error}
        </p>
      )}

      {drinkNow.length > 0 && !movingId && <DrinkNow rows={drinkNow} onOpen={setOpenId} />}

      <div className="flex items-center justify-end">
        {/* One on/off button: labels are on unless the user turns them off. */}
        <button
          type="button"
          onClick={() => setView(view === "labels" ? "dots" : "labels")}
          aria-pressed={view === "labels"}
          className={`rounded-full border px-3 py-1 text-sm ${
            view === "labels" ? "border-accent bg-accent text-white dark:text-black" : "border-muted/40 text-muted"
          }`}
        >
          {view === "labels" ? "✓ " : ""}
          {t.cellar.showLabels}
        </button>
      </div>

      {fridges.length > 1 && (
        <div role="tablist" aria-label={t.cellar.fridges} className="flex gap-1 overflow-x-auto">
          {fridges.map((f) => {
            const on = f.id === (fridgeId ?? fridges[0].id);
            return (
              <button
                key={f.id}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setFridgeId(f.id)}
                className={`shrink-0 rounded-full border px-3 py-1 text-sm ${on ? "border-accent bg-accent text-white dark:text-black" : "border-muted/40"}`}
              >
                <span dir="auto">{f.name}</span>
              </button>
            );
          })}
        </div>
      )}

      {shown.map((fridge) => (
        <article key={fridge.id} className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold">{fridge.name}</h2>
            <span className="text-sm text-muted">
              {/* Free room matters to the household, not to visitors. */}
              {[
                [fridge.brand, fridge.model].filter(Boolean).join(" "),
                canEdit ? t.cellar.roomFor(fridgeCapacity(fridge.shelves)) : "",
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </div>
          <FridgePreview
            shelves={fridge.shelves}
            view={view}
            hideEmpty={!canEdit}
            activeBottleId={movingId ?? undefined}
            // Moving: an empty place is the target. Otherwise: add a bottle right there.
            onPick={
              canEdit
                ? (p) =>
                    movingId
                      ? moveTo(p)
                      : router.push(`/bottles/new?zone=${p.zoneId}${p.slot === null ? "" : `&slot=${p.slot}`}`)
                : undefined
            }
            onBottleClick={(bottle, place) => {
              if (!movingId) setOpenId(bottle.id);
              else if (bottle.id !== movingId) moveTo(place); // swap
            }}
          />
        </article>
      ))}

      <LooseList title={t.cellar.outside} bottles={unplaced} onOpen={setOpenId} />
      <LooseList title={t.cellar.inTransit} bottles={inTransit} onOpen={setOpenId} />

      {openId && sheet && sheet(openId, () => setOpenId(null))}
      {openId && !sheet && (
        <BottleSheet
          bottleId={openId}
          onClose={() => setOpenId(null)}
          onMove={() => {
            setMovingId(openId);
            setOpenId(null);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          onChanged={refresh}
        />
      )}
    </>
  );
}

function LooseList({ title, bottles, onOpen }: { title: string; bottles: LooseBottle[]; onOpen: (id: string) => void }) {
  if (bottles.length === 0) return null;
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold">
        {title} <span className="text-sm font-normal text-muted">({bottles.length})</span>
      </h2>
      <ul className="flex flex-col divide-y divide-muted/20 rounded-xl bg-surface shadow-sm">
        {bottles.map((b) => (
          <li key={b.id}>
            <button type="button" onClick={() => onOpen(b.id)} className="flex w-full items-center gap-3 px-4 py-3 text-start">
              <span
                className="rounded-sm px-1 text-xs font-bold leading-5 text-black tabular-nums"
                style={{ backgroundColor: DRINK_STATES[b.state].color }}
              >
                {b.year ?? "NV"}
              </span>
              <span className="flex-1">{b.title}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** "What to drink now": the 3 most urgent wines, above the fridge (spec). */
function DrinkNow({ rows, onOpen }: { rows: ListRow[]; onOpen: (id: string) => void }) {
  const t = useT();
  return (
    <section className="flex flex-col gap-2" aria-labelledby="drink-now">
      <h2 id="drink-now" className="text-lg font-semibold">
        {t.cellar.drinkNow}
      </h2>
      <ul className="grid grid-cols-3 gap-2">
        {rows.map(({ key, first: b, bottles }) => (
          <li key={key}>
            <button
              type="button"
              onClick={() => onOpen(b.id)}
              className="flex h-full w-full flex-col items-start gap-1 rounded-xl bg-surface p-2 text-start shadow-sm"
            >
              <span
                className="rounded-sm px-1 text-xs font-bold leading-5 text-black tabular-nums"
                style={{ backgroundColor: DRINK_STATES[b.state].color }}
              >
                {b.year ?? "NV"}
              </span>
              <span dir="auto" className="line-clamp-2 text-sm leading-tight">
                {b.name}
              </span>
              <span className="text-xs text-muted">
                {t.drinkState[b.state]}
                {bottles.length > 1 && (
                  <>
                    {" · "}
                    <span dir="ltr">×{bottles.length}</span>
                  </>
                )}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
