import type { Metadata } from "next";
import { getT } from "@/i18n/server";
import { BackLink } from "@/components/back-link";
import { getCurrentUser } from "@/lib/auth";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getFridges } from "@/lib/fridges";
import { NewFridgeForm } from "../../new/new-fridge-form";

export const metadata: Metadata = { title: "עריכת מקרר · מרתף יין" };

export default async function EditFridgePage({ params }: PageProps<"/fridges/[id]/edit">) {
  const t = await getT();
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-1">
        <BackLink href="/fridges" label={t.fridgeSetup.listTitle} />
        <h1 className="text-2xl font-bold">{t.fridgeSetup.editTitle}</h1>
        <p className="text-muted">
          <span className="inline-block">{t.fridgeSetup.editIntro[0]}</span>{" "}
          <span className="inline-block">{t.fridgeSetup.editIntro[1]}</span>
        </p>
      </header>
      <Suspense fallback={<p className="text-muted">{t.common.loading}</p>}>
        <FormWithData params={params} />
      </Suspense>
    </main>
  );
}

async function FormWithData({ params }: { params: PageProps<"/fridges/[id]/edit">["params"] }) {
  const { id } = await params;
  // Only the user's own fridges are loaded, so a foreign id is "not found".
  const { cellarId } = await getCurrentUser();
  const fridge = (await getFridges(cellarId)).find((f) => f.id === id);
  if (!fridge) notFound();
  return <NewFridgeForm existing={fridge} />;
}
