"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { inputClass, type BottleDetails } from "./details";
import { ErrorNote } from "./error-note";

const today = () => new Date().toISOString().slice(0, 10);

/** "We drank it": date, tasting notes, and an optional updated rating. */
export function DrinkForm({ details: d, onCancel, onDone }: { details: BottleDetails; onCancel: () => void; onDone: () => void }) {
  const current = d.vintageRating ?? d.wineRating;
  const [date, setDate] = useState(today);
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
