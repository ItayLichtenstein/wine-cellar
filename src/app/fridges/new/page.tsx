import type { Metadata } from "next";
import { getT } from "@/i18n/server";
import { BackLink } from "@/components/back-link";
import { NewFridgeForm } from "./new-fridge-form";

export const metadata: Metadata = { title: "מקרר חדש · מרתף יין" };

export default async function NewFridgePage() {
  const t = await getT();
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-1">
        <BackLink href="/" label={t.friends.toMine} />
        <h1 className="text-2xl font-bold">{t.fridgeSetup.newTitle}</h1>
        <p className="text-muted">{t.fridgeSetup.newIntro}</p>
      </header>
      <NewFridgeForm />
    </main>
  );
}
