"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useLocale, useT } from "@/i18n/provider";
import { cellarTitle } from "@/lib/cellar-title";
import { createClient } from "@/lib/supabase/client";
import { LinkBox } from "./link-box";

export type Friend = { cellarId: string; names: string[]; customName: string | null; iShowPrices: boolean; theyShowPrices: boolean };

/**
 * Friend cellars: open one, choose whether it sees our prices, end the
 * friendship, or invite a new friend. Friendship is between cellars, so
 * every full member of the household manages it.
 */
export function Friends({ friends, canEdit }: { friends: Friend[]; canEdit: boolean }) {
  const router = useRouter();
  const t = useT();
  const locale = useLocale();
  const s = t.sharing;
  const [link, setLink] = useState<string | null>(null);
  const [showPrices, setShowPrices] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(call: PromiseLike<{ error: unknown }>) {
    setError(null);
    const { error: e } = await call;
    if (e) return setError(s.failed);
    router.refresh();
  }

  async function invite() {
    const { data, error: e } = await createClient().rpc("create_friend_invite", { p_shows_prices: showPrices });
    if (e || !data) return setError(s.linkFailed);
    // After "#": browsers never send that part to a server.
    setLink(`${window.location.origin}/friend-invite#${data}`);
  }

  const inviteCard = canEdit && (
    <div className="flex flex-col gap-3 rounded-xl bg-surface p-3 text-sm shadow-sm">
      <button type="button" onClick={invite} className="self-start rounded-full bg-accent px-4 py-2 font-medium text-white dark:text-black">
        {s.inviteFriend}
      </button>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={showPrices}
          onChange={(e) => {
            // A link already shown carries the old choice: hide it, so the
            // one sent always matches the checkbox.
            setShowPrices(e.target.checked);
            setLink(null);
          }}
          className="size-4 accent-accent"
        />
        {s.friendSeesPrices}
      </label>
      {link && (
        <>
          <p className="text-muted">
            {s.friendLinkHelp.map((part, i) => (
              <span key={i} className="inline-block">
                {part}&nbsp;
              </span>
            ))}
          </p>
          <LinkBox link={link} label={s.friendLinkLabel} />
        </>
      )}
    </div>
  );

  return (
    <section id="friends" className="flex scroll-mt-4 flex-col gap-2">
      <h2 className="text-lg font-semibold">{s.friendsTitle}</h2>
      <p className="text-sm text-muted">
        <span className="inline-block">{s.friendsIntro[0]}</span> <span className="inline-block">{s.friendsIntro[1]}</span>
      </p>
      {friends.length > 0 && (
        <ul className="flex flex-col divide-y divide-muted/20 rounded-xl bg-surface shadow-sm">
          {friends.map((f) => (
            <li key={f.cellarId} className="flex flex-col gap-2 px-4 py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <Link href={`/friends/${f.cellarId}`} className="font-medium underline underline-offset-2" dir="auto">
                  {cellarTitle(f.names, f.customName, locale)}
                </Link>
                <span className="text-xs text-muted">{f.theyShowPrices ? s.theyShow : s.theyHide}</span>
              </div>
              {canEdit && (
                <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={f.iShowPrices}
                      onChange={(e) =>
                        run(createClient().rpc("set_friend_prices", { p_friend_cellar: f.cellarId, p_shows: e.target.checked }))
                      }
                      className="size-4 accent-accent"
                    />
                    {s.iShow}
                  </label>
                  {removing === f.cellarId ? (
                    <span className="flex basis-full flex-wrap items-center gap-3">
                      <span>{s.removeAsk}</span>
                      <button
                        type="button"
                        onClick={() => run(createClient().rpc("remove_friend", { p_friend_cellar: f.cellarId }))}
                        className="rounded-full bg-red-700 px-3 py-1 font-medium text-white dark:bg-red-400 dark:text-black"
                      >
                        {s.removeYes}
                      </button>
                      <button type="button" onClick={() => setRemoving(null)} className="text-muted underline underline-offset-2">
                        {s.cancel}
                      </button>
                    </span>
                  ) : (
                    <button type="button" onClick={() => setRemoving(f.cellarId)} className="text-muted underline underline-offset-2">
                      {s.remove}
                    </button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {inviteCard}
      {error && <p className="text-sm text-red-700 dark:text-red-400">{error}</p>}
    </section>
  );
}
