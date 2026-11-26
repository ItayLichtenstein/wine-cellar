"use client";

import { useEffect } from "react";
import { WINE_TYPES } from "@/app/bottle/details";
import { DRINK_STATES } from "@/lib/drink-state";
import type { SharedBottle } from "@/lib/shared-cellar";
import { criticSummary } from "@/lib/wine-extra";

/**
 * A bottle card for a guest with a view link: what a wine list would say
 * about it (winery, type, grape, origin, drink window, critics), never the
 * household's notes or ratings – those are not even in the data it gets.
 */
export function GuestBottleSheet({ bottle: b, showPrice, onClose }: { bottle: SharedBottle; showPrice: boolean; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const range = (from: number | null, to: number | null) => (from || to ? `${from ?? "?"}–${to ?? "?"}` : "");
  const rows: [string, string, ("ltr" | "auto")?][] = [
    ["סוג", WINE_TYPES.find((t) => t.value === b.type)?.label ?? ""],
    ["זן", b.grape, "auto"],
    ["מקור", [b.region, b.country].filter(Boolean).join(", "), "auto"],
    ["שיא", range(b.peakFrom, b.peakTo), "ltr"],
    ["מבקרים", criticSummary(b.critics) ?? "", "auto"],
    ["אלכוהול", b.alcohol ? `${b.alcohol}%` : ""],
    ["כשרות", b.kosher === "yes" ? "כשר" : b.kosher === "no" ? "לא כשר" : ""],
    ["איפה", b.where],
    ["מחיר", showPrice && b.price !== null ? `₪${b.price}` : ""],
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="פרטי בקבוק"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90dvh] w-full max-w-xl flex-col gap-4 overflow-y-auto rounded-t-3xl bg-background p-5 pb-8 shadow-2xl"
      >
        <header className="flex items-start gap-3">
          {b.thumb && (
            // eslint-disable-next-line @next/next/no-img-element -- a 4KB data: URL; next/image adds nothing here
            <img src={b.thumb} alt="" className="h-24 w-18 shrink-0 rounded-lg object-cover shadow-sm" />
          )}
          <div className="flex flex-col gap-1">
            <p className="text-sm text-muted" dir="auto">
              {b.winery}
            </p>
            <h2 className="text-2xl font-bold">
              <span dir="auto">{b.name}</span> <span className="font-normal text-muted">{b.year ?? "NV"}</span>
            </h2>
          </div>
        </header>

        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="text-muted">בשלות</dt>
          <dd className="flex items-center gap-2">
            <span className="size-3 rounded-sm" style={{ backgroundColor: DRINK_STATES[b.state].color }} aria-hidden="true" />
            {DRINK_STATES[b.state].label}
            {range(b.drinkFrom, b.drinkTo) && (
              <span className="text-muted" dir="ltr">
                ({range(b.drinkFrom, b.drinkTo)})
              </span>
            )}
          </dd>
          {rows
            .filter(([, v]) => v)
            .map(([k, v, dir]) => (
              <div key={k} className="contents">
                <dt className="text-muted">{k}</dt>
                <dd>
                  <span dir={dir}>{v}</span>
                </dd>
              </div>
            ))}
        </dl>

        <button type="button" onClick={onClose} className="self-center text-sm text-muted underline underline-offset-2">
          סגירה
        </button>
      </div>
    </div>
  );
}
