import type { Metadata } from "next";
import { getT } from "@/i18n/server";
import { BackLink } from "@/components/back-link";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth";
import { getWineNames } from "@/lib/fridges";
import { OutsideTastingForm } from "./outside-tasting-form";

export const metadata: Metadata = { title: "הוספת דירוג · מרתף יין" };

export default async function NewTastingPage() {
  const t = await getT();
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-1">
        <BackLink href="/history" label={t.history.title} />
        <h1 className="text-2xl font-bold">{t.history.newTitle}</h1>
        <p className="text-sm text-muted">
          <span className="inline-block">{t.history.newIntro[0]}</span>{" "}
          <span className="inline-block">{t.history.newIntro[1]}</span>
        </p>
      </header>
      <Suspense fallback={<p className="text-muted">{t.common.loading}</p>}>
        <FormWithData />
      </Suspense>
    </main>
  );
}

async function FormWithData() {
  const { cellarId } = await getCurrentUser();
  return <OutsideTastingForm wines={await getWineNames(cellarId)} />;
}
