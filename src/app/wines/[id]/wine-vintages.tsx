"use client";

import { useT } from "@/i18n/provider";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BottleSheet } from "@/app/bottle-sheet";
import { DRINK_STATES } from "@/lib/drink-state";
import type { WinePage } from "@/lib/fridges";

/** One row per vintage; tapping it opens a bottle card of that vintage. */
export function WineVintages({ vintages }: { vintages: WinePage["vintages"] }) {
  const router = useRouter();
  const t = useT();
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <>
      <ul className="flex flex-col divide-y divide-muted/20 rounded-xl bg-surface shadow-sm">
        {vintages.map((v) => (
          <li key={v.id}>
            <button
              type="button"
              disabled={!v.firstBottleId}
              onClick={() => v.firstBottleId && setOpenId(v.firstBottleId)}
              className="flex w-full items-center gap-3 px-4 py-3 text-start disabled:cursor-default"
            >
              <span
                className="w-11 shrink-0 rounded-sm text-center text-xs font-bold leading-5 text-black tabular-nums"
                style={{ backgroundColor: DRINK_STATES[v.state].color }}
              >
                {v.year ?? "NV"}
              </span>
              <span className="flex min-w-0 flex-1 flex-col text-sm">
                <span>
                  {t.drinkState[v.state]}
                  {(v.drinkFrom || v.drinkTo) && (
                    <span className="text-muted" dir="ltr">
                      {" "}
                      ({v.drinkFrom ?? "?"}–{v.drinkTo ?? "?"})
                    </span>
                  )}
                </span>
                <span className="text-xs text-muted">
                  {v.inCellar > 0 ? t.wine.inCellarCount(v.inCellar) : t.wine.noneInCellar}
                  {v.drunk > 0 ? ` · ${t.wine.drunk(v.drunk)}` : ""}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      {openId && (
        <BottleSheet
          bottleId={openId}
          onClose={() => setOpenId(null)}
          onMove={() => router.push(`/?move=${openId}`)}
          onChanged={() => {
            setOpenId(null);
            router.refresh();
          }}
        />
      )}
    </>
  );
}
