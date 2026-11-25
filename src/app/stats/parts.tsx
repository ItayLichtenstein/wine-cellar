import type { Slice } from "@/lib/stats";

/** Today in Israel (the server runs in UTC). */
export function today(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" });
}

export const nis = (n: number) => `₪${Math.round(n).toLocaleString("he-IL")}`;

export function Card({ big, small }: { big: string; small: string }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-xl bg-surface px-2 py-3 text-center shadow-sm">
      <span className="text-xl font-bold tabular-nums">{big}</span>
      <span className="text-xs text-muted">{small}</span>
    </div>
  );
}

/** Horizontal bars: a label, a bar sized against the biggest slice, the count. */
export function Bars({ title, slices }: { title: string; slices: Slice[] }) {
  if (slices.length === 0) return null;
  const max = Math.max(...slices.map((s) => s.count));
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold">{title}</h2>
      <ul className="flex flex-col gap-1.5 rounded-xl bg-surface p-3 shadow-sm">
        {slices.map((s) => (
          <li key={s.label} className="grid grid-cols-[6.5rem_1fr_2rem] items-center gap-2 text-sm">
            <span className="truncate" dir="auto">
              {s.label}
            </span>
            <span className="h-3 rounded-full bg-accent/80" style={{ width: `${(s.count / max) * 100}%` }} />
            <span className="text-end text-muted tabular-nums">{s.count}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
