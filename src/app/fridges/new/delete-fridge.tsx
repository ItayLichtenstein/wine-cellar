"use client";

import { useT } from "@/i18n/provider";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Deleting a fridge: two taps. Its bottles are not deleted; the database
 * moves them to "מחוץ למקרר" (the zone-delete trigger), so they can be
 * placed again in another fridge.
 */
export function DeleteFridge({ id, stored }: { id: string; stored: number }) {
  const router = useRouter();
  const f = useT().fridgeSetup;
  const [asked, setAsked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function remove() {
    setBusy(true);
    const { error } = await createClient().from("fridges").delete().eq("id", id);
    if (error) {
      setBusy(false);
      setFailed(true);
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <section className="flex flex-col gap-2 rounded-xl border border-red-300/40 p-3 text-sm">
      {!asked ? (
        <button type="button" onClick={() => setAsked(true)} className="self-start font-medium text-red-700 dark:text-red-400">
          {f.deleteFridge}
        </button>
      ) : (
        <>
          <p>
            {stored > 0
              ? f.deleteMoves(f.bottles(stored))
              : f.empty}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={remove}
              disabled={busy}
              className="rounded-full bg-red-700 px-4 py-2 font-medium text-white disabled:opacity-50 dark:bg-red-500"
            >
              {busy ? f.deleting : f.yesDelete}
            </button>
            <button type="button" onClick={() => setAsked(false)} className="rounded-full border border-muted/40 px-4 py-2">
              {f.cancel}
            </button>
          </div>
        </>
      )}
      {failed && (
        <p role="alert" className="text-red-700 dark:text-red-400">
          {f.deleteFailed}
        </p>
      )}
    </section>
  );
}
