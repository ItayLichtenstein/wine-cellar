"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { validateExtra } from "@/lib/wine-extra";
import { WINE_TYPES, inputClass, saveExtra, type BottleDetails, type WineType } from "./details";
import { ExtraFields } from "./extra-fields";
import { ErrorNote } from "./error-note";

const numOrNull = (s: string) => (s.trim() === "" ? null : Number(s));

/**
 * Fix a bottle's details. Wine fields (winery, name, type) change for every
 * bottle of that wine; a new year moves this bottle to that vintage.
 */
export function EditForm({ details: d, onCancel, onDone }: { details: BottleDetails; onCancel: () => void; onDone: () => void }) {
  const [winery, setWinery] = useState(d.winery);
  const [name, setName] = useState(d.name);
  const [type, setType] = useState<WineType>(d.type);
  const [year, setYear] = useState(d.year ? String(d.year) : "");
  const [drinkFrom, setDrinkFrom] = useState(d.drinkFrom ? String(d.drinkFrom) : "");
  const [drinkTo, setDrinkTo] = useState(d.drinkTo ? String(d.drinkTo) : "");
  const [paid, setPaid] = useState(d.paid !== null ? String(d.paid) : "");
  const [regular, setRegular] = useState(d.regular !== null ? String(d.regular) : "");
  const [isGift, setIsGift] = useState(d.isGift);
  const [note, setNote] = useState(d.note);
  const [extra, setExtra] = useState(d.extra);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!winery.trim() || !name.trim()) {
      setError("צריך למלא יקב ושם יין");
      return;
    }
    const numbers = [year, drinkFrom, drinkTo, paid, regular].map(numOrNull);
    if (numbers.some((n) => n !== null && Number.isNaN(n))) {
      setError("אחד המספרים לא תקין");
      return;
    }
    const [y, from, to, p, r] = numbers;
    const extraProblem = validateExtra(extra);
    if (extraProblem) {
      setError(extraProblem);
      return;
    }

    setSaving(true);
    setError(null);
    const { error: rpcError } = await createClient().rpc("update_bottle", {
      p_bottle_id: d.id,
      p_winery: winery,
      p_name: name,
      p_type: type,
      // The generated types don't mark these as nullable, but the function
      // accepts null ("no year" = NV, empty window, no price).
      p_year: y as number,
      p_drink_from: from as number,
      p_drink_to: to as number,
      p_paid: p as number,
      p_regular: r as number,
      p_is_gift: isGift,
      p_note: note,
    });
    if (rpcError) {
      setSaving(false);
      setError(
        rpcError.code === "23505"
          ? "כבר יש במרתף יין בשם הזה מאותו יקב"
          : "לא הצלחנו לשמור, בדקו את הפרטים ונסו שוב",
      );
      return;
    }
    // The year may have moved the bottle to another vintage – save the
    // vintage details there.
    const supabase = createClient();
    const { data: moved } = await supabase.from("bottles").select("vintage_id").eq("id", d.id).single();
    const ok = await saveExtra(d.wineId, moved?.vintage_id ?? d.vintageId, [d.id], extra);
    if (!ok) {
      setSaving(false);
      setError("הפרטים הבסיסיים נשמרו, אבל הפרטים הנוספים לא. נסו שוב");
      return;
    }
    onDone();
  }

  return (
    <>
      <h2 className="text-xl font-bold">עריכת בקבוק</h2>
      <p className="text-sm text-muted">שינוי של יקב, שם או סוג חל על כל הבקבוקים של היין הזה, ושאר השדות רק על הבקבוק הזה</p>

      <div className="grid grid-cols-2 gap-3">
        <Field label="יקב">
          <input value={winery} onChange={(e) => setWinery(e.target.value)} dir="auto" maxLength={120} className={inputClass} />
        </Field>
        <Field label="שם">
          <input value={name} onChange={(e) => setName(e.target.value)} dir="auto" maxLength={120} className={inputClass} />
        </Field>
        <Field label="סוג">
          <select value={type} onChange={(e) => setType(e.target.value as WineType)} className={inputClass}>
            {WINE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="בציר (ריק = NV)">
          <input value={year} onChange={(e) => setYear(e.target.value)} inputMode="numeric" maxLength={4} className={inputClass} />
        </Field>
        <Field label="חלון שתייה, משנה">
          <input value={drinkFrom} onChange={(e) => setDrinkFrom(e.target.value)} inputMode="numeric" maxLength={4} className={inputClass} />
        </Field>
        <Field label="עד שנה">
          <input value={drinkTo} onChange={(e) => setDrinkTo(e.target.value)} inputMode="numeric" maxLength={4} className={inputClass} />
        </Field>
        <Field label="שילמנו (₪)">
          <input value={paid} onChange={(e) => setPaid(e.target.value)} inputMode="decimal" className={inputClass} />
        </Field>
        <Field label="מחיר רגיל (₪)">
          <input value={regular} onChange={(e) => setRegular(e.target.value)} inputMode="decimal" className={inputClass} />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={isGift} onChange={(e) => setIsGift(e.target.checked)} />
        קיבלנו במתנה
      </label>
      <Field label="הערה">
        <textarea value={note} onChange={(e) => setNote(e.target.value)} dir="auto" rows={2} maxLength={1000} className={inputClass} />
      </Field>

      <ExtraFields value={extra} onChange={setExtra} />

      <ErrorNote message={error} />

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="rounded-full bg-accent px-4 py-3 font-medium text-white disabled:opacity-60 dark:text-black"
        >
          {saving ? "שומר…" : "שמירה"}
        </button>
        <button type="button" onClick={onCancel} className="rounded-full border border-muted/40 px-4 py-3">
          ביטול
        </button>
      </div>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-muted">{label}</span>
      {children}
    </label>
  );
}
