"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { BottleSheet } from "@/app/bottle-sheet";
import { WINE_TYPES, inputClass } from "@/app/bottle/details";
import {
  EMPTY_FILTERS,
  buildRows,
  countriesOf,
  type Filters,
  type ListBottle,
  type SortKey,
} from "@/lib/bottle-list";
import { DRINK_STATES, DRINK_STATE_ORDER } from "@/lib/drink-state";
import { bottles as countBottles } from "@/lib/plural";

const SORTS: [SortKey, string][] = [
  ["state", "בשלות"],
  ["name", "שם"],
  ["year", "בציר"],
  ["price", "מחיר"],
];

export function BottleList({ bottles }: { bottles: ListBottle[] }) {
  const router = useRouter();
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [sort, setSort] = useState<SortKey>("state");
  const [showFilters, setShowFilters] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const rows = useMemo(() => buildRows(bottles, filters, sort), [bottles, filters, sort]);
  const countries = useMemo(() => countriesOf(bottles), [bottles]);
  const shown = rows.reduce((n, r) => n + r.bottles.length, 0);
  const active = activeCount(filters);

  const set = <K extends keyof Filters>(key: K, value: Filters[K]) => setFilters((f) => ({ ...f, [key]: value }));
  const toggle = <T,>(list: T[], item: T) => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);
  const num = (v: string) => (v.trim() === "" || Number.isNaN(Number(v)) ? null : Number(v));

  if (bottles.length === 0) {
    return <p className="text-muted">עוד אין בקבוקים במרתף.</p>;
  }

  return (
    <>
      <div className="flex flex-col gap-2">
        <input
          type="search"
          value={filters.text}
          onChange={(e) => set("text", e.target.value)}
          placeholder="חיפוש יקב, יין או ארץ"
          dir="auto"
          aria-label="חיפוש"
          className={inputClass}
        />
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            aria-expanded={showFilters}
            className={`rounded-full border px-3 py-1 ${active ? "border-accent" : "border-muted/40"}`}
          >
            סינון{active ? ` (${active})` : ""}
          </button>
          <label className="flex items-center gap-2">
            <span className="text-muted">מיון:</span>
            <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="rounded-lg border border-muted/40 bg-surface px-2 py-1">
              {SORTS.map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {showFilters && (
        <section className="flex flex-col gap-3 rounded-xl bg-surface p-3 text-sm shadow-sm" aria-label="סינון">
          <Chips title="סוג">
            {WINE_TYPES.map((t) => (
              <Chip key={t.value} on={filters.types.includes(t.value)} onClick={() => set("types", toggle(filters.types, t.value))}>
                {t.label}
              </Chip>
            ))}
          </Chips>
          <Chips title="בשלות">
            {DRINK_STATE_ORDER.map((s) => (
              <Chip key={s} on={filters.states.includes(s)} onClick={() => set("states", toggle(filters.states, s))}>
                <span className="me-1 inline-block size-2.5 rounded-sm" style={{ backgroundColor: DRINK_STATES[s].color }} aria-hidden="true" />
                {DRINK_STATES[s].label}
              </Chip>
            ))}
          </Chips>
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-muted">מחיר מ־ (₪)</span>
              <input inputMode="numeric" value={filters.priceMin ?? ""} onChange={(e) => set("priceMin", num(e.target.value))} className={`${inputClass} w-24`} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-muted">עד (₪)</span>
              <input inputMode="numeric" value={filters.priceMax ?? ""} onChange={(e) => set("priceMax", num(e.target.value))} className={`${inputClass} w-24`} />
            </label>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            {countries.length > 0 && (
              <label className="flex flex-col gap-1">
                <span className="text-muted">ארץ</span>
                <select value={filters.country} onChange={(e) => set("country", e.target.value)} className={inputClass}>
                  <option value="">הכול</option>
                  {countries.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="flex flex-col gap-1">
              <span className="text-muted">צורת בקבוק</span>
              <select value={filters.shape} onChange={(e) => set("shape", e.target.value as Filters["shape"])} className={inputClass}>
                <option value="">הכול</option>
                <option value="standard">רגיל</option>
                <option value="burgundy">בורגון</option>
              </select>
            </label>
            <label className="flex items-center gap-2 pb-2">
              <input type="checkbox" checked={filters.kosherOnly} onChange={(e) => set("kosherOnly", e.target.checked)} />
              כשר בלבד
            </label>
          </div>
          {active > 0 && (
            <button type="button" onClick={() => setFilters({ ...EMPTY_FILTERS, text: filters.text })} className="self-start underline underline-offset-2">
              ניקוי הסינון
            </button>
          )}
        </section>
      )}

      <p className="text-sm text-muted">
        {shown === bottles.length ? countBottles(bottles.length) : `${shown} מתוך ${countBottles(bottles.length)}`}
      </p>

      <ul className="flex flex-col divide-y divide-muted/20 rounded-xl bg-surface shadow-sm">
        {rows.map(({ key, bottles: group, first: b }) => (
          <li key={key}>
            <button type="button" onClick={() => setOpenId(b.id)} className="flex w-full items-center gap-3 px-4 py-3 text-start">
              <span
                className="w-11 shrink-0 rounded-sm text-center text-xs font-bold leading-5 text-black tabular-nums"
                style={{ backgroundColor: DRINK_STATES[b.state].color }}
                title={DRINK_STATES[b.state].label}
              >
                {b.year ?? "NV"}
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span dir="auto" className="truncate">
                  {b.winery} – {b.name}
                </span>
                <span className="text-xs text-muted">
                  {[...new Set(group.map((x) => x.where))].join(" · ")}
                  {b.country ? ` · ${b.country}` : ""}
                </span>
              </span>
              {group.length > 1 && (
                <span dir="ltr" className="shrink-0 text-sm text-muted tabular-nums">
                  ×{group.length}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
      {rows.length === 0 && <p className="text-muted">אין בקבוקים שמתאימים לסינון.</p>}

      {openId && (
        <BottleSheet
          bottleId={openId}
          onClose={() => setOpenId(null)}
          onMove={() => router.push(`/?move=${openId}`)}
          onChanged={() => {
            setOpenId(null);
            router.refresh();
          }}
        />
      )}
    </>
  );
}

function activeCount(f: Filters): number {
  return (
    f.types.length +
    f.states.length +
    (f.kosherOnly ? 1 : 0) +
    (f.country ? 1 : 0) +
    (f.shape ? 1 : 0) +
    (f.priceMin !== null || f.priceMax !== null ? 1 : 0)
  );
}

function Chips({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-muted">{title}</span>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`flex items-center rounded-full border px-2.5 py-0.5 ${on ? "border-accent bg-accent text-white dark:text-black" : "border-muted/40"}`}
    >
      {children}
    </button>
  );
}
