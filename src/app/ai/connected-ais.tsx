"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ConnectedAi } from "@/lib/ai-grants";
import { createClient } from "@/lib/supabase/client";

const dateFormat = new Intl.DateTimeFormat("he-IL", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

/**
 * AI assistants the user approved on the consent screen. Disconnecting
 * revokes the grant: Supabase ends that client's sessions and refresh tokens.
 */
export function ConnectedAis({ ais }: { ais: ConnectedAi[] }) {
  const router = useRouter();
  const [failed, setFailed] = useState(false);

  async function disconnect(clientId: string) {
    setFailed(false);
    const { error } = await createClient().auth.oauth.revokeGrant({ clientId });
    if (error) return setFailed(true);
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
              <span className="text-xs text-muted">מחובר מ־{dateFormat.format(new Date(g.since))} · רואה את המרתף ומציע בקבוקים</span>
            </span>
            <button type="button" onClick={() => disconnect(g.clientId)} className="text-sm text-muted underline underline-offset-2">
              ניתוק
            </button>
          </li>
        ))}
      </ul>
      {failed && <p className="text-sm text-red-700 dark:text-red-400">הניתוק לא הצליח. נסו שוב.</p>}
    </>
  );
}
