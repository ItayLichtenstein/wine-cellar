import type { Metadata } from "next";
import { AcceptFriend } from "./accept-friend";

export const metadata: Metadata = { title: "הזמנה לחברות · מרתף יין" };

export default function FriendInvitePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-12">
      <div className="flex w-full max-w-sm flex-col items-center gap-5 text-center">
        <AcceptFriend />
      </div>
    </main>
  );
}
