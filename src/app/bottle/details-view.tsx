"use client";

import Link from "next/link";
import { useState } from "react";
import { useT } from "@/i18n/provider";
import { createClient } from "@/lib/supabase/client";
import { criticSummary, linkLabel, ratingLine, vintageBreakdown } from "@/lib/wine-extra";
import { LabelPhoto } from "./label-photo";
import { DRINK_STATES, drinkState } from "@/lib/drink-state";
import { formatPrice, type BottleDetails } from "./details";

export function DetailsView({
  details: d,
  onDrink,
  onMove,
  onEdit,
  onClose,
  onDeleted,
  onWinePage,
}: {
  details: BottleDetails;
  onDrink: () => void;
  onMove?: () => void;
  onEdit: () => void;
  onClose: () => void;
  onDeleted: () => void;
  onWinePage?: boolean;
}) {
  const t = useT();
  // Same inputs as the fridge badge (including the peak), so both always agree.
  const state = drinkState(
    { drinkFrom: d.drinkFrom, drinkTo: d.drinkTo, peakFrom: d.peakFrom, peakTo: d.peakTo },
    new Date().getFullYear(),
  );
  const rating = d.vintageRating ?? d.wineRating;
  const canDrink = d.canEdit && d.status !== "consumed";

  return (
    <>
      <header className="flex flex-col gap-1">
        <p className="text-sm text-muted">{d.winery}</p>
        <h2 className="text-2xl font-bold">
          {d.name} <span className="font-normal text-muted">{d.year ?? "NV"}</span>
        </h2>
      </header>

      <LabelPhoto wineId={d.wineId} cellarId={d.cellarId} path={d.labelPath} canEdit={d.canEdit && d.status !== "consumed"} />

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        <dt className="text-muted">{t.bottle.ripeness}</dt>
        <dd className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="size-3 shrink-0 rounded-sm" style={{ backgroundColor: DRINK_STATES[state].color }} aria-hidden="true" />
          <span>{t.drinkState[state]}</span>
          {(d.drinkFrom || d.drinkTo) && (
            // dir="ltr": inside Hebrew text the browser would show "2019–2025"
            // as "2025–2019" (number ranges are a classic RTL trap).
            // nowrap: the years stay together, on the next line when the state is long.
            <span className="whitespace-nowrap text-muted" dir="ltr">
              ({d.drinkFrom ?? "?"}–{d.drinkTo ?? "?"})
            </span>
          )}
        </dd>
        {(d.peakFrom || d.peakTo) && (
          <>
            <dt className="text-muted">{t.bottle.peak}</dt>
            {/* The range reads left to right in both languages; the cell itself follows the page. */}
            <dd>
              <span dir="ltr" className="whitespace-nowrap">
                {d.peakFrom ?? "?"}–{d.peakTo ?? "?"}
              </span>
            </dd>
          </>
        )}
        {[
          [t.bottle.grape, d.extra.grape],
          [t.bottle.body, d.extra.body ? t.body[d.extra.body] : ""],
          [t.bottle.origin, [d.extra.region, d.extra.country].filter(Boolean).join(", ")],
          [t.bottle.critics, criticSummary(d.extra.critics, t) ?? ""],
          [t.bottle.alcohol, d.extra.alcohol ? `${d.extra.alcohol}%` : ""],
          [t.bottle.kosher, d.extra.kosher === "yes" ? t.bottle.kosherYes : d.extra.kosher === "no" ? t.bottle.kosherNo : ""],
          [t.bottle.shape, d.extra.shape === "burgundy" ? t.bottle.burgundy : ""],
        ]
          .filter(([, v]) => v)
          .map(([k, v]) => (
            <Row key={k} label={k}>
              <span dir="auto">{v}</span>
            </Row>
          ))}
        {d.extra.link && linkLabel(d.extra.link, t) && (
          <Row label={t.bottle.link}>
            {/* rel=noopener noreferrer: the opened site can't control this tab or see where it came from. */}
            <a href={d.extra.link} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
              {linkLabel(d.extra.link, t)}
            </a>
          </Row>
        )}
        {d.wineYears.length > 1 && (
          <Row label={t.bottle.inCellar}>
            <span dir="ltr">{vintageBreakdown(d.wineYears)}</span>
          </Row>
        )}
        <dt className="text-muted">{t.bottle.price}</dt>
        <dd>{formatPrice(d, t)}</dd>
        <dt className="text-muted">{t.bottle.score}</dt>
        <dd>{ratingLine(d.personalRatings, rating, d.vintageId, t) ?? t.bottle.noScoreYet}</dd>
        {d.note && (
          <>
            <dt className="text-muted">{t.bottle.note}</dt>
            <dd dir="auto">{d.note}</dd>
          </>
        )}
      </dl>

      {canDrink && (
        <div className={`grid gap-2 ${onMove ? "grid-cols-2" : "grid-cols-1"}`}>
          <button type="button" onClick={onDrink} className="rounded-full bg-accent px-4 py-3 font-medium text-white dark:text-black">
            {t.bottle.drank}
          </button>
          {onMove && (
            <button type="button" onClick={onMove} className="rounded-full border border-muted/40 px-4 py-3">
              {d.status === "stored" ? t.bottle.move : t.bottle.place}
            </button>
          )}
        </div>
      )}
      <div className="flex flex-wrap justify-center gap-x-6 gap-y-3 text-sm">
        {d.isFriend ? (
          <AddToMyWishlist wineId={d.wineId} year={d.year} />
        ) : onWinePage ? null : (
          <Link href={`/wines/${d.wineId}`} className="underline underline-offset-2">
            {t.bottle.winePage}
          </Link>
        )}
        {d.canEdit && (
          <>
            <button type="button" onClick={onEdit} className="underline underline-offset-2">
              {t.bottle.edit}
            </button>
            <DeleteButton bottleId={d.id} onDeleted={onDeleted} />
          </>
        )}
        <button type="button" onClick={onClose} className="text-muted underline underline-offset-2">
          {t.common.close}
        </button>
      </div>
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-muted">{label}</dt>
      <dd>{children}</dd>
    </>
  );
}

/**
 * Deleting is for a bottle entered by mistake (a drunk bottle is "שתינו").
 * Two steps, so one stray tap never deletes anything.
 */
function DeleteButton({ bottleId, onDeleted }: { bottleId: string; onDeleted: () => void }) {
  const t = useT();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function remove() {
    setBusy(true);
    const { error } = await createClient().from("bottles").delete().eq("id", bottleId);
    if (error) {
      setBusy(false);
      setFailed(true);
      return;
    }
    onDeleted();
  }

  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)} className="text-muted underline underline-offset-2">
        {t.bottle.delete}
      </button>
    );
  }
  return (
    // basis-full: the question and its two buttons get a line of their own.
    <span className="flex basis-full flex-wrap items-center justify-center gap-2">
      <span>{failed ? t.bottle.deleteFailed : t.bottle.deleteAsk}</span>
      <button
        type="button"
        onClick={remove}
        disabled={busy}
        className="rounded-full bg-red-700 px-3 py-1 font-medium text-white disabled:opacity-60 dark:bg-red-500 dark:text-black"
      >
        {failed ? t.bottle.tryAgain : t.bottle.deleteYes}
      </button>
      <button type="button" onClick={() => setConfirming(false)} className="rounded-full border border-muted/40 px-3 py-1">
        {t.cellar.cancel}
      </button>
    </span>
  );
}

/** In a friend's cellar: "I want this too" copies the wine into my wishlist. */
function AddToMyWishlist({ wineId, year }: { wineId: string; year: number | null }) {
  const t = useT();
  const [state, setState] = useState<"idle" | "busy" | "done" | "failed">("idle");

  async function add() {
    setState("busy");
    const { error } = await createClient().rpc("add_friend_wine_to_wishlist", {
      p_wine_id: wineId,
      p_year: year ?? undefined,
    });
    setState(error ? "failed" : "done");
  }

  if (state === "done") {
    return (
      <Link href="/wishlist" className="font-medium underline underline-offset-2">
        {t.bottle.wishAdded}
      </Link>
    );
  }
  return (
    <button type="button" onClick={add} disabled={state === "busy"} className="font-medium underline underline-offset-2">
      {state === "failed" ? t.bottle.wishFailed : t.bottle.wishAdd}
    </button>
  );
}
