import type { Metadata } from "next";
import { BackLink } from "@/components/back-link";
import { getCurrentUser } from "@/lib/auth";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { WINE_TYPES } from "@/app/bottle/details";
import { LabelPhoto } from "@/app/bottle/label-photo";
import { getWine } from "@/lib/fridges";
import { WineVintages } from "./wine-vintages";
import { formatScore } from "@/lib/wine-extra";

export const metadata: Metadata = { title: "יין · מרתף יין" };

export default function WinePagePage({ params }: PageProps<"/wines/[id]">) {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-8">
      <BackLink href="/bottles" label="הרשימה" />
      <Suspense fallback={<p className="text-muted">טוען…</p>}>
        <Wine params={params} />
      </Suspense>
    </main>
  );
}

const dateFormat = new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "long", year: "numeric" });

async function Wine({ params }: { params: PageProps<"/wines/[id]">["params"] }) {
  const { id } = await params;
  // Only a wine of the user's own cellar is found (friends get their own page).
  const { cellarId } = await getCurrentUser();
  const wine = await getWine(cellarId, id);
  if (!wine) notFound();

  const facts = [
    WINE_TYPES.find((t) => t.value === wine.type)?.label,
    wine.grape,
    [wine.region, wine.country].filter(Boolean).join(", "),
  ].filter(Boolean);
  const inCellar = wine.vintages.reduce((n, v) => n + v.inCellar, 0);

  return (
    <>
      <header className="flex flex-col gap-1">
        <p className="text-sm text-muted" dir="auto">
          {wine.winery}
        </p>
        <h1 className="text-2xl font-bold" dir="auto">
          {wine.name}
        </h1>
        {facts.length > 0 && (
          <p className="text-sm text-muted" dir="auto">
            {facts.join(" · ")}
          </p>
        )}
      </header>

      <LabelPhoto wineId={wine.id} cellarId="" path={wine.labelPath} canEdit={false} />

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">
          בצירים <span className="text-sm font-normal text-muted">({inCellar} במרתף)</span>
        </h2>
        <WineVintages vintages={wine.vintages} />
      </section>

      {wine.ratings.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">ציונים</h2>
          <ul className="flex flex-col gap-1 text-sm">
            {wine.ratings.map((r, i) => (
              <li key={i} className="flex justify-between gap-2">
                <span>
                  {r.year === null ? "היין בכלל" : `בציר ${r.year}`}
                  {r.rater ? ` · ${r.rater}` : ""}
                </span>
                <span className="tabular-nums">{formatScore(r.score)} מתוך 5</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">היסטוריית שתייה</h2>
        {wine.tastings.length === 0 ? (
          <p className="text-sm text-muted">עוד לא שתינו מהיין הזה.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-muted/20 rounded-xl bg-surface shadow-sm">
            {wine.tastings.map((t) => (
              <li key={t.id} className="flex flex-col gap-0.5 px-4 py-3 text-sm">
                <span className="flex justify-between gap-2">
                  <span className="tabular-nums">{t.year ?? "NV"}</span>
                  <span className="text-xs text-muted">{dateFormat.format(new Date(t.tastedOn))}</span>
                </span>
                {t.place && <span className="text-xs text-muted" dir="auto">{t.place}</span>}
                {t.notes && <span dir="auto">{t.notes}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
