import type { Metadata } from "next";
import { JoinInvite } from "./join-invite";

export const metadata: Metadata = { title: "הצטרפות למרתף · מרתף יין" };

export default function JoinPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-12">
      <div className="flex w-full max-w-sm flex-col items-center gap-5 text-center">
        <div className="text-5xl" aria-hidden="true">🍷</div>
        <h1 className="text-2xl font-bold">הוזמנת למרתף משותף</h1>
        <JoinInvite />
      </div>
    </main>
  );
}
