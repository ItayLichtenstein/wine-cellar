import { pageTitle } from "@/i18n/metadata";
import Link from "next/link";
import { Suspense } from "react";
import { BackLink } from "@/components/back-link";
import { ThemePicker } from "@/components/more-sheet";
import { LanguagePicker } from "@/i18n/language-picker";
import { getT } from "@/i18n/server";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DeleteAccount } from "./delete-account";
import { ExportButton } from "./export-button";
import { MyName } from "./my-name";
import { SignOutButton } from "./sign-out-button";

export const generateMetadata = pageTitle((t) => t.titles.settings);

/** Personal settings: my name, look, language, my data, account. */
export default async function SettingsPage() {
  const t = await getT();
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-1">
        <BackLink href="/" label={t.settings.back} />
        <h1 className="text-2xl font-bold">{t.settings.title}</h1>
      </header>
      <Suspense fallback={<p className="text-muted">{t.settings.loading}</p>}>
        <Settings />
      </Suspense>
    </main>
  );
}

async function Settings() {
  const supabase = await createClient();
  const [user, t, { data: isAdmin }] = await Promise.all([getCurrentUser(), getT(), supabase.rpc("is_app_admin")]);
  return (
    <>
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">{t.settings.myName}</h2>
        <MyName userId={user.id} initial={user.displayName} />
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">{t.settings.look}</h2>
        <ThemePicker heading={false} />
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">{t.settings.language}</h2>
        <LanguagePicker />
      </section>
      <section className="flex flex-col items-start gap-2">
        <h2 className="text-lg font-semibold">{t.settings.myData}</h2>
        <ExportButton cellarId={user.cellarId} />
        {user.canEdit && (
          <Link href="/import" className="rounded-full border border-muted/40 px-4 py-2 text-sm">
            {t.importer.fromSettings}
          </Link>
        )}
        <Link href="/privacy" className="text-sm text-muted underline underline-offset-2">
          {t.settings.privacy}
        </Link>
        <Link href="/terms" className="text-sm text-muted underline underline-offset-2">
          {t.settings.terms}
        </Link>
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">{t.settings.account}</h2>
        <div>
          <SignOutButton />
        </div>
        <DeleteAccount cellarId={user.cellarId} />
      </section>
      {isAdmin && (
        <section className="flex flex-col items-start gap-2">
          <h2 className="text-lg font-semibold">{t.admin.title}</h2>
          <Link href="/admin" className="rounded-full border border-muted/40 px-4 py-2 text-sm">
            {t.admin.fromSettings}
          </Link>
        </section>
      )}
    </>
  );
}
