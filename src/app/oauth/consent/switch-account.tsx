"use client";

import { useState } from "react";
import { useT } from "@/i18n/provider";
import { createClient } from "@/lib/supabase/client";

/**
 * The consent screen connects whoever is signed in to the site in this
 * browser. If that is the wrong account (a second Google account, a test
 * user), sign out here and come back to the same request after signing in.
 */
export function SwitchAccount() {
  const c = useT().consent;
  const [busy, setBusy] = useState(false);

  async function switchAccount() {
    setBusy(true);
    // This device only: "global" would also end the user's other AI connections.
    await createClient().auth.signOut({ scope: "local" });
    const back = window.location.pathname + window.location.search;
    // A full reload, so nothing of the old account stays in memory.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign(`/login?next=${encodeURIComponent(back)}`);
  }

  return (
    <button type="button" onClick={switchAccount} disabled={busy} className="text-sm text-muted underline underline-offset-2 disabled:opacity-60">
      {c.switchAccount}
    </button>
  );
}
