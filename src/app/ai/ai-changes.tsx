"use client";

import { useLocale, useT } from "@/i18n/provider";
import { intlTag } from "@/i18n/locales";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type AiChange = {
  id: string;
  kind: "add_bottles" | "drink" | "move" | "delete" | "edit" | "wishlist" | "taste" | "fridge";
  title: string;
  count: number;
  when: string;
};

/** Shown open; the rest of the 30 days fold under "N more". */
const SHOWN = 3;

/**
 * What an AI changed by itself (edit mode, ADR 0013), newest first, each
 * with an undo button. The database puts the bottle back (undo_ai_change).
 * The last few are open; older ones (up to 30 days, then the database
 * deletes them) fold away, so the page does not grow with every change.
 */
export function AiChanges({ changes }: { changes: AiChange[] }) {
  const a = useT().ai;
  const date = new Intl.DateTimeFormat(intlTag(useLocale()), {
    day: "numeric",
    month: "numeric",
  });
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  async function undo(id: string) {
    setBusy(id);
    setFailed(null);
    const { error } = await createClient().rpc("undo_ai_change", {
      p_draft_id: id,
    });
    setBusy(null);
    if (error) return setFailed(id);
    router.refresh();
  }

  if (changes.length === 0) return null;
  const verb = (c: AiChange) =>
    c.kind === "add_bottles"
      ? a.changeAdd(c.count)
      : c.kind === "drink"
        ? a.changeDrink
        : c.kind === "move"
          ? a.changeMove
          : a.changeDelete;

  const row = (c: AiChange) => (
    <li
      key={c.id}
      className="flex items-center justify-between gap-3 px-4 py-3"
    >
      <span className="flex min-w-0 flex-col">
        <span className="text-xs text-muted">
          {verb(c)}
          {c.when && ` · ${date.format(new Date(c.when))}`}
        </span>
        <span dir="auto" className="truncate">
          {c.title}
        </span>
        {failed === c.id && (
          <span className="text-xs text-red-700 dark:text-red-400">
            {a.undoFailed}
          </span>
        )}
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
  );

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold">{a.changesTitle}</h2>
      <ul className="flex flex-col divide-y divide-muted/20 rounded-xl bg-surface shadow-sm">
        {changes.slice(0, SHOWN).map(row)}
      </ul>
      {changes.length > SHOWN && (
        <details className="flex flex-col gap-2">
          <summary className="cursor-pointer text-sm underline underline-offset-2">
            {a.changesMore(changes.length - SHOWN)}
          </summary>
          <ul className="mt-2 flex flex-col divide-y divide-muted/20 rounded-xl bg-surface shadow-sm">
            {changes.slice(SHOWN).map(row)}
          </ul>
        </details>
      )}
      <p className="text-xs text-muted">{a.changesKept}</p>
    </section>
  );
}
