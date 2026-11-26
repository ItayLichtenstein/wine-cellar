import { redirect } from "next/navigation";
import { Suspense } from "react";
import { BackLink } from "@/components/back-link";
import { pageTitle } from "@/i18n/metadata";
import { getLocale, getT } from "@/i18n/server";
import { intlTag } from "@/i18n/locales";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ImportFlow } from "./import-flow";
import { UndoImport } from "./undo-import";

export const generateMetadata = pageTitle((t) => t.titles.importer);

/** Import from a file (spec: "ייבוא מקובץ"). The file is read in the browser; see import-flow.tsx. */
export default async function ImportPage({ searchParams }: { searchParams: Promise<{ undone?: string }> }) {
  const t = await getT();
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-1">
        <BackLink href="/settings" label={t.settings.title} />
        <h1 className="text-2xl font-bold">{t.importer.title}</h1>
        <p className="text-muted">{t.importer.intro}</p>
      </header>
      <Suspense fallback={<p className="text-muted">{t.common.loading}</p>}>
        <WithData searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

async function WithData({ searchParams }: { searchParams: Promise<{ undone?: string }> }) {
  const [user, locale, { undone }] = await Promise.all([getCurrentUser(), getLocale(), searchParams]);
  const t = await getT();
  const undoneCount = Number(undone);
  if (!user.canEdit) redirect("/");
  const supabase = await createClient();
  const [bottles, wines, imports, fridges] = await Promise.all([
    supabase.from("bottles").select("id", { count: "exact", head: true }).eq("cellar_id", user.cellarId).neq("status", "consumed"),
    supabase.from("wines").select("winery, name").eq("cellar_id", user.cellarId),
    supabase
      .from("imports")
      .select("file_hash, bottles, created_at, undone_at")
      .eq("cellar_id", user.cellarId)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase.from("fridges").select("id", { count: "exact", head: true }).eq("cellar_id", user.cellarId),
  ]);

  const list = imports.data ?? [];
  const last = list.find((i) => !i.undone_at);
  // eslint-disable-next-line react-hooks/purity -- a request-time check, not render logic that must be pure
  const undoable = last && Date.now() - new Date(last.created_at).getTime() < WEEK_MS ? last : null;

  return (
    <>
      {Number.isInteger(undoneCount) && undoneCount >= 0 && (
        <p role="status" className="rounded-xl bg-surface p-3 text-sm shadow-sm">
          ✓ {t.importer.undone(undoneCount)}
        </p>
      )}
      <ImportFlow
        bottlesInCellar={bottles.count ?? 0}
        hasFridge={(fridges.count ?? 0) > 0}
        wineKeys={(wines.data ?? []).map((w) => `${w.winery.toLowerCase()}\u0000${w.name.toLowerCase()}`)}
        importedHashes={list.filter((i) => !i.undone_at && i.file_hash).map((i) => i.file_hash as string)}
      />
      {undoable && (
        <UndoImport
          bottles={undoable.bottles}
          date={new Date(undoable.created_at).toLocaleDateString(intlTag(locale), { day: "numeric", month: "long" })}
        />
      )}
    </>
  );
}
