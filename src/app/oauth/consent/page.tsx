import { pageTitle } from "@/i18n/metadata";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getT } from "@/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { ConsentButtons } from "./consent-buttons";

export const generateMetadata = pageTitle((t) => t.titles.consent);

/**
 * The consent screen of our OAuth server (Supabase Auth's OAuth 2.1 server,
 * stage 7). An AI client (Claude, ChatGPT…) asks to act on the user's
 * behalf; the user approves here. Supabase handles the protocol; we only
 * show who is asking and pass the decision on.
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

  return (
    <>
      <h1 className="text-2xl font-bold">
        <span className="inline-block" dir="auto">{data.client.name || c.anApp}</span>{" "}
        <span className="inline-block">{c.asks}</span>
      </h1>
      <ul className="flex flex-col gap-1 text-start text-sm">
        <li>{c.canRead}</li>
        <li>{c.canSuggest}</li>
        <li>{c.cannot}</li>
      </ul>
      <p className="text-xs text-muted">
        <span className="inline-block">{c.disconnect}</span>{" "}
        <span className="inline-block" dir="ltr">{new URL(data.redirect_uri).host}</span>
      </p>
      <ConsentButtons authorizationId={data.authorization_id} />
    </>
  );
}
