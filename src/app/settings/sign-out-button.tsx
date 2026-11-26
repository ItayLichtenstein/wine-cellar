"use client";

import { useState } from "react";
import { useT } from "@/i18n/provider";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const t = useT();
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    await createClient().auth.signOut();
    // A full reload on purpose (not router.push): on a shared device nothing
    // from the signed-in session may stay in the page's memory.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/login");
  }

  return (
    <button
      type="button"
      onClick={signOut}
      disabled={busy}
      className="rounded-full border border-muted/40 px-4 py-2 text-sm disabled:opacity-60"
    >
      {busy ? t.account.signingOut : t.account.signOut}
    </button>
  );
}
