"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { cellarTitle } from "@/lib/cellar-title";
import { createClient } from "@/lib/supabase/client";

export type Friend = { cellarId: string; names: string[]; customName: string | null; iShowPrices: boolean; theyShowPrices: boolean };

/**
 * Friend cellars: open one, choose whether it sees our prices, end the
 * friendship, or invite a new friend. Friendship is between cellars, so
 * every full member of the household manages it.
 */
export function Friends({ friends, canEdit }: { friends: Friend[]; canEdit: boolean }) {
  const router = useRouter();
  const [link, setLink] = useState<string | null>(null);
  const [showPrices, setShowPrices] = useState(false);
  const [copied, setCopied] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(call: PromiseLike<{ error: unknown }>) {
    setError(null);
    const { error: e } = await call;
    if (e) return setError("הפעולה לא הצליחה. נסו שוב.");
    router.refresh();
  }

  async function invite() {
    setCopied(false);
    const { data, error: e } = await createClient().rpc("create_friend_invite", { p_shows_prices: showPrices });
    if (e || !data) return setError("לא הצלחנו ליצור קישור. נסו שוב.");
    // After "#": browsers never send that part to a server.
    setLink(`${window.location.origin}/friend-invite#${data}`);
  }

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section id="friends" className="flex scroll-mt-4 flex-col gap-2">
      <h2 className="text-lg font-semibold">חברים</h2>
      {friends.length === 0 ? (
        <p className="text-sm text-muted">
          <span className="inline-block">חברים רואים את המרתף שלכם,</span>{" "}
          <span className="inline-block">ואתם את שלהם. רק צפייה, בלי שינויים.</span>
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-muted/20 rounded-xl bg-surface shadow-sm">
          {friends.map((f) => (
            <li key={f.cellarId} className="flex flex-col gap-2 px-4 py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <Link href={`/friends/${f.cellarId}`} className="font-medium underline underline-offset-2" dir="auto">
                  {cellarTitle(f.names, f.customName)}
                </Link>
                <span className="text-xs text-muted">{f.theyShowPrices ? "משתפים אתכם במחירים" : "המחירים שלהם מוסתרים"}</span>
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
                    רואים את המחירים שלנו
                  </label>
                  {removing === f.cellarId ? (
                    <span className="flex basis-full flex-wrap items-center gap-3">
                      <span>להפסיק את החברות? שני הצדדים יפסיקו לראות זה את זה.</span>
                      <button
                        type="button"
                        onClick={() => run(createClient().rpc("remove_friend", { p_friend_cellar: f.cellarId }))}
                        className="rounded-full bg-red-700 px-3 py-1 font-medium text-white dark:bg-red-400 dark:text-black"
                      >
                        כן, להסיר
                      </button>
                      <button type="button" onClick={() => setRemoving(null)} className="text-muted underline underline-offset-2">
                        ביטול
                      </button>
                    </span>
                  ) : (
                    <button type="button" onClick={() => setRemoving(f.cellarId)} className="text-muted underline underline-offset-2">
                      הסרה
                    </button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {canEdit && (
        <div className="flex flex-col gap-2 rounded-xl bg-surface p-3 text-sm shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={showPrices} onChange={(e) => setShowPrices(e.target.checked)} className="size-4 accent-accent" />
              החבר יראה את המחירים שלנו
            </label>
            <button type="button" onClick={invite} className="rounded-full bg-accent px-3 py-1 font-medium text-white dark:text-black">
              יצירת קישור לחבר
            </button>
          </div>
          {link && (
            <>
              <p className="text-muted">
                <span className="inline-block">שלחו את הקישור לחבר.</span>{" "}
                <span className="inline-block">הוא עובד פעם אחת ובתוקף 7 ימים.</span>
              </p>
              <div className="flex gap-2">
                <input readOnly value={link} dir="ltr" aria-label="קישור ההזמנה לחבר" className="min-w-0 flex-1 rounded-lg border border-muted/40 bg-background px-2 py-1 text-xs" />
                <button type="button" onClick={copy} className="rounded-full border border-muted/40 px-3 py-1">
                  {copied ? "הועתק ✓" : "העתקה"}
                </button>
              </div>
            </>
          )}
        </div>
      )}
      {error && <p className="text-sm text-red-700 dark:text-red-400">{error}</p>}
    </section>
  );
}
