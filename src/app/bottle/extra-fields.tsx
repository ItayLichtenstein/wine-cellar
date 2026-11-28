"use client";

import { useState } from "react";
import { BODIES, type Body, type CriticScore, type Kosher, type Shape, type WineExtra, type WindowSource } from "@/lib/wine-extra";
import { useT } from "@/i18n/provider";
import { inputClass } from "./details";

/**
 * The optional "more details" of a wine, folded away by default so the
 * common case (winery, name, year, price) stays short. Used by both the
 * add form and the edit form.
 */
export function ExtraFields({ value, onChange }: { value: WineExtra; onChange: (v: WineExtra) => void }) {
  const t = useT();
  const hasData = value.grape || value.country || value.critics.length > 0 || value.link || value.alcohol || value.body;
  const [open, setOpen] = useState(Boolean(hasData));
  const set = <K extends keyof WineExtra>(key: K, v: WineExtra[K]) => onChange({ ...value, [key]: v });

  // Folding keeps what was typed (it is still saved); the button says so.
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} aria-expanded={false} className="self-start text-sm underline underline-offset-2">
        {t.extra.show} {hasData ? t.extra.filled : t.extra.examples}
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <button type="button" onClick={() => setOpen(false)} aria-expanded className="self-start text-sm underline underline-offset-2">
        {t.extra.hide}
      </button>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t.extra.grape}>
          <input value={value.grape} onChange={(e) => set("grape", e.target.value)} dir="auto" maxLength={120} className={inputClass} />
        </Field>
        <Field label={t.extra.country}>
          <input value={value.country} onChange={(e) => set("country", e.target.value)} dir="auto" maxLength={60} className={inputClass} />
        </Field>
        <Field label={t.extra.region}>
          <input value={value.region} onChange={(e) => set("region", e.target.value)} dir="auto" maxLength={120} className={inputClass} />
        </Field>
        <Field label={t.extra.alcohol}>
          <input value={value.alcohol} onChange={(e) => set("alcohol", e.target.value)} inputMode="decimal" maxLength={4} className={inputClass} />
        </Field>
        <Field label={t.extra.kosher}>
          <select value={value.kosher} onChange={(e) => set("kosher", e.target.value as Kosher)} className={inputClass}>
            <option value="unknown">{t.extra.unknown}</option>
            <option value="yes">{t.extra.kosherYes}</option>
            <option value="no">{t.extra.kosherNo}</option>
          </select>
        </Field>
        <Field label={t.extra.shape}>
          <select value={value.shape} onChange={(e) => set("shape", e.target.value as Shape)} className={inputClass}>
            <option value="standard">{t.extra.standard}</option>
            <option value="burgundy">{t.extra.burgundy}</option>
          </select>
        </Field>
        {/* A full row, so the peak years below stay side by side. */}
        <div className="col-span-2">
          <Field label={t.extra.body}>
            <select value={value.body} onChange={(e) => set("body", e.target.value as Body | "")} className={inputClass}>
              <option value="">{t.extra.unknown}</option>
              {BODIES.map((b) => (
                <option key={b} value={b}>
                  {t.body[b]}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label={t.extra.peakFrom}>
          <input value={value.peakFrom} onChange={(e) => set("peakFrom", e.target.value)} inputMode="numeric" maxLength={4} className={inputClass} />
        </Field>
        <Field label={t.extra.toYear}>
          <input value={value.peakTo} onChange={(e) => set("peakTo", e.target.value)} inputMode="numeric" maxLength={4} className={inputClass} />
        </Field>
      </div>
      <Field label={t.extra.windowSource}>
        <select value={value.windowSource} onChange={(e) => set("windowSource", e.target.value as WindowSource | "")} className={inputClass}>
          <option value="">{t.extra.notSaid}</option>
          <option value="critic">{t.extra.critic}</option>
          <option value="estimate">{t.extra.estimate}</option>
        </select>
      </Field>

      <Critics critics={value.critics} onChange={(c) => set("critics", c)} />

      <Field label={t.extra.link}>
        <input value={value.link} onChange={(e) => set("link", e.target.value)} type="url" dir="ltr" placeholder="https://" maxLength={500} className={inputClass} />
      </Field>
    </div>
  );
}

function Critics({ critics, onChange }: { critics: CriticScore[]; onChange: (c: CriticScore[]) => void }) {
  const t = useT();
  const update = (i: number, c: Partial<CriticScore>) => onChange(critics.map((x, k) => (k === i ? { ...x, ...c } : x)));
  return (
    <div className="flex flex-col gap-2 text-sm">
      <span className="text-muted">{t.extra.critics}</span>
      {critics.map((c, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            value={c.critic}
            onChange={(e) => update(i, { critic: e.target.value })}
            placeholder={t.extra.criticPlaceholder}
            dir="auto"
            maxLength={60}
            aria-label={t.extra.criticName(i + 1)}
            className={`${inputClass} min-w-0 flex-1`}
          />
          <input
            value={c.score || ""}
            onChange={(e) => update(i, { score: Number(e.target.value) || 0 })}
            inputMode="numeric"
            maxLength={3}
            placeholder="94"
            aria-label={t.extra.criticScore(i + 1)}
            className={`${inputClass} w-16`}
          />
          <button type="button" onClick={() => onChange(critics.filter((_, k) => k !== i))} aria-label={t.extra.removeCritic} className="px-2 text-muted">
            ✕
          </button>
        </div>
      ))}
      {critics.length < 20 && (
        <button type="button" onClick={() => onChange([...critics, { critic: "", score: 0 }])} className="self-start underline underline-offset-2">
          {t.extra.addCritic}
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
