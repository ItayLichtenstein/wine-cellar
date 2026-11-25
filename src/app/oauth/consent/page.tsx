import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { ConsentButtons } from "./consent-buttons";

export const metadata: Metadata = { title: "חיבור AI · מרתף יין" };

/**
 * The consent screen of our OAuth server (Supabase Auth's OAuth 2.1 server,
 * stage 7). An AI client (Claude, ChatGPT…) asks to act on the user's
 * behalf; the user approves here. Supabase handles the protocol; we only
 * show who is asking and pass the decision on.
 */
export default function ConsentPage({ searchParams }: PageProps<"/oauth/consent">) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-12">
      <div className="flex w-full max-w-sm flex-col items-center gap-5 text-center">
        <div className="text-5xl" aria-hidden="true">🔗</div>
        <Suspense fallback={<p className="text-muted">רגע…</p>}>
          <Consent searchParams={searchParams} />
        </Suspense>
      </div>
    </main>
  );
}

async function Consent({ searchParams }: { searchParams: PageProps<"/oauth/consent">["searchParams"] }) {
  const { authorization_id: id } = await searchParams;
  if (typeof id !== "string" || !/^[\w-]{1,100}$/.test(id)) return <p className="text-muted">הבקשה לא שלמה. נסו לחבר שוב מה־AI.</p>;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.oauth.getAuthorizationDetails(id);
  if (error || !data) return <p className="text-muted">הבקשה לא תקפה או שפג תוקפה. נסו לחבר שוב מה־AI.</p>;
  // Approved before: Supabase sends the user straight back to the client.
  if (!("authorization_id" in data)) redirect(data.redirect_url);

  return (
    <>
      <h1 className="text-2xl font-bold">
        <span className="inline-block" dir="auto">{data.client.name || "אפליקציה"}</span>{" "}
        <span className="inline-block">מבקשת גישה למרתף</span>
      </h1>
      <ul className="flex flex-col gap-1 text-start text-sm">
        <li>✓ לקרוא את המרתף שלכם: בקבוקים, ציונים, היסטוריה.</li>
        <li>✓ להציע בקבוקים חדשים, כטיוטות שמחכות לאישור שלכם.</li>
        <li>✗ לא יכולה למחוק, לשנות או להוסיף בעצמה.</li>
      </ul>
      <p className="text-xs text-muted">
        <span className="inline-block">אפשר לנתק בכל רגע מעמוד הבינה המלאכותית באתר.</span>{" "}
        <span className="inline-block" dir="ltr">{new URL(data.redirect_uri).host}</span>
      </p>
      <ConsentButtons authorizationId={data.authorization_id} />
    </>
  );
}
