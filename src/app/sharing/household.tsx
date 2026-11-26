"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useT } from "@/i18n/provider";
import { createClient } from "@/lib/supabase/client";
import { LinkBox } from "./link-box";

export type Member = { userId: string; name: string };

/**
 * The cellar's partners: who's in, invite a new one, remove one, leave.
 * Every partner has the same rights (no "viewer" level since 26 Nov 2026).
 */
export function Household({ members, me }: { members: Member[]; me: string }) {
  const router = useRouter();
  const s = useT().sharing;
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);

  async function call(fn: () => PromiseLike<{ error: { hint?: string } | null }>, ok: () => void) {
    setError(null);
    const { error: e } = await fn();
    if (!e) return ok();
    setError(e.hint === "last_member" ? s.lastMember : e.hint === "alone" ? s.alone : s.failed);
  }

  async function invite() {
    const { data, error: e } = await createClient().rpc("create_invite");
    if (e || !data) return setError(s.linkFailed);
    // The token goes after "#": browsers never send that part to a server.
    setLink(`${window.location.origin}/join#${data}`);
  }

  return (
    <section id="household" className="flex scroll-mt-4 flex-col gap-2">
      <h3 className="font-semibold">{s.whoIn}</h3>
      <ul className="flex flex-col divide-y divide-muted/20 rounded-xl bg-surface shadow-sm">
        {members.map((m) => (
          <li key={m.userId} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
            <span dir="auto">
              {m.name}
              {m.userId === me && <span className="text-muted"> {s.you}</span>}
            </span>
            {m.userId !== me && (
              <button
                type="button"
                onClick={() => call(() => createClient().rpc("remove_member", { p_user_id: m.userId }), () => router.refresh())}
                className="text-sm text-muted underline underline-offset-2"
              >
                {s.remove}
              </button>
            )}
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-3 rounded-xl bg-surface p-3 text-sm shadow-sm">
        <button type="button" onClick={invite} className="self-start rounded-full bg-accent px-4 py-2 font-medium text-white dark:text-black">
          {s.invitePartner}
        </button>
        {link && (
          <>
            <p className="text-muted">
              <span className="inline-block">{s.partnerLinkHelp[0]}</span> <span className="inline-block">{s.partnerLinkHelp[1]}</span>
            </p>
            <LinkBox link={link} label={s.partnerLinkLabel} />
          </>
        )}
      </div>

      {members.length > 1 &&
        (confirmLeave ? (
          <p className="flex flex-wrap items-center gap-3 text-sm">
            <span>{s.leaveAsk}</span>
            <button
              type="button"
              onClick={() => call(() => createClient().rpc("leave_cellar"), () => window.location.assign("/"))}
              className="font-medium text-red-700 underline underline-offset-2 dark:text-red-400"
            >
              {s.leaveYes}
            </button>
            <button type="button" onClick={() => setConfirmLeave(false)} className="text-muted underline underline-offset-2">
              {s.cancel}
            </button>
          </p>
        ) : (
          <button type="button" onClick={() => setConfirmLeave(true)} className="self-start text-sm text-muted underline underline-offset-2">
            {s.leave}
          </button>
        ))}

      {error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {error}
        </p>
      )}
    </section>
  );
}
