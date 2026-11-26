"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useT } from "@/i18n/provider";
import { type FirstStepsState, showFirstSteps, stateOnShow } from "@/lib/first-steps";
import { createClient } from "@/lib/supabase/client";

const VISIT_KEY = "first-steps-open"; // sessionStorage: the visit in which the card appeared

function readVisit(): boolean {
  try {
    return sessionStorage.getItem(VISIT_KEY) === "1";
  } catch {
    return false;
  }
}

function markVisit() {
  try {
    sessionStorage.setItem(VISIT_KEY, "1");
  } catch {
    // Private mode: the card simply goes away a little sooner.
  }
}

const noSubscribe = () => () => {};

/**
 * A short checklist for a new user, shown once (testers disliked cards that
 * keep coming back). If it is ignored, it is gone from the next visit on;
 * if the user taps a step, it stays until they close it or finish.
 * The state lives in the profile, so it holds on every device.
 */
export function FirstSteps({
  userId,
  initial,
  done,
}: {
  userId: string;
  initial: FirstStepsState;
  done: { bottle: boolean; people: boolean };
}) {
  const f = useT().home.firstSteps;
  const [state, setState] = useState<FirstStepsState>(initial);
  const openThisVisit = useSyncExternalStore(noSubscribe, readVisit, () => false);

  useEffect(() => {
    const next = stateOnShow(initial);
    if (!next) return;
    markVisit();
    void createClient().from("profiles").update({ first_steps: next }).eq("id", userId);
  }, [initial, userId]);

  function save(next: "using" | "closed") {
    setState(next);
    void createClient().from("profiles").update({ first_steps: next }).eq("id", userId);
  }

  const steps: { label: string; href: string; done: boolean }[] = [
    { label: f.fridge, href: "/fridges", done: true },
    { label: f.bottle, href: "/bottles/new", done: done.bottle },
    { label: f.people, href: "/sharing", done: done.people },
  ];
  const allDone = steps.every((s) => s.done);

  if (!showFirstSteps(state, openThisVisit, allDone)) return null;

  return (
    <section aria-label={f.title} className="flex flex-col gap-2 rounded-xl bg-accent/15 p-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold">{allDone ? f.allDone : f.title}</h2>
        <button
          type="button"
          onClick={() => save("closed")}
          aria-label={f.close}
          className="size-8 shrink-0 rounded-full text-lg text-muted hover:bg-surface"
        >
          ×
        </button>
      </div>
      <ol className="flex flex-col gap-1.5">
        {steps.map((s) => (
          <li key={s.href} className="flex items-center gap-2">
            <span
              aria-hidden
              className={`flex size-5 shrink-0 items-center justify-center rounded-full text-xs ${s.done ? "bg-accent text-white dark:text-black" : "border border-muted/50"}`}
            >
              {s.done && "✓"}
            </span>
            {s.done ? (
              <span className="text-muted line-through decoration-muted/50">{s.label}</span>
            ) : (
              <Link href={s.href} onClick={() => save("using")} className="underline-offset-2 hover:underline">
                {s.label} {f.go}
              </Link>
            )}
            <span className="sr-only">{s.done ? f.doneLabel : f.todoLabel}</span>
          </li>
        ))}
      </ol>
      <p className="text-sm text-muted">
        {f.moreHelp}{" "}
        <Link href="/guide" onClick={() => save("using")} className="underline underline-offset-2">
          {f.guide}
        </Link>
        {f.and}
        <Link href="/import" onClick={() => save("using")} className="underline underline-offset-2">
          {f.import}
        </Link>
      </p>
    </section>
  );
}
