import type { Metadata } from "next";
import { BackLink } from "@/components/back-link";
import { getCurrentUser } from "@/lib/auth";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getFridges } from "@/lib/fridges";
import { NewFridgeForm } from "../../new/new-fridge-form";

export const metadata: Metadata = { title: "עריכת מקרר · מרתף יין" };

export default function EditFridgePage({ params }: PageProps<"/fridges/[id]/edit">) {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-1">
        <BackLink href="/" label="המקרר" />
        <h1 className="text-2xl font-bold">עריכת מקרר</h1>
        <p className="text-muted">
          <span className="inline-block">מקומות שנשארים – הבקבוקים שבהם נשארים.</span>{" "}
          <span className="inline-block">מקום שנמחק – הבקבוק עובר ל״מחוץ למקרר״.</span>
        </p>
      </header>
      <Suspense fallback={<p className="text-muted">טוען…</p>}>
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
