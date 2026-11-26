"use client";

import { useEffect, useState } from "react";
import { CellarView } from "@/app/cellar-view";
import { drinkNow } from "@/lib/bottle-list";
import { cellarTitle } from "@/lib/cellar-title";
import { fromSharedCellar, type SharedCellar, type SharedCellarJson } from "@/lib/shared-cellar";
import { createClient } from "@/lib/supabase/client";
import { bottles as countBottles } from "@/lib/plural";
import { GuestBottleSheet } from "./guest-bottle-sheet";

const TOKEN = /^[0-9a-f]{64}$/;

/**
 * The guest page. The token is after "#" (never sent to a server, never in
 * logs) and stays in the address bar, so the link can be bookmarked.
 * The guest is not signed in: the only call is shared_cellar(token).
 */
export function SharedView() {
  const [cellar, setCellar] = useState<SharedCellar | null | "loading">("loading");
  const [customName, setCustomName] = useState<string | null>(null);

  useEffect(() => {
    const token = window.location.hash.slice(1);
    const load = TOKEN.test(token)
      ? createClient().rpc("shared_cellar", { p_token: token }).then(({ data }) => data as SharedCellarJson | null)
      : Promise.resolve(null);
    load.then((json) => setCellar(json ? fromSharedCellar(json, new Date().getFullYear()) : null));
    if (TOKEN.test(token)) {
      createClient()
        .rpc("shared_cellar_name", { p_token: token })
        .then(({ data }) => setCustomName(data ?? null));
    }
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
          {cellarTitle(cellar.names, customName)}
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
            return b ? <GuestBottleSheet bottle={b} showPrice={!cellar.hidePrices} onClose={close} /> : null;
          }}
        />
      )}

    </>
  );
}
