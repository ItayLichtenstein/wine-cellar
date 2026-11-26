"use client";

import { useT } from "@/i18n/provider";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type FridgeRow = { id: string; name: string; details: string };

/**
 * The household's fridges, in the order the main screen shows them: the
 * first one opens first. Editors move them with arrows (simpler on a phone
 * than drag and drop, and works with a keyboard and a screen reader).
 */
export function FridgeList({ fridges, canEdit }: { fridges: FridgeRow[]; canEdit: boolean }) {
  const router = useRouter();
  const f2 = useT().fridgeSetup;
  const [order, setOrder] = useState(fridges);
  const [failed, setFailed] = useState(false);

  async function move(from: number, to: number) {
    const next = [...order];
    next.splice(to, 0, ...next.splice(from, 1));
    setOrder(next); // show it at once; the database follows
    const supabase = createClient();
    // RLS lets only the household's editors change a fridge.
    const results = await Promise.all(next.map((f, i) => supabase.from("fridges").update({ position: i }).eq("id", f.id)));
    setFailed(results.some((r) => r.error));
    router.refresh();
  }

  const arrow = "flex size-8 items-center justify-center rounded-full text-muted hover:bg-muted/15 disabled:opacity-30";

  return (
    <>
      <ul className="flex flex-col divide-y divide-muted/20 rounded-xl bg-surface shadow-sm">
        {order.map((f, i) => (
          <li key={f.id} className="flex items-center gap-2 px-4 py-3">
            <div className="flex min-w-0 flex-1 flex-col">
              <span>
                {f.name}{" "}
                {i === 0 && order.length > 1 && <span className="text-xs text-muted">{f2.opensFirst}</span>}{" "}
                {canEdit && (
                  <Link href={`/fridges/${f.id}/edit`} className="text-sm underline underline-offset-2">
                    {f2.edit}
                  </Link>
                )}
              </span>
              <span className="text-sm text-muted">{f.details}</span>
            </div>
            {canEdit && order.length > 1 && (
              <div className="flex shrink-0 gap-1">
                <button type="button" className={arrow} disabled={i === 0} onClick={() => move(i, i - 1)} aria-label={f2.moveUp(f.name)}>
                  ↑
                </button>
                <button type="button" className={arrow} disabled={i === order.length - 1} onClick={() => move(i, i + 1)} aria-label={f2.moveDown(f.name)}>
                  ↓
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
      {failed && <p className="text-sm text-red-700 dark:text-red-400">{f2.orderFailed}</p>}
    </>
  );
}
