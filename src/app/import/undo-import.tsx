"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useT } from "@/i18n/provider";
import { createClient } from "@/lib/supabase/client";

/**
 * "Undo the last import": deletes exactly what that import created, after a
 * confirmation with the count. The database (undo_last_import) decides what
 * that is and enforces the one-week limit.
 */
export function UndoImport({ bottles, date }: { bottles: number; date: string }) {
  const t = useT().importer;
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [state, setState] = useState<"idle" | "busy" | "failed">("idle");

  async function undo() {
    setState("busy");
    const { data, error } = await createClient().rpc("undo_last_import");
    if (error) return setState("failed");
    // The page shows the result from the address, since this box goes away
    // once there is nothing left to undo.
    router.replace(`/import?undone=${data}`);
  }

  return (
    <section className="flex flex-col gap-2 rounded-xl border border-muted/30 p-3 text-sm">
      <h2 className="font-semibold">{t.undoTitle}</h2>
      <p className="text-muted">{t.undoText(bottles, date)}</p>
      {!asking ? (
        <button type="button" onClick={() => setAsking(true)} className="self-start rounded-full border border-muted/40 px-4 py-2">
          {t.undoTitle}
        </button>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="font-medium">{t.undoAsk(bottles)}</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={undo}
              disabled={state === "busy"}
              className="rounded-full bg-red-700 px-4 py-2 font-medium text-white disabled:opacity-50 dark:bg-red-500"
            >
              {t.undoYes}
            </button>
            <button type="button" onClick={() => setAsking(false)} className="rounded-full border border-muted/40 px-4 py-2">
              {t.cancel}
            </button>
          </div>
        </div>
      )}
      {state === "failed" && (
        <p role="alert" className="text-red-700 dark:text-red-400">
          {t.undoFailed}
        </p>
      )}
    </section>
  );
}
