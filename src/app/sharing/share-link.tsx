"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useT } from "@/i18n/provider";
import { createClient } from "@/lib/supabase/client";
import { LinkBox } from "./link-box";

/**
 * A view link for people without an account. Only its hash is stored, so
 * the link is shown once; "new link" replaces it (the old one stops working).
 */
export function ShareLink({ active }: { active: { hidePrices: boolean } | null }) {
  const router = useRouter();
  const s = useT().sharing;
  const [hidePrices, setHidePrices] = useState(active?.hidePrices ?? true);
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setError(null);
    const { data, error: e } = await createClient().rpc("create_share_link", { p_hide_prices: hidePrices });
    if (e || !data) return setError(s.linkFailed);
    setLink(`${window.location.origin}/shared#${data}`);
    router.refresh();
  }

  async function revoke() {
    setError(null);
    const { error: e } = await createClient().rpc("revoke_share_link");
    if (e) return setError(s.revokeFailed);
    setLink(null);
    router.refresh();
  }

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold">{s.viewTitle}</h2>
      <p className="text-sm text-muted">
        <span className="inline-block">{s.viewIntro[0]}</span> <span className="inline-block">{s.viewIntro[1]}</span>
      </p>
      <div className="flex flex-col gap-3 rounded-xl bg-surface p-3 text-sm shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={create} className="rounded-full bg-accent px-4 py-2 font-medium text-white dark:text-black">
            {active ? s.newView : s.createView}
          </button>
          {active && (
            <button type="button" onClick={revoke} className="text-muted underline underline-offset-2">
              {s.revokeView}
            </button>
          )}
        </div>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={hidePrices} onChange={(e) => setHidePrices(e.target.checked)} className="size-4 accent-accent" />
          {s.hidePrices}
        </label>
        {active && !link && (
          <p className="text-muted">
            <span className="inline-block">{s.activeView[0]}</span> <span className="inline-block">{s.activeView[1]}</span>
          </p>
        )}
        {link && (
          <>
            <p className="text-muted">
              <span className="inline-block">{s.shownOnce[0]}</span> <span className="inline-block">{s.shownOnce[1]}</span>
            </p>
            <LinkBox link={link} label={s.viewLinkLabel} />
          </>
        )}
        {error && <p className="text-red-700 dark:text-red-400">{error}</p>}
      </div>
    </section>
  );
}
