import type { Metadata } from "next";
import { getT } from "@/i18n/server";
import { SharedView } from "./shared-view";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  // A private link: keep it out of search engines.
  return { title: t.titles.app, robots: { index: false, follow: false } };
}

export default function SharedPage() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-8">
      <SharedView />
    </main>
  );
}
