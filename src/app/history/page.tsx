import type { Metadata } from "next";
import { getLocale, getT } from "@/i18n/server";
import { intlTag } from "@/i18n/locales";
import Link from "next/link";
import { Suspense } from "react";
import { BackLink } from "@/components/back-link";
import { getCurrentUser } from "@/lib/auth";
import { getHistory } from "@/lib/fridges";
import { formatScore } from "@/lib/wine-extra";

export const metadata: Metadata = { title: "היסטוריה ודירוגים · מרתף יין" };

export default async function HistoryPage() {
  const t = await getT();
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 px-4 py-8">
      <header className="flex flex-col gap-1">
        <BackLink href="/" label={t.friends.toMine} />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-bold">{t.history.title}</h1>
          <Suspense fallback={null}>
            <AddOutside />
          </Suspense>
        </div>
        <p className="text-sm text-muted">
          <span className="inline-block">{t.history.intro[0]}</span>{" "}
          <span className="inline-block">{t.history.intro[1]}</span>
        </p>
      </header>
      <Suspense fallback={<p className="text-muted">{t.common.loading}</p>}>
        <History />
      </Suspense>
    </main>
  );
}

async function AddOutside() {
  const [user, t] = await Promise.all([getCurrentUser(), getT()]);
  if (!user.canEdit) return null;
  return (
    <Link href="/history/new" className="rounded-full border border-muted/40 px-4 py-2 text-sm">
      {t.history.addRating}
    </Link>
  );
}

async function History() {
  const [{ cellarId }, t, locale] = await Promise.all([getCurrentUser(), getT(), getLocale()]);
  const entries = await getHistory(cellarId);
  const dateFormat = new Intl.DateTimeFormat(intlTag(locale), { day: "numeric", month: "long", year: "numeric" });
  if (entries.length === 0) return <p className="text-muted">{t.history.empty}</p>;

  return (
    <>
      <p className="text-sm text-muted">{t.history.bottles(entries.length)}</p>
      <ul className="flex flex-col divide-y divide-muted/20 rounded-xl bg-surface shadow-sm">
        {entries.map((e) => (
          <li key={e.id} className="flex flex-col gap-0.5 px-4 py-3">
            <span className="flex items-baseline justify-between gap-2">
              {/* The name may be cut ("…"), the vintage never is. */}
              <span className="flex min-w-0 items-baseline gap-1">
                {e.wineId ? (
                  <Link href={`/wines/${e.wineId}`} dir="auto" className="min-w-0 truncate underline-offset-2 hover:underline">
                    {e.title}
                  </Link>
                ) : (
                  <span dir="auto" className="min-w-0 truncate">
                    {e.title}
                  </span>
                )}
                <span className="shrink-0 text-muted tabular-nums">{e.year ?? "NV"}</span>
              </span>
              <span className="shrink-0 text-xs text-muted">{dateFormat.format(new Date(e.tastedOn))}</span>
            </span>
            <span className="flex items-baseline justify-between gap-2 text-xs text-muted">
              <span dir="auto">{e.place}</span>
              <span className="shrink-0">{e.score !== null ? <Score value={e.score} label={t.history.scoreAria(formatScore(e.score))} /> : t.history.noScore}</span>
            </span>
            {e.notes && <span className="text-sm" dir="auto">{e.notes}</span>}
          </li>
        ))}
      </ul>
    </>
  );
}

/** The household's score for the wine, out of 5. */
function Score({ value, label }: { value: number; label: string }) {
  return (
    <span aria-label={label}>
      <span className="text-accent" aria-hidden="true">★</span> <span className="tabular-nums" aria-hidden="true">{formatScore(value)}</span>
    </span>
  );
}
