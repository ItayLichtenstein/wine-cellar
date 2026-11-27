import { Suspense } from "react";
import { pageTitle } from "@/i18n/metadata";
import { getT } from "@/i18n/server";
import { BackLink } from "@/components/back-link";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { LabelPhoto } from "@/app/bottle/label-photo";

export const generateMetadata = pageTitle((t) => t.titles.labels);

/**
 * Label photos in one place: every wine in the cellar without a photo (one
 * tap each to take it), then the photos an AI found on the web, which may be
 * another vintage, so the user can replace them with their own.
 */
export default async function LabelsPage() {
  const t = await getT();
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 px-4 py-6">
      <BackLink href="/" label={t.guide.back} />
      <h1 className="text-2xl font-bold">{t.labels.title}</h1>
      <p className="text-muted">
        <span className="inline-block">{t.labels.intro[0]}</span> <span className="inline-block">{t.labels.intro[1]}</span>
      </p>
      <Suspense fallback={<p className="text-muted">{t.common.loading}</p>}>
        <Lists />
      </Suspense>
    </main>
  );
}

type Wine = { id: string; winery: string; name: string; path: string | null };

async function Lists() {
  const [supabase, user, t] = await Promise.all([createClient(), getCurrentUser(), getT()]);
  // Wines with a bottle still in the cellar (not only drunk ones).
  const { data } = await supabase
    .from("wines")
    .select("id, winery, name, label_image_path, wine_vintages!inner(bottles!inner(status))")
    .eq("cellar_id", user.cellarId)
    .neq("wine_vintages.bottles.status", "consumed")
    .order("winery")
    .order("name");
  const wines: Wine[] = (data ?? []).map((w) => ({ id: w.id, winery: w.winery, name: w.name, path: w.label_image_path }));
  if (wines.length === 0) return <p className="text-muted">{t.labels.empty}</p>;

  const missing = wines.filter((w) => !w.path);
  const fromWeb = wines.filter((w) => w.path?.includes("/web-"));
  return (
    <>
      {missing.length === 0 ? (
        <p className="rounded-xl bg-surface p-4 text-center shadow-sm">{t.labels.allDone}</p>
      ) : (
        <Section title={t.labels.missing(missing.length)} wines={missing} cellarId={user.cellarId} canEdit={user.canEdit} />
      )}
      {fromWeb.length > 0 && (
        <Section title={t.labels.fromWeb(fromWeb.length)} hint={t.labels.fromWebHint} wines={fromWeb} cellarId={user.cellarId} canEdit={user.canEdit} />
      )}
    </>
  );
}

function Section({ title, hint, wines, cellarId, canEdit }: { title: string; hint?: string; wines: Wine[]; cellarId: string; canEdit: boolean }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold">{title}</h2>
      {hint && <p className="text-sm text-muted">{hint}</p>}
      <ul className="flex flex-col divide-y divide-muted/20 rounded-xl bg-surface px-4 shadow-sm">
        {wines.map((w) => (
          <li key={w.id} className="flex flex-col gap-2 py-3">
            <span className="font-medium" dir="auto">
              {w.winery} – {w.name}
            </span>
            <LabelPhoto wineId={w.id} cellarId={cellarId} path={w.path} canEdit={canEdit} />
          </li>
        ))}
      </ul>
    </section>
  );
}
