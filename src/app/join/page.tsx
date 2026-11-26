import type { Metadata } from "next";
import { getT } from "@/i18n/server";
import { JoinInvite } from "./join-invite";

export const metadata: Metadata = { title: "הצטרפות למרתף · מרתף יין" };

export default async function JoinPage() {
  const t = await getT();
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-12">
      <div className="flex w-full max-w-sm flex-col items-center gap-5 text-center">
        <div className="text-5xl" aria-hidden="true">🍷</div>
        <h1 className="text-2xl font-bold">{t.join.title}</h1>
        <JoinInvite />
      </div>
    </main>
  );
}
