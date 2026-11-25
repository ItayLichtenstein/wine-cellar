"use client";

import { useEffect, useState } from "react";
import { CellarView } from "@/app/cellar-view";
import { drinkNow } from "@/lib/bottle-list";
import { cellarTitle } from "@/lib/cellar-title";
import { DRINK_STATES } from "@/lib/drink-state";
import { fromSharedCellar, type SharedCellar, type SharedCellarJson } from "@/lib/shared-cellar";
import { createClient } from "@/lib/supabase/client";
import { bottles as countBottles } from "@/lib/plural";

const TOKEN = /^[0-9a-f]{64}$/;
const dateFormat = new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "long", year: "numeric" });

/**
 * The guest page. The token is after "#" (never sent to a server, never in
 * logs) and stays in the address bar, so the link can be bookmarked.
 * The guest is not signed in: the only call is shared_cellar(token).
 */
export function SharedView() {
  const [cellar, setCellar] = useState<SharedCellar | null | "loading">("loading");

  useEffect(() => {
    const token = window.location.hash.slice(1);
    const load = TOKEN.test(token)
      ? createClient().rpc("shared_cellar", { p_token: token }).then(({ data }) => data as SharedCellarJson | null)
      : Promise.resolve(null);
    load.then((json) => setCellar(json ? fromSharedCellar(json, new Date().getFullYear()) : null));
  }, []);

  if (cellar === "loading") return <p className="text-muted">טוען…</p>;
  if (!cellar) {
    return (
      <p className="text-muted">
        <span className="inline-block">הקישור לא תקף.</span>{" "}
        <span className="inline-block">ייתכן שבעלי המרתף ביטלו אותו או יצרו קישור חדש.</span>
      </p>
    );
  }

  const byId = new Map(cellar.bottles.map((b) => [b.id, b]));
  const stored = cellar.bottles.filter((b) => b.status === "stored").length;

  return (
    <>
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold" dir="auto">
          {cellarTitle(cellar.names)}
        </h1>
        <p className="text-sm text-muted">{countBottles(stored)} במקרר · צפייה בלבד</p>
      </header>

      {cellar.fridges.length === 0 ? (
        <p className="text-muted">עוד אין כאן מקרר.</p>
      ) : (
        <CellarView
          fridges={cellar.fridges}
          loose={cellar.loose}
          drinkNow={drinkNow(cellar.bottles)}
          canEdit={false}
          sheet={(id, close) => {
            const b = byId.get(id);
            return b ? (
              <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={close}>
                <div
                  role="dialog"
                  aria-modal="true"
                  aria-label="פרטי בקבוק"
                  onClick={(e) => e.stopPropagation()}
                  className="flex w-full max-w-xl flex-col gap-3 rounded-t-3xl bg-background p-5 pb-8 shadow-2xl"
                >
                  <p className="text-sm text-muted">{b.winery}</p>
                  <h2 className="text-2xl font-bold">
                    {b.name} <span className="font-normal text-muted">{b.year ?? "NV"}</span>
                  </h2>
                  <p className="flex items-center gap-2">
                    <span className="size-3 rounded-sm" style={{ backgroundColor: DRINK_STATES[b.state].color }} aria-hidden="true" />
                    {DRINK_STATES[b.state].label}
                  </p>
                  <p className="text-sm text-muted">
                    {[b.where, b.country, !cellar.hidePrices && b.price !== null ? `₪${b.price}` : ""].filter(Boolean).join(" · ")}
                  </p>
                  <button type="button" onClick={close} className="self-center text-sm text-muted underline underline-offset-2">
                    סגירה
                  </button>
                </div>
              </div>
            ) : null;
          }}
        />
      )}

      {!cellar.hideHistory && cellar.history.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">מה ששתו</h2>
          <ul className="flex flex-col divide-y divide-muted/20 rounded-xl bg-surface shadow-sm">
            {cellar.history.slice(0, 20).map((t) => (
              <li key={t.id} className="flex flex-col px-4 py-3">
                <span dir="auto">
                  {t.title} <span className="text-muted">{t.year ?? "NV"}</span>
                </span>
                <span className="text-xs text-muted">{dateFormat.format(new Date(t.tastedOn))}</span>
                {t.notes && (
                  <span className="text-sm" dir="auto">
                    {t.notes}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
