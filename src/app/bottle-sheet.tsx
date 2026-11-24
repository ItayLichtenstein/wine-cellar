"use client";

import { useEffect, useState } from "react";
import { DRINK_STATES, drinkState } from "@/lib/drink-state";
import { createClient } from "@/lib/supabase/client";

type Details = {
  id: string;
  status: string;
  wineId: string;
  vintageId: string;
  winery: string;
  name: string;
  year: number | null;
  drinkFrom: number | null;
  drinkTo: number | null;
  paid: number | null;
  regular: number | null;
  isGift: boolean;
  vintageRating: number | null;
  wineRating: number | null;
};

type Props = {
  bottleId: string;
  onClose: () => void;
  onMove: () => void;
  /** Called after a change, so the page reloads its data. */
  onChanged: () => void;
};

const TODAY = () => new Date().toISOString().slice(0, 10);

/**
 * The card that opens when you tap a bottle: details + actions.
 * "We drank it" asks for date, notes and (optionally) an updated rating.
 */
export function BottleSheet({ bottleId, onClose, onMove, onChanged }: Props) {
  const [details, setDetails] = useState<Details | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [step, setStep] = useState<"details" | "drink">("details");

  useEffect(() => {
    let cancelled = false;
    loadDetails(bottleId).then(
      (d) => !cancelled && setDetails(d),
      () => !cancelled && setLoadError(true),
    );
    return () => {
      cancelled = true;
    };
  }, [bottleId]);

  // Close with Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/50" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="פרטי בקבוק"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85vh] w-full max-w-xl flex-col gap-4 overflow-y-auto rounded-t-3xl bg-background p-5 pb-8 shadow-2xl"
      >
        <div className="mx-auto h-1.5 w-10 rounded-full bg-muted/40" aria-hidden="true" />
        {loadError && <p role="alert">לא הצלחנו לטעון את הבקבוק.</p>}
        {!details && !loadError && <p className="text-muted">טוען…</p>}
        {details && step === "details" && (
          <DetailsView details={details} onDrink={() => setStep("drink")} onMove={onMove} onClose={onClose} />
        )}
        {details && step === "drink" && (
          <DrinkForm details={details} onCancel={() => setStep("details")} onDone={onChanged} />
        )}
      </div>
    </div>
  );
}

function DetailsView({
  details: d,
  onDrink,
  onMove,
  onClose,
}: {
  details: Details;
  onDrink: () => void;
  onMove: () => void;
  onClose: () => void;
}) {
  const state = drinkState({ drinkFrom: d.drinkFrom, drinkTo: d.drinkTo }, new Date().getFullYear());
  const rating = d.vintageRating ?? d.wineRating;

  return (
    <>
      <header className="flex flex-col gap-1">
        <p className="text-sm text-muted">{d.winery}</p>
        <h2 className="text-2xl font-bold">
          {d.name} <span className="font-normal text-muted">{d.year ?? "NV"}</span>
        </h2>
      </header>

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
        <dt className="text-muted">מחיר</dt>
        <dd>{formatPrice(d)}</dd>
        <dt className="text-muted">ציון</dt>
        <dd>{rating ? `${rating} / 5` : "עוד אין"}</dd>
      </dl>

      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={onDrink} className="rounded-full bg-accent px-4 py-3 font-medium text-white dark:text-black">
          🍷 שתינו
        </button>
        <button type="button" onClick={onMove} className="rounded-full border border-muted/40 px-4 py-3">
          {d.status === "stored" ? "הזזה" : "שיבוץ במקרר"}
        </button>
      </div>
      <button type="button" onClick={onClose} className="text-sm text-muted underline underline-offset-2">
        סגירה
      </button>
    </>
  );
}

function DrinkForm({ details: d, onCancel, onDone }: { details: Details; onCancel: () => void; onDone: () => void }) {
  const current = d.vintageRating ?? d.wineRating;
  const [date, setDate] = useState(TODAY);
  const [notes, setNotes] = useState("");
  const [score, setScore] = useState(current ? String(current) : "");
  const [forVintage, setForVintage] = useState(d.year !== null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    const scoreNum = score ? Number(score) : null;
    if (scoreNum !== null && (Number.isNaN(scoreNum) || scoreNum < 1 || scoreNum > 5)) {
      setError("ציון בין 1 ל־5.");
      return;
    }
    setSaving(true);
    setError(null);
    const supabase = createClient();

    const { error: drinkError } = await supabase.rpc("drink_bottle", {
      p_bottle_id: d.id,
      p_tasted_on: date,
      p_notes: notes.trim() || undefined,
    });
    if (drinkError) {
      setSaving(false);
      setError("לא הצלחנו לשמור. נסו שוב.");
      return;
    }

    if (scoreNum !== null && scoreNum !== current) {
      // The bottle is already marked as drunk; a failed rating is reported
      // but doesn't undo that.
      const { error: rateError } = await supabase.rpc("set_rating", {
        p_wine_id: d.wineId,
        p_score: scoreNum,
        p_vintage_id: forVintage ? d.vintageId : undefined,
      });
      if (rateError) {
        setSaving(false);
        setError("הבקבוק סומן כשתוי, אבל הציון לא נשמר.");
        onDone();
        return;
      }
    }
    onDone();
  }

  return (
    <>
      <h2 className="text-xl font-bold">
        שתינו את {d.name} {d.year ?? "NV"}
      </h2>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted">מתי?</span>
        <input type="date" value={date} max={TODAY()} onChange={(e) => setDate(e.target.value)} className={inputClass} />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted">הערות טעימה (לא חובה)</span>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} maxLength={4000} className={inputClass} />
      </label>

      <fieldset className="flex flex-col gap-2 text-sm">
        <legend className="mb-1 text-muted">
          ציון {current ? `(עכשיו: ${current})` : ""} – 1 עד 5, לא חובה
        </legend>
        <input
          value={score}
          onChange={(e) => setScore(e.target.value)}
          inputMode="decimal"
          placeholder="4.5"
          className={`${inputClass} w-24`}
          aria-label="ציון"
        />
        {d.year !== null && (
          <div className="flex gap-4">
            <label className="flex items-center gap-2">
              <input type="radio" checked={forVintage} onChange={() => setForVintage(true)} />
              לבציר {d.year}
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" checked={!forVintage} onChange={() => setForVintage(false)} />
              ליין בכלל
            </label>
          </div>
        )}
      </fieldset>

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">
          {error}
        </p>
      )}

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={confirm}
          disabled={saving}
          className="rounded-full bg-accent px-4 py-3 font-medium text-white disabled:opacity-60 dark:text-black"
        >
          {saving ? "שומר…" : "לחיים!"}
        </button>
        <button type="button" onClick={onCancel} className="rounded-full border border-muted/40 px-4 py-3">
          ביטול
        </button>
      </div>
    </>
  );
}

const inputClass = "rounded-lg border border-muted/40 bg-surface px-3 py-2 text-base";

function formatPrice(d: Details): string {
  const nis = (n: number) => `₪${n.toLocaleString("he-IL", { maximumFractionDigits: 1 })}`;
  if (d.isGift) return d.regular ? `${nis(d.regular)} · מתנה` : "מתנה";
  if (d.regular && d.paid !== null && d.paid !== d.regular) return `${nis(d.regular)} (${nis(d.paid)})`;
  if (d.paid !== null) return nis(d.paid);
  if (d.regular) return nis(d.regular);
  return "—";
}

async function loadDetails(bottleId: string): Promise<Details> {
  const supabase = createClient();
  const { data: b, error } = await supabase
    .from("bottles")
    .select("id, status, vintage_id, bottle_prices(paid, regular, is_gift), wine_vintages(id, year, drink_from, drink_to, wine_id, wines(winery, name))")
    .eq("id", bottleId)
    .single();
  if (error || !b.wine_vintages) throw new Error("not found");

  const v = b.wine_vintages;
  const { data: ratings } = await supabase
    .from("ratings")
    .select("score, vintage_id")
    .eq("wine_id", v.wine_id)
    .is("rater_id", null);

  // One price per bottle, but the composite foreign key makes the generated
  // type a list – accept both shapes.
  const prices = b.bottle_prices as unknown;
  const price = (Array.isArray(prices) ? prices[0] : prices) as
    | { paid: number | null; regular: number | null; is_gift: boolean }
    | null
    | undefined;
  return {
    id: b.id,
    status: b.status,
    wineId: v.wine_id,
    vintageId: v.id,
    winery: v.wines?.winery ?? "",
    name: v.wines?.name ?? "",
    year: v.year,
    drinkFrom: v.drink_from,
    drinkTo: v.drink_to,
    paid: price?.paid ?? null,
    regular: price?.regular ?? null,
    isGift: price?.is_gift ?? false,
    vintageRating: ratings?.find((r) => r.vintage_id === v.id)?.score ?? null,
    wineRating: ratings?.find((r) => r.vintage_id === null)?.score ?? null,
  };
}
