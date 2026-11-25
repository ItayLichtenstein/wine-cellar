"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { inputClass, type BottleDetails } from "./details";
import { ErrorNote } from "./error-note";

// Local date, not UTC: after midnight in Israel, toISOString() still says "yesterday".
const today = () => new Date().toLocaleDateString("en-CA");

/** "We drank it": date, tasting notes, and an optional updated rating. */
export function DrinkForm({ details: d, onCancel, onDone }: { details: BottleDetails; onCancel: () => void; onDone: () => void }) {
  const current = d.vintageRating ?? d.wineRating;
  const [date, setDate] = useState(today);
  const [notes, setNotes] = useState("");
  const [score, setScore] = useState(current ? String(current) : "");
  const [forVintage, setForVintage] = useState(d.year !== null);
  // Separate ratings: one score per full household member (spec). Opening
  // it pre-fills each person with their own score, or the shared one.
  const canSplit = d.members.length > 1;
  const [separate, setSeparate] = useState(canSplit && d.personalRatings.length > 0);
  const ownScore = (id: string) =>
    d.personalRatings.find((r) => r.raterId === id && r.vintageId === d.vintageId)?.score ??
    d.personalRatings.find((r) => r.raterId === id && r.vintageId === null)?.score ??
    current;
  const [scores, setScores] = useState<Record<string, string>>(() =>
    Object.fromEntries(d.members.map((m) => [m.id, ownScore(m.id) ? String(ownScore(m.id)) : ""])),
  );
  const [buyAgain, setBuyAgain] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    const scoreNum = score ? Number(score) : null;
    const valid = (n: number | null) => n === null || (!Number.isNaN(n) && n >= 1 && n <= 5);
    const personal = d.members.map((m) => ({ id: m.id, n: scores[m.id] ? Number(scores[m.id]) : null }));
    if (separate ? !personal.every((p) => valid(p.n)) : !valid(scoreNum)) {
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

    // "לקנות שוב" puts the wine on the wishlist (this vintage).
    if (buyAgain) {
      await supabase.rpc("add_to_wishlist", { p_winery: d.winery, p_name: d.name, p_type: d.type, p_year: d.year ?? undefined });
    }

    // The bottle is already marked as drunk; a failed rating is reported
    // but doesn't undo that.
    const toSave = separate
      ? personal.filter((p) => p.n !== null && p.n !== ownScore(p.id)).map((p) => ({ score: p.n!, rater: p.id }))
      : scoreNum !== null && scoreNum !== current
        ? [{ score: scoreNum, rater: undefined }]
        : [];
    const results = await Promise.all(
      toSave.map((r) =>
        supabase.rpc("set_rating", {
          p_wine_id: d.wineId,
          p_score: r.score,
          p_vintage_id: forVintage ? d.vintageId : undefined,
          p_rater_id: r.rater,
        }),
      ),
    );
    {
      const rateError = results.find((r) => r.error)?.error;
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
        <input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} className={inputClass} />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted">הערות טעימה (לא חובה)</span>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} maxLength={4000} className={inputClass} />
      </label>

      <fieldset className="flex flex-col gap-2 text-sm">
        <legend className="mb-1 text-muted">
          ציון {current ? `(עכשיו: ${current})` : ""} – 1 עד 5, לא חובה
        </legend>
        {separate ? (
          d.members.map((m) => (
            <label key={m.id} className="flex items-center gap-2">
              <input
                value={scores[m.id] ?? ""}
                onChange={(e) => setScores((s) => ({ ...s, [m.id]: e.target.value }))}
                inputMode="decimal"
                placeholder="4.5"
                className={`${inputClass} w-24`}
              />
              <span dir="auto">{m.name}</span>
            </label>
          ))
        ) : (
          <input
            value={score}
            onChange={(e) => setScore(e.target.value)}
            inputMode="decimal"
            placeholder="4.5"
            className={`${inputClass} w-24`}
            aria-label="ציון"
          />
        )}
        {canSplit && (
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={separate} onChange={(e) => setSeparate(e.target.checked)} />
            ציונים נפרדים לכל אחד
          </label>
        )}
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

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={buyAgain} onChange={(e) => setBuyAgain(e.target.checked)} />
        לקנות שוב (מוסיף לרשימת המשאלות)
      </label>

      <ErrorNote message={error} />

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
