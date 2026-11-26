import { pageTitle } from "@/i18n/metadata";
import { getT } from "@/i18n/server";
import { BackLink } from "@/components/back-link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth";
import { yearSummary } from "@/lib/stats";
import { getStatsData } from "@/lib/stats-data";
import { Card, nis, today } from "../parts";

export const generateMetadata = pageTitle((t) => t.titles.yearInReview);

export default async function YearPage({ params }: PageProps<"/stats/[year]">) {
  const t = await getT();
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-8">
      <BackLink href="/stats" label={t.stats.title} />
      <Suspense fallback={<p className="text-muted">{t.common.loading}</p>}>
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

  const [{ cellarId }, t] = await Promise.all([getCurrentUser(), getT()]);
  const st = t.stats;
  const { bottles, ratings } = await getStatsData(cellarId);
  const s = yearSummary(bottles, ratings, year);
  const diff = s.valueEnd - s.valueStart;

  return (
    <>
      <h1 className="text-2xl font-bold">
        {year === thisYear ? st.ourYearSoFar : st.ourYear} · {year}
      </h1>
      <div className="grid grid-cols-3 gap-2">
        <Card big={String(s.drunk)} small={st.drunk} />
        <Card big={String(s.bought)} small={st.bought} />
        <Card big={nis(s.spent)} small={st.spent} />
      </div>

      <section className="flex flex-col gap-1 rounded-xl bg-surface p-4 shadow-sm">
        <h2 className="font-semibold">{st.value}</h2>
        <p>
          <span className="inline-block">
            {st.valueChange(nis(s.valueStart), nis(s.valueEnd), year === thisYear)}
          </span>{" "}
          <span className="inline-block text-muted">
            ({diff >= 0 ? "+" : "−"}
            {nis(Math.abs(diff))})
          </span>
        </p>
        <p className="text-xs text-muted">{st.valueNote}</p>
      </section>

      <section className="flex flex-col gap-1 rounded-xl bg-surface p-4 shadow-sm">
        <h2 className="font-semibold">{st.best}</h2>
        {s.best ? (
          <p>
            <span dir="auto">{s.best.title}</span> <span className="text-muted">{s.best.year ?? "NV"}</span> · {st.outOf5(s.best.score.toFixed(1))}
          </p>
        ) : (
          <p className="text-sm text-muted">{st.noBest}</p>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">{st.openingNext(year + 1)}</h2>
        {s.openingNextYear.length === 0 ? (
          <p className="text-sm text-muted">{st.noneOpening}</p>
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
