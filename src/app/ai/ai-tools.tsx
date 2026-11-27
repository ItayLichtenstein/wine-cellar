"use client";

import { useLocale, useT } from "@/i18n/provider";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { buildPrompt, parseAiAnswer, type BottleDraft, type CellarLine } from "@/lib/drafts";
import { placeText, placesSummary } from "@/lib/draft-places";
import type { FridgeView } from "@/lib/fridges";
import { createClient } from "@/lib/supabase/client";
import { approveAll, type ApproveResult } from "./approve-all";

export type PendingDraft = {
  id: string;
  source: "mcp" | "paste";
  draft: BottleDraft;
};

const field = "rounded-lg border border-muted/40 bg-surface px-3 py-2 text-base";

/**
 * The AI fallback that works with any assistant (spec): copy the cellar
 * plus instructions, paste the answer back, and every suggested bottle
 * becomes a draft that waits for a person to approve it.
 */
export function ManualTools({ cellar, cellarId, layout }: { cellar: CellarLine[]; cellarId: string; layout: string }) {
  const router = useRouter();
  const locale = useLocale();
  const a = useT().ai;
  const [task, setTask] = useState<"add" | "drink">("add");
  const [extra, setExtra] = useState("");
  const [copied, setCopied] = useState(false);
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState<{
    added: number;
    errors: string[];
  } | null>(null);
  const [busy, setBusy] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(buildPrompt(task, cellar, extra.trim(), layout));
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  async function importAnswer() {
    const { drafts: parsed, errors } = parseAiAnswer(answer, new Date().getFullYear(), locale);
    if (parsed.length === 0) return setResult({ added: 0, errors });
    setBusy(true);
    const { error } = await createClient()
      .from("drafts")
      .insert(
        parsed.map((d) => ({
          cellar_id: cellarId,
          kind: "add_bottles" as const,
          payload: d,
          source: "paste" as const,
        })),
      );
    setBusy(false);
    if (error)
      return setResult({
        added: 0,
        errors: [error.hint === "too_many_drafts" ? a.tooManyDrafts : a.saveFailed],
      });
    setAnswer("");
    setResult({ added: parsed.length, errors });
    router.refresh();
  }

  return (
    <details className="group flex flex-col gap-3">
      <summary className="cursor-pointer list-none rounded-xl border border-muted/30 px-4 py-3">
        <span className="flex items-center justify-between gap-2">
          <span className="flex flex-col">
            <span className="font-medium">{a.manualTitle}</span>
            <span className="text-xs text-muted">{a.manualWho}</span>
          </span>
          <span className="text-muted transition-transform group-open:rotate-180" aria-hidden="true">
            ⌄
          </span>
        </span>
      </summary>
      <p className="mt-3 text-sm text-muted">
        {a.manualIntro.map((part, i) => (
          <span key={i} className="inline-block">
            {part}&nbsp;
          </span>
        ))}
      </p>
      <section className="mt-3 flex flex-col gap-3 rounded-xl bg-surface p-4 shadow-sm">
        <h2 className="font-semibold">{a.step1}</h2>
        <div className="flex gap-2" role="radiogroup" aria-label={a.whatToAsk}>
          {(
            [
              ["add", a.taskAdd],
              ["drink", a.taskDrink],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={task === v}
              onClick={() => {
                setTask(v);
                setCopied(false);
              }}
              className={`rounded-full border px-3 py-1 text-sm ${task === v ? "border-accent bg-accent text-white dark:text-black" : "border-muted/40"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <input
          value={extra}
          onChange={(e) => {
            setExtra(e.target.value);
            setCopied(false);
          }}
          dir="auto"
          maxLength={200}
          placeholder={task === "drink" ? a.extraDrink : a.extraAdd}
          className={field}
        />
        <button type="button" onClick={copy} className="self-start rounded-full bg-accent px-4 py-2 font-medium text-white dark:text-black">
          {copied ? a.copied : a.copyRequest}
        </button>
        <p className="text-sm text-muted">
          {task === "add" ? (
            <>
              <span className="inline-block">{a.pasteAdd[0]}</span>{" "}
              <span className="inline-block">{a.pasteAdd[1]}</span>
            </>
          ) : (
            <span className="inline-block">{a.pasteDrink}</span>
          )}
        </p>
      </section>

      {task === "add" && (
        <section className="mt-3 flex flex-col gap-3 rounded-xl bg-surface p-4 shadow-sm">
          <h2 className="font-semibold">{a.step2}</h2>
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            dir="auto"
            rows={5}
            maxLength={20000}
            placeholder={a.answerPlaceholder}
            className={`${field} font-mono text-sm`}
          />
          <button
            type="button"
            onClick={importAnswer}
            disabled={busy || !answer.trim()}
            className="self-start rounded-full bg-accent px-4 py-2 font-medium text-white disabled:opacity-50 dark:text-black"
          >
            {a.makeDrafts}
          </button>
          {result && (
            <div className="text-sm" role="status">
              {result.added > 0 && (
                <p>{a.draftsAdded(result.added)}</p>
              )}
              {result.errors.map((e) => (
                <p key={e} className="text-red-700 dark:text-red-400" dir="auto">
                  {e}
                </p>
              ))}
            </div>
          )}
        </section>
      )}
    </details>
  );
}

/** Bottles an AI suggested (connected or pasted), waiting for a person. */
export function PendingDrafts({ drafts, fridges, cellarId }: { drafts: PendingDraft[]; fridges: FridgeView[]; cellarId: string }) {
  const router = useRouter();
  const a = useT().ai;
  const locale = useLocale();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<ApproveResult | null>(null);
  const bottleCount = drafts.reduce((n, d) => n + d.draft.quantity, 0);

  async function approveEverything() {
    setBusy(true);
    setDone(await approveAll(cellarId, fridges, drafts));
    setBusy(false);
    router.refresh();
  }

  async function reject(id: string) {
    await createClient().from("drafts").update({ status: "rejected", decided_at: new Date().toISOString() }).eq("id", id);
    router.refresh();
  }

  return (
    (drafts.length > 0 || done) && (
      <section className="flex flex-col gap-2">
        {done && (
          <p role="status" className="rounded-lg bg-accent/15 px-4 py-2 text-sm">
            <span className="inline-block">{a.addedBottles(done.bottles)}</span>
            {done.placed > 0 && <span className="inline-block">{a.placedOf(done.placed)}</span>}
            {done.bottles - done.placed > 0 && <span className="inline-block">{a.outside(done.bottles - done.placed)}</span>}
            {done.failed > 0 && <span className="inline-block">{a.notSaved(done.failed)}</span>}
          </p>
        )}
        {drafts.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">{a.waiting(drafts.length)}</h2>
            {drafts.length > 1 && (
              <button
                type="button"
                onClick={approveEverything}
                disabled={busy}
                className="rounded-full bg-accent px-4 py-1.5 text-sm font-medium text-white disabled:opacity-60 dark:text-black"
              >
                {busy ? a.adding : a.approveAll(bottleCount)}
              </button>
            )}
          </div>
        )}
        <ul className="flex flex-col divide-y divide-muted/20 rounded-xl bg-surface shadow-sm">
          {drafts.map(({ id, source, draft: d }) => (
            <li key={id} className="flex flex-col gap-2 px-4 py-3">
              <span>
                <span dir="auto">
                  {d.winery} – {d.name}
                </span>{" "}
                <span className="text-muted">{d.year ?? "NV"}</span>
                {d.quantity > 1 && (
                  <span className="text-muted" dir="ltr">
                    {" "}
                    ×{d.quantity}
                  </span>
                )}
              </span>
              <span className="text-xs text-muted">
                {[
                  d.places.length ? `📍 ${d.places.length === 1 ? placeText(fridges, d.places[0], locale) : placesSummary(d.places)}` : "",
                  d.grape,
                  d.country,
                  d.price ? `₪${d.price}` : "",
                  source === "mcp" ? a.fromConnected : a.fromPasted,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
              <div className="flex flex-wrap items-center gap-4 text-sm">
                <Link
                  href={`/bottles/new?draft=${id}`}
                  className="rounded-full bg-accent px-4 py-1.5 font-medium text-white dark:text-black"
                >
                  {a.review}
                </Link>
                <button type="button" onClick={() => reject(id)} className="text-muted underline underline-offset-2">
                  {a.reject}
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    )
  );
}
