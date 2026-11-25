import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { WINE_TYPES } from "@/app/bottle/details";
import { getCurrentUser } from "@/lib/auth";
import { DRINK_STATES, DRINK_STATE_ORDER } from "@/lib/drink-state";
import { breakdown, byDrinkState, cellarValue, drinkingPace, summaryYears, tasteProfile, type Slice } from "@/lib/stats";
import { getStatsData } from "@/lib/stats-data";
import { Bars, Card, nis, today } from "./parts";

export const metadata: Metadata = { title: "סטטיסטיקות · מרתף יין" };

export default function StatsPage() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-8">
      <h1 className="text-2xl font-bold">סטטיסטיקות</h1>
      <Suspense fallback={<p className="text-muted">טוען…</p>}>
        <Stats />
      </Suspense>
    </main>
  );
}

const typeLabel = (t: string) => WINE_TYPES.find((x) => x.value === t)?.label ?? t;
const MONTHS = ["ינו׳", "פבר׳", "מרץ", "אפר׳", "מאי", "יוני", "יולי", "אוג׳", "ספט׳", "אוק׳", "נוב׳", "דצמ׳"];

async function Stats() {
  const { cellarId } = await getCurrentUser();
  const { bottles, ratings } = await getStatsData(cellarId);
  const day = today();
  const year = Number(day.slice(0, 4));

  const open = bottles.filter((b) => b.status !== "consumed");
  if (open.length === 0 && bottles.length === 0) {
    return <p className="text-muted">כשיהיו בקבוקים במרתף, כאן יופיעו המספרים.</p>;
  }

  const value = cellarValue(bottles);
  const drunkThisYear = bottles.filter((b) => b.consumedOn?.startsWith(`${year}-`)).length;
  const states = byDrinkState(bottles, year);
  const pace = drinkingPace(bottles, day);
  const types: Slice[] = breakdown(bottles, "type").map((s) => ({ ...s, label: typeLabel(s.label) }));
  const loves = [
    ...tasteProfile(bottles, ratings, "type").slice(0, 2).map((t) => ({ ...t, label: typeLabel(t.label) })),
    ...tasteProfile(bottles, ratings, "country").slice(0, 2),
    ...tasteProfile(bottles, ratings, "grape").slice(0, 2),
  ].sort((a, b) => b.average - a.average);

  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        <Card big={nis(value.value)} small={value.priced < value.total ? `שווי (${value.priced} מתוך ${value.total} עם מחיר)` : "שווי המרתף"} />
        <Card big={String(open.length)} small="בקבוקים במרתף" />
        <Card big={String(drunkThisYear)} small={`שתינו ב־${year}`} />
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">מתי לשתות</h2>
        {open.length === 0 && <p className="text-sm text-muted">כשיהיו בקבוקים במרתף, כאן יופיע כמה מהם כבר בשלים לשתייה.</p>}
        <div className="flex h-4 overflow-hidden rounded-full" role="img" aria-label="פילוח לפי בשלות">
          {DRINK_STATE_ORDER.map((s) => {
            const c = states.find((x) => x.state === s)?.count ?? 0;
            return c ? <span key={s} style={{ flexGrow: c, backgroundColor: DRINK_STATES[s].color }} title={`${DRINK_STATES[s].label}: ${c}`} /> : null;
          })}
        </div>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
          {DRINK_STATE_ORDER.map((s) => {
            const c = states.find((x) => x.state === s)?.count ?? 0;
            return c ? (
              <li key={s} className="flex items-center gap-1.5">
                <span className="size-3 rounded-sm" style={{ backgroundColor: DRINK_STATES[s].color }} aria-hidden="true" />
                {DRINK_STATES[s].label} · {c}
              </li>
            ) : null;
          })}
        </ul>
      </section>

      <Bars title="לפי סוג" slices={types} />
      <Bars title="לפי ארץ" slices={breakdown(bottles, "country")} />
      <Bars title="לפי זן" slices={breakdown(bottles, "grape")} />

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">קצב שתייה</h2>
        <p className="text-sm text-muted">בקבוקים בחודש, בשנה האחרונה</p>
        <div className="flex h-32 items-end gap-1 rounded-xl bg-surface p-3 shadow-sm" role="img" aria-label="בקבוקים ששתינו בכל חודש">
          {pace.map((p) => {
            const max = Math.max(1, ...pace.map((x) => x.count));
            return (
              <div key={p.month} className="flex flex-1 flex-col items-center justify-end gap-1">
                {p.count > 0 && <span className="text-[10px] text-muted tabular-nums">{p.count}</span>}
                <span className="w-full rounded-t bg-accent" style={{ height: `${(p.count / max) * 70}px` }} />
                <span className="text-[10px] text-muted">{MONTHS[Number(p.month.slice(5)) - 1]}</span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">מה אנחנו אוהבים</h2>
        {loves.length === 0 ? (
          <p className="text-sm text-muted">
            <span className="inline-block">אחרי כמה ציונים</span>{" "}
            <span className="inline-block">יופיע כאן פרופיל הטעם שלכם.</span>
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-muted/20 rounded-xl bg-surface shadow-sm">
            {loves.map((l) => (
              <li key={l.label} className="flex items-baseline justify-between gap-2 px-4 py-2">
                <span dir="auto">{l.label}</span>
                <span className="text-sm text-muted">
                  {l.average.toFixed(1)} מתוך 5 · {l.wines} יינות
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">סיכום שנה</h2>
        <div className="flex flex-wrap gap-2">
          {summaryYears(bottles, year).map((y) => (
            <Link key={y} href={`/stats/${y}`} className="rounded-full border border-muted/40 px-4 py-2 text-sm">
              {y}
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
