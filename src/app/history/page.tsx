import type { Metadata } from "next";
import { Suspense } from "react";
import { getHistory } from "@/lib/fridges";

export const metadata: Metadata = { title: "היסטוריה · מרתף יין" };

export default function HistoryPage() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 px-4 py-8">
      <h1 className="text-2xl font-bold">מה ששתינו</h1>
      <Suspense fallback={<p className="text-muted">טוען…</p>}>
        <History />
      </Suspense>
    </main>
  );
}

const dateFormat = new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "long", year: "numeric" });

async function History() {
  const entries = await getHistory();
  if (entries.length === 0) return <p className="text-muted">עוד לא שתיתם בקבוק מהמרתף.</p>;

  return (
    <>
      <p className="text-sm text-muted">{entries.length} בקבוקים</p>
      <ul className="flex flex-col divide-y divide-muted/20 rounded-xl bg-surface shadow-sm">
        {entries.map((e) => (
          <li key={e.id} className="flex flex-col gap-0.5 px-4 py-3">
            <span className="flex items-baseline justify-between gap-2">
              <span dir="auto" className="min-w-0 truncate">
                {e.title} <span className="text-muted tabular-nums">{e.year ?? "NV"}</span>
              </span>
              <span className="shrink-0 text-xs text-muted">{dateFormat.format(new Date(e.tastedOn))}</span>
            </span>
            {e.place && <span className="text-xs text-muted" dir="auto">{e.place}</span>}
            {e.notes && <span className="text-sm" dir="auto">{e.notes}</span>}
          </li>
        ))}
      </ul>
    </>
  );
}
