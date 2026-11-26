import { pageTitle } from "@/i18n/metadata";
import { getLocale, getT } from "@/i18n/server";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth";
import { getCellarBottles } from "@/lib/fridges";
import { BottleList } from "./bottle-list";

export const generateMetadata = pageTitle((t) => t.titles.list);

export default async function BottlesPage() {
  const t = await getT();
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 px-4 py-8">
      <h1 className="text-2xl font-bold">{t.list.title}</h1>
      <Suspense fallback={<p className="text-muted">{t.common.loading}</p>}>
        <ListWithData />
      </Suspense>
    </main>
  );
}

async function ListWithData() {
  const [{ cellarId }, locale] = await Promise.all([getCurrentUser(), getLocale()]);
  return <BottleList bottles={await getCellarBottles(cellarId, undefined, locale)} />;
}
