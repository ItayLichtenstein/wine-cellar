import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BackLink } from "@/components/back-link";
import { ThemePicker } from "@/components/more-sheet";
import { getCurrentUser } from "@/lib/auth";
import { DeleteAccount } from "./delete-account";
import { ExportButton } from "./export-button";
import { MyName } from "./my-name";
import { SignOutButton } from "./sign-out-button";

export const metadata: Metadata = { title: "הגדרות · מרתף יין" };

/** Personal settings: my name, look, my data, account. Language will join here. */
export default function SettingsPage() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-1">
        <BackLink href="/" label="המקרר" />
        <h1 className="text-2xl font-bold">הגדרות</h1>
      </header>
      <Suspense fallback={<p className="text-muted">טוען…</p>}>
        <Settings />
      </Suspense>
    </main>
  );
}

async function Settings() {
  const user = await getCurrentUser();
  return (
    <>
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">השם שלי</h2>
        <MyName userId={user.id} initial={user.displayName} />
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">מראה</h2>
        <ThemePicker heading={false} />
      </section>
      <section className="flex flex-col items-start gap-2">
        <h2 className="text-lg font-semibold">הנתונים שלי</h2>
        <ExportButton cellarId={user.cellarId} />
        <Link href="/privacy" className="text-sm text-muted underline underline-offset-2">
          מדיניות הפרטיות
        </Link>
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">חשבון</h2>
        <div>
          <SignOutButton />
        </div>
        <DeleteAccount cellarId={user.cellarId} />
      </section>
    </>
  );
}
