import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth";
import { SignOutButton } from "./sign-out-button";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-3xl font-bold">מרתף יין</h1>
      {/* Reads the session, so it streams in behind a Suspense boundary. */}
      <Suspense fallback={<p className="text-muted">טוען…</p>}>
        <Greeting />
      </Suspense>
    </main>
  );
}

async function Greeting() {
  const user = await getCurrentUser();
  return (
    <>
      <p className="text-muted">שלום {user.displayName}! בקרוב: המקררים והבקבוקים שלכם.</p>
      <SignOutButton />
    </>
  );
}
