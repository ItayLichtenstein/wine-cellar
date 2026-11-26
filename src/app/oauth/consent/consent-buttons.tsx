"use client";

import { useState } from "react";
import { useT } from "@/i18n/provider";
import { createClient } from "@/lib/supabase/client";

export function ConsentButtons({ authorizationId }: { authorizationId: string }) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function decide(approve: boolean) {
    setBusy(true);
    setFailed(false);
    const oauth = createClient().auth.oauth;
    const { data, error } = approve ? await oauth.approveAuthorization(authorizationId) : await oauth.denyAuthorization(authorizationId);
    if (error || !data) {
      setBusy(false);
      setFailed(true);
      return;
    }
    // Back to the AI client (Supabase built this URL from the registered redirect).
    window.location.assign(data.redirect_url);
  }

  return (
    <div className="flex w-full flex-col gap-2">
      <button
        type="button"
        onClick={() => decide(true)}
        disabled={busy}
        className="rounded-full bg-accent px-5 py-3 font-medium text-white disabled:opacity-60 dark:text-black"
      >
        {t.consent.approve}
      </button>
      <button type="button" onClick={() => decide(false)} disabled={busy} className="rounded-full border border-muted/40 px-5 py-3">
        {t.consent.notNow}
      </button>
      {failed && <p className="text-sm text-red-700 dark:text-red-400">{t.consent.failed}</p>}
    </div>
  );
}
