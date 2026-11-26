"use client";

import { useT } from "@/i18n/provider";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { WINE_TYPES, inputClass, type WineType } from "@/app/bottle/details";
import { ErrorNote } from "@/app/bottle/error-note";
import { createClient } from "@/lib/supabase/client";
import { ScoreInput } from "@/components/score-input";

const today = () => new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD in local time

export function OutsideTastingForm({ wines }: { wines: { winery: string; name: string }[] }) {
  const router = useRouter();
  const t = useT();
  const h = t.history;
  const [winery, setWinery] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState<WineType>("red");
  const [year, setYear] = useState("");
  const [date, setDate] = useState(today);
  const [place, setPlace] = useState("");
  const [notes, setNotes] = useState("");
  const [score, setScore] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wineries = [...new Set(wines.map((w) => w.winery))];
  const names = wines.filter((w) => w.winery.toLowerCase() === winery.trim().toLowerCase()).map((w) => w.name);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const y = year.trim() ? Number(year) : null;
    const s = score.trim() ? Number(score) : null;
    if (y !== null && !(Number.isInteger(y) && y >= 1900 && y <= new Date().getFullYear() + 1)) {
      setError(h.badYear);
      return;
    }
    if (s !== null && !(s >= 1 && s <= 5)) {
      setError(h.badScore);
      return;
    }
    setSaving(true);
    const { error: rpcError } = await createClient().rpc("log_tasting", {
      p_winery: winery,
      p_name: name,
      p_type: type,
      p_year: y ?? undefined,
      p_tasted_on: date,
      p_place: place,
      p_notes: notes,
      p_score: s ?? undefined,
    });
    if (rpcError) {
      setSaving(false);
      setError(h.saveFailed);
      return;
    }
    router.push("/history");
    router.refresh();
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-3">
      <Field label={h.winery}>
        <input value={winery} onChange={(e) => setWinery(e.target.value)} list="t-wineries" dir="auto" maxLength={120} required className={inputClass} />
        <datalist id="t-wineries">
          {wineries.map((w) => (
            <option key={w} value={w} />
          ))}
        </datalist>
      </Field>
      <Field label={h.name}>
        <input value={name} onChange={(e) => setName(e.target.value)} list="t-names" dir="auto" maxLength={120} required className={inputClass} />
        <datalist id="t-names">
          {names.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={h.type}>
          <select value={type} onChange={(e) => setType(e.target.value as WineType)} className={inputClass}>
            {WINE_TYPES.map((w) => (
              <option key={w.value} value={w.value}>
                {t.wineType[w.value]}
              </option>
            ))}
          </select>
        </Field>
        <Field label={h.yearNv}>
          <input value={year} onChange={(e) => setYear(e.target.value)} inputMode="numeric" maxLength={4} className={inputClass} />
        </Field>
        <Field label={h.when}>
          <input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} required className={inputClass} />
        </Field>
      </div>
      {/* Not a <label>: the score control has several buttons of its own. */}
      <div className="flex flex-col gap-1 text-sm">
        <span className="text-muted">{h.scoreOptional}</span>
        <ScoreInput value={score} onChange={setScore} />
      </div>
      <Field label={h.where}>
        <input value={place} onChange={(e) => setPlace(e.target.value)} dir="auto" maxLength={120} placeholder={h.wherePlaceholder} className={inputClass} />
      </Field>
      <Field label={h.notes}>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} dir="auto" rows={3} maxLength={2000} className={inputClass} />
      </Field>
      <ErrorNote message={error} />
      <button type="submit" disabled={saving} className="rounded-full bg-accent px-5 py-3 font-medium text-white disabled:opacity-60 dark:text-black">
        {saving ? h.saving : t.common.save}
      </button>
    </form>
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
