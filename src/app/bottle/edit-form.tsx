"use client";

import { useState } from "react";
import { useT } from "@/i18n/provider";
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
  const t = useT();
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
      setError(t.bottleForm.needWineryName);
      return;
    }
    const numbers = [year, drinkFrom, drinkTo, paid, regular].map(numOrNull);
    if (numbers.some((n) => n !== null && Number.isNaN(n))) {
      setError(t.bottleForm.badNumber);
      return;
    }
    const [y, from, to, p, r] = numbers;
    const extraProblem = validateExtra(extra, t);
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
          ? t.bottleForm.duplicate
          : t.bottleForm.saveFailed,
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
      setError(t.bottleForm.extraFailed);
      return;
    }
    onDone();
  }

  return (
    <>
      <h2 className="text-xl font-bold">{t.bottleForm.editTitle}</h2>
      <p className="text-sm text-muted">{t.bottleForm.editHint}</p>

      <div className="grid grid-cols-2 gap-3">
        <Field label={t.bottleForm.winery}>
          <input value={winery} onChange={(e) => setWinery(e.target.value)} dir="auto" maxLength={120} className={inputClass} />
        </Field>
        <Field label={t.bottleForm.name}>
          <input value={name} onChange={(e) => setName(e.target.value)} dir="auto" maxLength={120} className={inputClass} />
        </Field>
        <Field label={t.bottleForm.type}>
          <select value={type} onChange={(e) => setType(e.target.value as WineType)} className={inputClass}>
            {WINE_TYPES.map((w) => (
              <option key={w.value} value={w.value}>
                {t.wineType[w.value]}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t.bottleForm.vintageOrNv}>
          <input value={year} onChange={(e) => setYear(e.target.value)} inputMode="numeric" maxLength={4} className={inputClass} />
        </Field>
        <Field label={t.bottleForm.windowFrom}>
          <input value={drinkFrom} onChange={(e) => setDrinkFrom(e.target.value)} inputMode="numeric" maxLength={4} className={inputClass} />
        </Field>
        <Field label={t.bottleForm.toYear}>
          <input value={drinkTo} onChange={(e) => setDrinkTo(e.target.value)} inputMode="numeric" maxLength={4} className={inputClass} />
        </Field>
        <Field label={t.bottleForm.paid}>
          <input value={paid} onChange={(e) => setPaid(e.target.value)} inputMode="decimal" className={inputClass} />
        </Field>
        <Field label={t.bottleForm.regular}>
          <input value={regular} onChange={(e) => setRegular(e.target.value)} inputMode="decimal" className={inputClass} />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={isGift} onChange={(e) => setIsGift(e.target.checked)} />
        {t.bottleForm.gotAsGift}
      </label>
      <Field label={t.bottleForm.note}>
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
          {saving ? t.bottleForm.saving : t.common.save}
        </button>
        <button type="button" onClick={onCancel} className="rounded-full border border-muted/40 px-4 py-3">
          {t.cellar.cancel}
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
