"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * A view link for people without an account. Only its hash is stored, so
 * the link is shown once; "new link" replaces it (the old one stops working).
 */
export function ShareLink({ active }: { active: { hidePrices: boolean; hideHistory: boolean } | null }) {
  const router = useRouter();
  const [hidePrices, setHidePrices] = useState(active?.hidePrices ?? true);
  const [hideHistory, setHideHistory] = useState(active?.hideHistory ?? false);
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setError(null);
    setCopied(false);
    const { data, error: e } = await createClient().rpc("create_share_link", { p_hide_prices: hidePrices, p_hide_history: hideHistory });
    if (e || !data) return setError("לא הצלחנו ליצור קישור. נסו שוב.");
    setLink(`${window.location.origin}/shared#${data}`);
    router.refresh();
  }

  async function revoke() {
    setError(null);
    const { error: e } = await createClient().rpc("revoke_share_link");
    if (e) return setError("הביטול לא הצליח. נסו שוב.");
    setLink(null);
    router.refresh();
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
    <section className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold">קישור צפייה</h2>
      <p className="text-sm text-muted">
        <span className="inline-block">מי שמקבל את הקישור רואה את המקרר בלי להירשם,</span>{" "}
        <span className="inline-block">תמיד במצב העדכני.</span>
      </p>
      <div className="flex flex-col gap-2 rounded-xl bg-surface p-3 text-sm shadow-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={hidePrices} onChange={(e) => setHidePrices(e.target.checked)} className="size-4 accent-accent" />
          להסתיר מחירים
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={hideHistory} onChange={(e) => setHideHistory(e.target.checked)} className="size-4 accent-accent" />
          להסתיר את מה ששתינו
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={create} className="rounded-full bg-accent px-3 py-1 font-medium text-white dark:text-black">
            {active ? "יצירת קישור חדש" : "יצירת קישור"}
          </button>
          {active && (
            <button type="button" onClick={revoke} className="text-muted underline underline-offset-2">
              ביטול הקישור
            </button>
          )}
        </div>
        {active && !link && (
          <p className="text-muted">
            <span className="inline-block">יש קישור פעיל.</span>{" "}
            <span className="inline-block">קישור חדש יחליף אותו.</span>
          </p>
        )}
        {link && (
          <>
            <p className="text-muted">
              <span className="inline-block">שמרו או שלחו אותו עכשיו:</span>{" "}
              <span className="inline-block">מטעמי אבטחה הוא מוצג פעם אחת.</span>
            </p>
            <div className="flex gap-2">
              <input readOnly value={link} dir="ltr" aria-label="קישור הצפייה" className="min-w-0 flex-1 rounded-lg border border-muted/40 bg-background px-2 py-1 text-xs" />
              <button type="button" onClick={copy} className="rounded-full border border-muted/40 px-3 py-1">
                {copied ? "הועתק ✓" : "העתקה"}
              </button>
            </div>
          </>
        )}
        {error && <p className="text-red-700 dark:text-red-400">{error}</p>}
      </div>
    </section>
  );
}
