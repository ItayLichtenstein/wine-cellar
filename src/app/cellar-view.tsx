"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FridgePreview, type Place } from "@/components/fridge-preview";
import { DRINK_STATES } from "@/lib/drink-state";
import { fridgeCapacity } from "@/lib/fridge-layout";
import type { FridgeView, LooseBottle } from "@/lib/fridges";
import { createClient } from "@/lib/supabase/client";
import { BottleSheet } from "./bottle-sheet";

/**
 * The interactive part of the home page:
 * tap a bottle → its card; "move" → tap a new place (an occupied slot swaps).
 */
export function CellarView({ fridges, loose }: { fridges: FridgeView[]; loose: LooseBottle[] }) {
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      setError(rpcError.code === "23514" ? "אין מקום שם. בחרו מקום אחר." : "ההזזה לא הצליחה. נסו שוב.");
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
          <span className="font-medium">בחרו מקום חדש. בקבוק במקום תפוס יתחלף.</span>
          <span className="flex gap-2 text-sm">
            <button type="button" onClick={() => moveTo(null)} className="underline underline-offset-2">
              הוצאה מהמקרר
            </button>
            <button type="button" onClick={() => setMovingId(null)} className="underline underline-offset-2">
              ביטול
            </button>
          </span>
        </div>
      )}
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">
          {error}
        </p>
      )}

      {fridges.map((fridge) => (
        <article key={fridge.id} className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold">{fridge.name}</h2>
            <span className="text-sm text-muted">
              {[fridge.brand, fridge.model].filter(Boolean).join(" ")}
              {fridge.brand || fridge.model ? " · " : ""}
              מקום ל־{fridgeCapacity(fridge.shelves)}
            </span>
          </div>
          <FridgePreview
            shelves={fridge.shelves}
            activeBottleId={movingId ?? undefined}
            onPick={movingId ? (p) => moveTo(p) : undefined}
            onBottleClick={(bottle, place) => {
              if (!movingId) setOpenId(bottle.id);
              else if (bottle.id !== movingId) moveTo(place); // swap
            }}
          />
        </article>
      ))}

      <LooseList title="מחוץ למקרר" bottles={unplaced} onOpen={setOpenId} />
      <LooseList title="בדרך אלינו" bottles={inTransit} onOpen={setOpenId} />

      {openId && (
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
