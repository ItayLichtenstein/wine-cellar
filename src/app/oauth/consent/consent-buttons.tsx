"use client";

import { useState } from "react";
import { useT } from "@/i18n/provider";
import { createClient } from "@/lib/supabase/client";

/**
 * The user's answer: approve (and choose what the AI may change, ADR 0013)
 * or not now. "Makes changes itself" is a row in ai_edit_grants, which the
 * database guard reads; "only suggests" removes it.
 */
export function ConsentButtons({ authorizationId, clientId }: { authorizationId: string; clientId: string }) {
  const c = useT().consent;
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [editSelf, setEditSelf] = useState(true);

  async function decide(approve: boolean) {
    setBusy(true);
    setFailed(false);
    const supabase = createClient();
    if (approve) {
      const grants = supabase.from("ai_edit_grants");
      const { error: grantError } = editSelf
        ? await grants.upsert({ client_id: clientId }, { onConflict: "user_id,client_id", ignoreDuplicates: true })
        : await grants.delete().eq("client_id", clientId);
      if (grantError) {
        setBusy(false);
        setFailed(true);
        return;
      }
    }
    const oauth = supabase.auth.oauth;
    const { data, error } = approve ? await oauth.approveAuthorization(authorizationId) : await oauth.denyAuthorization(authorizationId);
    if (error || !data) {
      setBusy(false);
      setFailed(true);
      return;
    }
    // Back to the AI client (Supabase built this URL from the registered redirect).
    window.location.assign(data.redirect_url);
  }

  const option = (value: boolean, title: string, text: string) => (
    <label className={`flex cursor-pointer gap-3 rounded-xl border-2 p-3 text-start ${editSelf === value ? "border-accent" : "border-muted/30"}`}>
      <input type="radio" name="mode" checked={editSelf === value} onChange={() => setEditSelf(value)} className="mt-1 accent-[var(--accent)]" />
      <span className="flex flex-col">
        <span className="font-medium">{title}</span>
        <span className="text-sm text-muted">{text}</span>
      </span>
    </label>
  );

  return (
    <div className="flex w-full flex-col gap-4">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 font-semibold">{c.howTitle}</legend>
        {option(true, c.editSelf, c.editSelfText)}
        {option(false, c.suggestOnly, c.suggestOnlyText)}
      </fieldset>
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => decide(true)}
          disabled={busy}
          className="rounded-full bg-accent px-5 py-3 font-medium text-white disabled:opacity-60 dark:text-black"
        >
          {c.approve}
        </button>
        <button type="button" onClick={() => decide(false)} disabled={busy} className="rounded-full border border-muted/40 px-5 py-3">
          {c.notNow}
        </button>
      </div>
      {failed && <p className="text-sm text-red-700 dark:text-red-400">{c.failed}</p>}
    </div>
  );
}
