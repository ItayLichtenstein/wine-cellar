import { pageTitle } from "@/i18n/metadata";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getT } from "@/i18n/server";
import { aiDisplayName } from "@/lib/ai-providers";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ConsentButtons } from "./consent-buttons";
import { SwitchAccount } from "./switch-account";

export const generateMetadata = pageTitle((t) => t.titles.consent);

/**
 * The consent screen of our OAuth server (Supabase Auth's OAuth 2.1 server,
 * stage 7). An AI client (Claude, Gemini…) asks to act on the user's
 * behalf; the user approves here. Supabase handles the protocol; we only
 * show who is asking, which account it gets, and pass the decision on.
 */
export default async function ConsentPage({ searchParams }: PageProps<"/oauth/consent">) {
  const t = await getT();
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-12">
      <div className="flex w-full max-w-sm flex-col items-center gap-5 text-center">
        <div className="text-5xl" aria-hidden="true">🔗</div>
        <Suspense fallback={<p className="text-muted">{t.consent.wait}</p>}>
          <Consent searchParams={searchParams} />
        </Suspense>
      </div>
    </main>
  );
}

async function Consent({ searchParams }: { searchParams: PageProps<"/oauth/consent">["searchParams"] }) {
  const [{ authorization_id: id }, { consent: c }] = await Promise.all([searchParams, getT()]);
  if (typeof id !== "string" || !/^[\w-]{1,100}$/.test(id)) return <p className="text-muted">{c.incomplete}</p>;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.oauth.getAuthorizationDetails(id);
  if (error || !data) return <p className="text-muted">{c.invalid}</p>;
  // Approved before: Supabase sends the user straight back to the client.
  if (!("authorization_id" in data)) redirect(data.redirect_url);
  // Which account the AI gets: the one signed in to the site in this browser,
  // which is easy to miss with two accounts (a tester connected the wrong one).
  const user = await getCurrentUser();

  return (
    <>
      <h1 className="text-2xl font-bold">{c.asks(data.client.name ? aiDisplayName(data.client.name) : c.anApp)}</h1>
      <p className="text-sm">{c.canRead}</p>
      {user.displayName && (
        <div className="flex flex-col items-center gap-1 rounded-xl bg-surface px-4 py-3 text-sm shadow-sm">
          <span className="font-medium">{c.account(user.displayName)}</span>
          <SwitchAccount />
        </div>
      )}
      <ConsentButtons authorizationId={data.authorization_id} clientId={data.client.id} />
      <p className="text-xs text-muted">{c.disconnect}</p>
    </>
  );
}
