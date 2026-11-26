import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BackLink } from "@/components/back-link";
import { getCurrentUser } from "@/lib/auth";
import { getHistory } from "@/lib/fridges";
import { bottles as countBottles } from "@/lib/plural";
import { formatScore } from "@/lib/wine-extra";

export const metadata: Metadata = { title: "היסטוריה ודירוגים · מרתף יין" };

export default function HistoryPage() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 px-4 py-8">
      <header className="flex flex-col gap-1">
        <BackLink href="/" label="המקרר" />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-bold">היסטוריה ודירוגים</h1>
          <Suspense fallback={null}>
            <AddOutside />
          </Suspense>
        </div>
        <p className="text-sm text-muted">
          <span className="inline-block">כל בקבוק ששתיתם, עם הציון שנתתם ליין.</span>{" "}
          <span className="inline-block">לחיצה על יין פותחת את כל הדירוגים שלו.</span>
        </p>
      </header>
      <Suspense fallback={<p className="text-muted">טוען…</p>}>
        <History />
      </Suspense>
    </main>
  );
}

async function AddOutside() {
  if (!(await getCurrentUser()).canEdit) return null;
  return (
    <Link href="/history/new" className="rounded-full border border-muted/40 px-4 py-2 text-sm">
      + הוספת דירוג
    </Link>
  );
}

const dateFormat = new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "long", year: "numeric" });

async function History() {
  const { cellarId } = await getCurrentUser();
  const entries = await getHistory(cellarId);
  if (entries.length === 0) return <p className="text-muted">עוד לא שתיתם בקבוק מהמרתף.</p>;

  return (
    <>
      <p className="text-sm text-muted">{countBottles(entries.length)}</p>
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
              <span className="shrink-0">{e.score !== null ? <Score value={e.score} /> : "בלי ציון"}</span>
            </span>
            {e.notes && <span className="text-sm" dir="auto">{e.notes}</span>}
          </li>
        ))}
      </ul>
    </>
  );
}

/** The household's score for the wine, out of 5. */
function Score({ value }: { value: number }) {
  return (
    <span aria-label={`ציון ${formatScore(value)} מתוך 5`}>
      <span className="text-accent" aria-hidden="true">★</span> <span className="tabular-nums" aria-hidden="true">{formatScore(value)}</span>
    </span>
  );
}
