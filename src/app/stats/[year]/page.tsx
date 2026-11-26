import type { Metadata } from "next";
import { BackLink } from "@/components/back-link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth";
import { yearSummary } from "@/lib/stats";
import { getStatsData } from "@/lib/stats-data";
import { Card, nis, today } from "../parts";

export const metadata: Metadata = { title: "סיכום שנה · מרתף יין" };

export default function YearPage({ params }: PageProps<"/stats/[year]">) {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-8">
      <BackLink href="/stats" label="סטטיסטיקות" />
      <Suspense fallback={<p className="text-muted">טוען…</p>}>
        <Summary params={params} />
      </Suspense>
    </main>
  );
}

/** The year summary (spec): computed when viewed, no scheduled job, no emails. */
async function Summary({ params }: { params: PageProps<"/stats/[year]">["params"] }) {
  const { year: raw } = await params;
  const year = Number(raw);
  const thisYear = Number(today().slice(0, 4));
  if (!/^\d{4}$/.test(raw) || year < 1990 || year > thisYear) notFound();

  const { cellarId } = await getCurrentUser();
  const { bottles, ratings } = await getStatsData(cellarId);
  const s = yearSummary(bottles, ratings, year);
  const diff = s.valueEnd - s.valueStart;

  return (
    <>
      <h1 className="text-2xl font-bold">
        {year === thisYear ? "השנה שלנו עד עכשיו" : "השנה שלנו"} · {year}
      </h1>
      <div className="grid grid-cols-3 gap-2">
        <Card big={String(s.drunk)} small="בקבוקים ששתינו" />
        <Card big={String(s.bought)} small="בקבוקים שקנינו" />
        <Card big={nis(s.spent)} small="שווי מה שקנינו" />
      </div>

      <section className="flex flex-col gap-1 rounded-xl bg-surface p-4 shadow-sm">
        <h2 className="font-semibold">שווי המרתף</h2>
        <p>
          <span className="inline-block">
            {nis(s.valueStart)} בתחילת השנה ← {nis(s.valueEnd)} {year === thisYear ? "היום" : "בסופה"}
          </span>{" "}
          <span className="inline-block text-muted">
            ({diff >= 0 ? "+" : "−"}
            {nis(Math.abs(diff))})
          </span>
        </p>
        <p className="text-xs text-muted">לפי המחירים שרשומים היום</p>
      </section>

      <section className="flex flex-col gap-1 rounded-xl bg-surface p-4 shadow-sm">
        <h2 className="font-semibold">🏆 היין הכי טוב של השנה</h2>
        {s.best ? (
          <p>
            <span dir="auto">{s.best.title}</span> <span className="text-muted">{s.best.year ?? "NV"}</span> · {s.best.score.toFixed(1)} מתוך 5
          </p>
        ) : (
          <p className="text-sm text-muted">עוד לא דירגנו יין ששתינו השנה</p>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">נכנסים לחלון השתייה ב־{year + 1}</h2>
        {s.openingNextYear.length === 0 ? (
          <p className="text-sm text-muted">אין יינות שנכנסים לחלון השתייה בשנה הבאה</p>
        ) : (
          <ul className="flex flex-col divide-y divide-muted/20 rounded-xl bg-surface shadow-sm">
            {s.openingNextYear.map((o) => (
              <li key={`${o.title}${o.year}`} className="flex items-baseline justify-between gap-2 px-4 py-2">
                <span dir="auto">
                  {o.title} <span className="text-muted">{o.year ?? "NV"}</span>
                </span>
                {o.count > 1 && (
                  <span className="text-sm text-muted" dir="ltr">
                    ×{o.count}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
