"use client";

import { useState } from "react";
import type { CriticScore, Kosher, Shape, WineExtra, WindowSource } from "@/lib/wine-extra";
import { inputClass } from "./details";

/**
 * The optional "more details" of a wine, folded away by default so the
 * common case (winery, name, year, price) stays short. Used by both the
 * add form and the edit form.
 */
export function ExtraFields({ value, onChange }: { value: WineExtra; onChange: (v: WineExtra) => void }) {
  const hasData = value.grape || value.country || value.critics.length > 0 || value.link || value.alcohol;
  const [open, setOpen] = useState(Boolean(hasData));
  const set = <K extends keyof WineExtra>(key: K, v: WineExtra[K]) => onChange({ ...value, [key]: v });

  // Folding keeps what was typed (it is still saved); the button says so.
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} aria-expanded={false} className="self-start text-sm underline underline-offset-2">
        + פרטים נוספים {hasData ? "(יש פרטים שמולאו)" : "(זן, ארץ, ציוני מבקרים, קישור…)"}
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <button type="button" onClick={() => setOpen(false)} aria-expanded className="self-start text-sm underline underline-offset-2">
        − הסתרת הפרטים הנוספים
      </button>
      <div className="grid grid-cols-2 gap-3">
        <Field label="זן">
          <input value={value.grape} onChange={(e) => set("grape", e.target.value)} dir="auto" maxLength={120} className={inputClass} />
        </Field>
        <Field label="ארץ">
          <input value={value.country} onChange={(e) => set("country", e.target.value)} dir="auto" maxLength={60} className={inputClass} />
        </Field>
        <Field label="אזור">
          <input value={value.region} onChange={(e) => set("region", e.target.value)} dir="auto" maxLength={120} className={inputClass} />
        </Field>
        <Field label="אלכוהול (%)">
          <input value={value.alcohol} onChange={(e) => set("alcohol", e.target.value)} inputMode="decimal" maxLength={4} className={inputClass} />
        </Field>
        <Field label="כשרות">
          <select value={value.kosher} onChange={(e) => set("kosher", e.target.value as Kosher)} className={inputClass}>
            <option value="unknown">לא ידוע</option>
            <option value="yes">כשר</option>
            <option value="no">לא כשר</option>
          </select>
        </Field>
        <Field label="צורת בקבוק">
          <select value={value.shape} onChange={(e) => set("shape", e.target.value as Shape)} className={inputClass}>
            <option value="standard">רגיל</option>
            <option value="burgundy">בורגון (רחב)</option>
          </select>
        </Field>
        <Field label="שיא: משנה">
          <input value={value.peakFrom} onChange={(e) => set("peakFrom", e.target.value)} inputMode="numeric" maxLength={4} className={inputClass} />
        </Field>
        <Field label="עד שנה">
          <input value={value.peakTo} onChange={(e) => set("peakTo", e.target.value)} inputMode="numeric" maxLength={4} className={inputClass} />
        </Field>
      </div>
      <Field label="מקור חלון השתייה">
        <select value={value.windowSource} onChange={(e) => set("windowSource", e.target.value as WindowSource | "")} className={inputClass}>
          <option value="">לא צוין</option>
          <option value="critic">מבקר</option>
          <option value="estimate">הערכה שלנו</option>
        </select>
      </Field>

      <Critics critics={value.critics} onChange={(c) => set("critics", c)} />

      <Field label="קישור לעמוד היין">
        <input value={value.link} onChange={(e) => set("link", e.target.value)} type="url" dir="ltr" placeholder="https://" maxLength={500} className={inputClass} />
      </Field>
    </div>
  );
}

function Critics({ critics, onChange }: { critics: CriticScore[]; onChange: (c: CriticScore[]) => void }) {
  const update = (i: number, c: Partial<CriticScore>) => onChange(critics.map((x, k) => (k === i ? { ...x, ...c } : x)));
  return (
    <div className="flex flex-col gap-2 text-sm">
      <span className="text-muted">ציוני מבקרים</span>
      {critics.map((c, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            value={c.critic}
            onChange={(e) => update(i, { critic: e.target.value })}
            placeholder="מבקר (למשל Suckling)"
            dir="auto"
            maxLength={60}
            aria-label={`שם המבקר ${i + 1}`}
            className={`${inputClass} min-w-0 flex-1`}
          />
          <input
            value={c.score || ""}
            onChange={(e) => update(i, { score: Number(e.target.value) || 0 })}
            inputMode="numeric"
            maxLength={3}
            placeholder="94"
            aria-label={`ציון ${i + 1}`}
            className={`${inputClass} w-16`}
          />
          <button type="button" onClick={() => onChange(critics.filter((_, k) => k !== i))} aria-label="הסרת המבקר" className="px-2 text-muted">
            ✕
          </button>
        </div>
      ))}
      {critics.length < 20 && (
        <button type="button" onClick={() => onChange([...critics, { critic: "", score: 0 }])} className="self-start underline underline-offset-2">
          + הוספת מבקר
        </button>
      )}
    </div>
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
