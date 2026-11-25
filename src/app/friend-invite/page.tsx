import type { Metadata } from "next";
import { AcceptFriend } from "./accept-friend";

export const metadata: Metadata = { title: "הזמנה לחברות · מרתף יין" };

export default function FriendInvitePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-12">
      <div className="flex w-full max-w-sm flex-col items-center gap-5 text-center">
        <div className="text-5xl" aria-hidden="true">🥂</div>
        <h1 className="text-2xl font-bold">הזמנה לחברות</h1>
        <AcceptFriend />
      </div>
    </main>
  );
}
