"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FoundBottle, ResolvedPlace } from "@/lib/draft-places";
import type { ActionDraft } from "@/lib/drafts";
import { createClient } from "@/lib/supabase/client";
import { formatScore } from "@/lib/wine-extra";

export type PendingAction = {
  id: string;
  action: ActionDraft;
  /** The bottle the AI means, found on the server; null = no such bottle. */
  bottle: FoundBottle | null;
  /** For a move: the new place, if it exists and is free. */
  target: ResolvedPlace | null;
  targetText: string;
};

const today = () => new Date().toLocaleDateString("en-CA");

/**
 * The AI's suggestions for bottles already in the cellar ("we drank it",
 * "move it there"). Unlike adding, each one is approved on its own: these
 * change the cellar, so never as a batch.
 */
export function PendingActions({ actions }: { actions: PendingAction[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  async function decide(id: string, status: "approved" | "rejected") {
    await createClient().from("drafts").update({ status, decided_at: new Date().toISOString() }).eq("id", id);
  }

  async function approve(p: PendingAction) {
    if (!p.bottle) return;
    setBusy(p.id);
    setFailed(null);
    const supabase = createClient();
    let ok = true;
    if (p.action.kind === "drink") {
      // The wine and vintage first: the rating belongs to them, not to the bottle.
      const { data: v } = await supabase.from("bottles").select("vintage_id, wine_vintages(wine_id)").eq("id", p.bottle.id).single();
      const { error } = await supabase.rpc("drink_bottle", {
        p_bottle_id: p.bottle.id,
        p_tasted_on: p.action.date ?? today(),
        p_notes: p.action.notes || undefined,
      });
      ok = !error;
      if (ok && p.action.score !== null && v?.wine_vintages) {
        await supabase.rpc("set_rating", { p_wine_id: v.wine_vintages.wine_id, p_score: p.action.score, p_vintage_id: v.vintage_id });
      }
    } else if (p.target) {
      const { error } = await supabase.rpc("move_bottle", {
        p_bottle_id: p.bottle.id,
        p_zone_id: p.target.zoneId,
        p_slot: p.target.slot ?? undefined,
      });
      ok = !error;
    } else ok = false;

    if (ok) await decide(p.id, "approved");
    else setFailed(p.id);
    setBusy(null);
    router.refresh();
  }

  async function reject(id: string) {
    await decide(id, "rejected");
    router.refresh();
  }

  if (actions.length === 0) return null;
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold">הצעות לבקבוקים שבמרתף ({actions.length})</h2>
      <ul className="flex flex-col divide-y divide-muted/20 rounded-xl bg-surface shadow-sm">
        {actions.map((p) => {
          const a = p.action;
          const wine = (
            <span dir="auto">
              {a.winery} – {a.name} <span className="text-muted">{a.year ?? "NV"}</span>
            </span>
          );
          const problem = !p.bottle ? "לא מצאנו את הבקבוק הזה במרתף." : a.kind === "move" && !p.target ? "המקום החדש לא קיים או תפוס." : null;
          return (
            <li key={p.id} className="flex flex-col gap-2 px-4 py-3">
              <span>
                {a.kind === "drink" ? "🍷 שתיתם את " : "↔️ להזיז את "}
                {wine}
              </span>
              <span className="text-xs text-muted">
                {[
                  p.bottle?.where,
                  a.kind === "move" ? `אל ${p.targetText}` : "",
                  a.kind === "drink" && a.score !== null ? `ציון ${formatScore(a.score)}` : "",
                  a.kind === "drink" && a.date ? a.date : "",
                  "מה־AI המחובר",
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
              {a.kind === "drink" && a.notes && (
                <span className="text-sm" dir="auto">
                  ״{a.notes}״
                </span>
              )}
              {problem && <span className="text-sm text-red-700 dark:text-red-400">{problem}</span>}
              {failed === p.id && (
                <span role="alert" className="text-sm text-red-700 dark:text-red-400">
                  לא הצליח. ייתכן שהבקבוק או המקום השתנו בינתיים.
                </span>
              )}
              <div className="flex flex-wrap items-center gap-4 text-sm">
                {!problem && (
                  <button
                    type="button"
                    onClick={() => approve(p)}
                    disabled={busy === p.id}
                    className="rounded-full bg-accent px-4 py-1.5 font-medium text-white disabled:opacity-60 dark:text-black"
                  >
                    {busy === p.id ? "רגע…" : a.kind === "drink" ? "כן, שתינו" : "כן, להזיז"}
                  </button>
                )}
                <button type="button" onClick={() => reject(p.id)} className="text-muted underline underline-offset-2">
                  לדחות
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
