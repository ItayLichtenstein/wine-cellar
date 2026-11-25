import type { Metadata } from "next";
import { BackLink } from "@/components/back-link";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth";
import { getWineNames } from "@/lib/fridges";
import { OutsideTastingForm } from "./outside-tasting-form";

export const metadata: Metadata = { title: "שתינו מחוץ לבית · מרתף יין" };

export default function NewTastingPage() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-1">
        <BackLink href="/history" label="היסטוריה ודירוגים" />
        <h1 className="text-2xl font-bold">שתינו מחוץ לבית</h1>
        <p className="text-sm text-muted">במסעדה, אצל חברים – יין שלא היה במרתף.</p>
      </header>
      <Suspense fallback={<p className="text-muted">טוען…</p>}>
        <FormWithData />
      </Suspense>
    </main>
  );
}

async function FormWithData() {
  const { cellarId } = await getCurrentUser();
  return <OutsideTastingForm wines={await getWineNames(cellarId)} />;
}
