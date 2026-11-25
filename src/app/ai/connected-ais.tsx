"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Grant = { clientId: string; name: string; since: string };

const dateFormat = new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "long", year: "numeric" });

/**
 * AI assistants the user approved on the consent screen. Disconnecting
 * revokes the grant: Supabase ends that client's sessions and refresh tokens.
 */
export function ConnectedAis() {
  const [grants, setGrants] = useState<Grant[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    createClient()
      .auth.oauth.listGrants()
      .then(({ data, error }) => {
        // No OAuth server on this project yet: just show nothing.
        if (error || !data) return setGrants([]);
        setGrants(data.map((g) => ({ clientId: g.client.id, name: g.client.name || "AI", since: g.granted_at })));
      });
  }, []);

  async function disconnect(clientId: string) {
    setFailed(false);
    const { error } = await createClient().auth.oauth.revokeGrant({ clientId });
    if (error) return setFailed(true);
    setGrants((g) => g?.filter((x) => x.clientId !== clientId) ?? null);
  }

  if (!grants || grants.length === 0) return null;
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold">מחוברים למרתף</h2>
      <ul className="flex flex-col divide-y divide-muted/20 rounded-xl bg-surface shadow-sm">
        {grants.map((g) => (
          <li key={g.clientId} className="flex items-center justify-between gap-2 px-4 py-3">
            <span className="flex flex-col">
              <span dir="auto">{g.name}</span>
              <span className="text-xs text-muted">מ־{dateFormat.format(new Date(g.since))} · קריאה והצעת טיוטות</span>
            </span>
            <button type="button" onClick={() => disconnect(g.clientId)} className="text-sm text-muted underline underline-offset-2">
              ניתוק
            </button>
          </li>
        ))}
      </ul>
      {failed && <p className="text-sm text-red-700 dark:text-red-400">הניתוק לא הצליח. נסו שוב.</p>}
    </section>
  );
}
