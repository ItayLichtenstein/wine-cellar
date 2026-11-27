"use client";

import { useLocale, useT } from "@/i18n/provider";
import { intlTag } from "@/i18n/locales";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ConnectedAi } from "@/lib/ai-grants";
import { createClient } from "@/lib/supabase/client";


/**
 * AI assistants the user approved on the consent screen. Disconnecting
 * revokes the grant: Supabase ends that client's sessions and refresh tokens.
 */
export function ConnectedAis({ ais }: { ais: ConnectedAi[] }) {
  const router = useRouter();
  const a = useT().ai;
  const dateFormat = new Intl.DateTimeFormat(intlTag(useLocale()), { day: "numeric", month: "long", year: "numeric" });
  const [failed, setFailed] = useState(false);

  // "Makes changes itself" on or off: a row the database guard reads.
  async function setEdit(clientId: string, on: boolean) {
    setFailed(false);
    const grants = createClient().from("ai_edit_grants");
    const { error } = on ? await grants.insert({ client_id: clientId }) : await grants.delete().eq("client_id", clientId);
    if (error) return setFailed(true);
    router.refresh();
  }

  async function disconnect(clientId: string) {
    setFailed(false);
    const supabase = createClient();
    const { error } = await supabase.auth.oauth.revokeGrant({ clientId });
    if (error) return setFailed(true);
    // Reconnecting asks again what it may change.
    await supabase.from("ai_edit_grants").delete().eq("client_id", clientId);
    router.refresh();
  }

  return (
    <>
      <ul className="flex flex-col divide-y divide-muted/20 rounded-xl bg-surface shadow-sm">
        {ais.map((g) => (
          <li key={g.clientId} className="flex items-center justify-between gap-2 px-4 py-3">
            <span className="flex flex-col">
              <span dir="auto" className="font-medium">
                {g.name}
              </span>
              <span className="text-xs text-muted">{a.connectedSince(dateFormat.format(new Date(g.since)))}</span>
              <label className="mt-1 flex cursor-pointer items-center gap-2 text-sm">
                <input type="checkbox" checked={g.canEdit} onChange={(e) => setEdit(g.clientId, e.target.checked)} className="size-4 accent-[var(--accent)]" />
                {a.editSelfSwitch}
              </label>
            </span>
            <button type="button" onClick={() => disconnect(g.clientId)} className="text-sm text-muted underline underline-offset-2">
              {a.disconnect}
            </button>
          </li>
        ))}
      </ul>
      {failed && <p className="text-sm text-red-700 dark:text-red-400">{a.disconnectFailed}</p>}
    </>
  );
}
