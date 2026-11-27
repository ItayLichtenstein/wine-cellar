"use client";

import { useT } from "@/i18n/provider";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type AiChange = { id: string; kind: "add_bottles" | "drink" | "move" | "delete"; title: string; count: number };

/**
 * What an AI changed by itself (edit mode, ADR 0013), newest first, each
 * with an undo button. The database puts the bottle back (undo_ai_change).
 */
export function AiChanges({ changes }: { changes: AiChange[] }) {
  const a = useT().ai;
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  async function undo(id: string) {
    setBusy(id);
    setFailed(null);
    const { error } = await createClient().rpc("undo_ai_change", { p_draft_id: id });
    setBusy(null);
    if (error) return setFailed(id);
    router.refresh();
  }

  if (changes.length === 0) return null;
  const verb = (c: AiChange) =>
    c.kind === "add_bottles" ? a.changeAdd(c.count) : c.kind === "drink" ? a.changeDrink : c.kind === "move" ? a.changeMove : a.changeDelete;

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold">{a.changesTitle}</h2>
      <ul className="flex flex-col divide-y divide-muted/20 rounded-xl bg-surface shadow-sm">
        {changes.map((c) => (
          <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <span className="flex min-w-0 flex-col">
              <span className="text-xs text-muted">{verb(c)}</span>
              <span dir="auto" className="truncate">
                {c.title}
              </span>
              {failed === c.id && <span className="text-xs text-red-700 dark:text-red-400">{a.undoFailed}</span>}
            </span>
            <button
              type="button"
              onClick={() => undo(c.id)}
              disabled={busy === c.id}
              className="shrink-0 rounded-full border border-muted/40 px-4 py-1.5 text-sm disabled:opacity-60"
            >
              {a.undo}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
