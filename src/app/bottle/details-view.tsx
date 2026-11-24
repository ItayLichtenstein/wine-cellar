"use client";

import { useState } from "react";
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
}: {
  details: BottleDetails;
  onDrink: () => void;
  onMove: () => void;
  onEdit: () => void;
  onClose: () => void;
  onDeleted: () => void;
}) {
  // Same inputs as the fridge badge (including the peak), so both always agree.
  const state = drinkState(
    { drinkFrom: d.drinkFrom, drinkTo: d.drinkTo, peakFrom: d.peakFrom, peakTo: d.peakTo },
    new Date().getFullYear(),
  );
  const rating = d.vintageRating ?? d.wineRating;
  const canDrink = d.status !== "consumed";

  return (
    <>
      <header className="flex flex-col gap-1">
        <p className="text-sm text-muted">{d.winery}</p>
        <h2 className="text-2xl font-bold">
          {d.name} <span className="font-normal text-muted">{d.year ?? "NV"}</span>
        </h2>
      </header>

      <LabelPhoto wineId={d.wineId} cellarId={d.cellarId} path={d.labelPath} canEdit={d.status !== "consumed"} />

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        <dt className="text-muted">בשלות</dt>
        <dd className="flex items-center gap-2">
          <span className="size-3 rounded-sm" style={{ backgroundColor: DRINK_STATES[state].color }} aria-hidden="true" />
          {DRINK_STATES[state].label}
          {(d.drinkFrom || d.drinkTo) && (
            // dir="ltr": inside Hebrew text the browser would show "2019–2025"
            // as "2025–2019" (number ranges are a classic RTL trap).
            <span className="text-muted" dir="ltr">
              ({d.drinkFrom ?? "?"}–{d.drinkTo ?? "?"})
            </span>
          )}
        </dd>
        {(d.peakFrom || d.peakTo) && (
          <>
            <dt className="text-muted">שיא</dt>
            <dd dir="ltr" className="text-end">
              {d.peakFrom ?? "?"}–{d.peakTo ?? "?"}
            </dd>
          </>
        )}
        {[
          ["זן", d.extra.grape],
          ["מקור", [d.extra.region, d.extra.country].filter(Boolean).join(", ")],
          ["מבקרים", criticSummary(d.extra.critics) ?? ""],
          ["אלכוהול", d.extra.alcohol ? `${d.extra.alcohol}%` : ""],
          ["כשרות", d.extra.kosher === "yes" ? "כשר" : d.extra.kosher === "no" ? "לא כשר" : ""],
          ["צורה", d.extra.shape === "burgundy" ? "בורגון" : ""],
        ]
          .filter(([, v]) => v)
          .map(([k, v]) => (
            <Row key={k} label={k}>
              <span dir="auto">{v}</span>
            </Row>
          ))}
        {d.extra.link && linkLabel(d.extra.link) && (
          <Row label="קישור">
            {/* rel=noopener noreferrer: the opened site can't control this tab or see where it came from. */}
            <a href={d.extra.link} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
              {linkLabel(d.extra.link)}
            </a>
          </Row>
        )}
        {d.wineYears.length > 1 && (
          <Row label="במרתף">
            <span dir="ltr">{vintageBreakdown(d.wineYears)}</span>
          </Row>
        )}
        <dt className="text-muted">מחיר</dt>
        <dd>{formatPrice(d)}</dd>
        <dt className="text-muted">ציון</dt>
        <dd>{ratingLine(d.personalRatings, rating, d.vintageId) ?? "עוד אין"}</dd>
        {d.note && (
          <>
            <dt className="text-muted">הערה</dt>
            <dd>{d.note}</dd>
          </>
        )}
      </dl>

      {canDrink && (
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={onDrink} className="rounded-full bg-accent px-4 py-3 font-medium text-white dark:text-black">
            🍷 שתינו
          </button>
          <button type="button" onClick={onMove} className="rounded-full border border-muted/40 px-4 py-3">
            {d.status === "stored" ? "הזזה" : "שיבוץ במקרר"}
          </button>
        </div>
      )}
      <div className="flex justify-center gap-6 text-sm">
        <button type="button" onClick={onEdit} className="underline underline-offset-2">
          עריכה
        </button>
        <DeleteButton bottleId={d.id} onDeleted={onDeleted} />
        <button type="button" onClick={onClose} className="text-muted underline underline-offset-2">
          סגירה
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
        מחיקה
      </button>
    );
  }
  return (
    <span className="flex items-center gap-2">
      <button type="button" onClick={remove} disabled={busy} className="font-medium text-red-700 underline underline-offset-2 dark:text-red-400">
        {failed ? "לא הצליח – לנסות שוב?" : "למחוק לגמרי?"}
      </button>
      <button type="button" onClick={() => setConfirming(false)} className="text-muted underline underline-offset-2">
        לא
      </button>
    </span>
  );
}
