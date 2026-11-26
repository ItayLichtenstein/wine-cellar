import { pageTitle } from "@/i18n/metadata";
import { getLocale, getT } from "@/i18n/server";
import { intlTag } from "@/i18n/locales";
import { BackLink } from "@/components/back-link";
import { getCurrentUser } from "@/lib/auth";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { WINE_TYPES } from "@/app/bottle/details";
import { LabelPhoto } from "@/app/bottle/label-photo";
import { getWine } from "@/lib/fridges";
import { WineVintages } from "./wine-vintages";
import { formatScore } from "@/lib/wine-extra";

export const generateMetadata = pageTitle((t) => t.titles.wine);

export default async function WinePagePage({ params }: PageProps<"/wines/[id]">) {
  const t = await getT();
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-8">
      <BackLink href="/bottles" label={t.wine.backToList} />
      <Suspense fallback={<p className="text-muted">{t.common.loading}</p>}>
        <Wine params={params} />
      </Suspense>
    </main>
  );
}

async function Wine({ params }: { params: PageProps<"/wines/[id]">["params"] }) {
  const { id } = await params;
  // Only a wine of the user's own cellar is found (friends get their own page).
  const [{ cellarId }, t, locale] = await Promise.all([getCurrentUser(), getT(), getLocale()]);
  const wine = await getWine(cellarId, id);
  const dateFormat = new Intl.DateTimeFormat(intlTag(locale), { day: "numeric", month: "long", year: "numeric" });
  if (!wine) notFound();

  const facts = [
    WINE_TYPES.some((w) => w.value === wine.type) ? t.wineType[wine.type as keyof typeof t.wineType] : null,
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
          {t.wine.vintages} <span className="text-sm font-normal text-muted">({t.wine.inCellarCount(inCellar)})</span>
        </h2>
        <WineVintages vintages={wine.vintages} />
      </section>

      {wine.ratings.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">{t.wine.scores}</h2>
          <ul className="flex flex-col gap-1 text-sm">
            {wine.ratings.map((r, i) => (
              <li key={i} className="flex justify-between gap-2">
                <span>
                  {r.year === null ? t.wine.wholeWine : t.wine.vintage(r.year)}
                  {r.rater ? ` · ${r.rater}` : ""}
                </span>
                <span className="tabular-nums">{t.wine.outOf5(formatScore(r.score))}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">{t.wine.history}</h2>
        {wine.tastings.length === 0 ? (
          <p className="text-sm text-muted">{t.wine.noHistory}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-muted/20 rounded-xl bg-surface shadow-sm">
            {wine.tastings.map((tasting) => (
              <li key={tasting.id} className="flex flex-col gap-0.5 px-4 py-3 text-sm">
                <span className="flex justify-between gap-2">
                  <span className="tabular-nums">{tasting.year ?? "NV"}</span>
                  <span className="text-xs text-muted">{dateFormat.format(new Date(tasting.tastedOn))}</span>
                </span>
                {tasting.place && <span className="text-xs text-muted" dir="auto">{tasting.place}</span>}
                {tasting.notes && <span dir="auto">{tasting.notes}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
