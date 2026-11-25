"use client";

import { useState, useSyncExternalStore } from "react";
import { AiLogo } from "@/components/ai-logos";
import { AI_KEYS, AI_PROVIDERS, type AiKey } from "@/lib/ai-providers";

const noop = () => () => {};

/**
 * Connecting an AI to the cellar for good (MCP): pick the assistant, and
 * get its steps and the address to paste. The address is this site's own,
 * so it is read in the browser.
 */
export function ConnectAi({ except = [] }: { except?: AiKey[] }) {
  const choices = AI_KEYS.filter((k) => !except.includes(k));
  const [ai, setAi] = useState<AiKey>(choices[0] ?? "claude");
  const origin = useSyncExternalStore(
    noop,
    () => window.location.origin,
    () => "",
  );
  const url = `${origin}/api/mcp`;
  const [copied, setCopied] = useState(false);
  const p = AI_PROVIDERS[ai];

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  // Copy first, then the AI's own steps, then the approval here. Written so
  // anyone can follow it: one action per step, a button for every page.
  const steps = [
    {
      text: "העתיקו את הכתובת של המרתף:",
      extra: (
        <span className="mt-2 flex items-center gap-2">
          <code dir="ltr" className="min-w-0 flex-1 truncate rounded-lg bg-background px-3 py-2 text-sm">
            {url}
          </code>
          <button type="button" onClick={copy} className="shrink-0 rounded-full bg-accent px-4 py-2 text-sm font-medium text-white dark:text-black">
            {copied ? "הועתק ✓" : "העתקה"}
          </button>
        </span>
      ),
    },
    ...p.steps.map((step) => ({
      text: step.text,
      extra: step.link && (
        <a
          href={step.link.href}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex w-fit items-center gap-1 rounded-full border border-accent/50 px-4 py-2 text-sm font-medium text-accent"
        >
          {step.link.label} ↗
        </a>
      ),
    })),
    { text: "ייפתח חלון של האתר שלנו. אם צריך, התחברו עם גוגל, ולחצו \"אישור\".", extra: null },
    { text: `זהו! פתחו צ׳אט חדש ב־${p.name} ושאלו: "מה יש לי במרתף?"`, extra: null },
  ];

  return (
    <div className="flex flex-col gap-4 rounded-xl bg-surface p-4 shadow-sm">
      <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="איזה AI לחבר">
        {choices.map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={ai === k}
            onClick={() => {
              setAi(k);
              setCopied(false);
            }}
            className={`flex flex-col items-center gap-1 rounded-xl border-2 py-2 text-sm ${ai === k ? "border-accent font-medium" : "border-transparent bg-background"}`}
          >
            <AiLogo ai={k} className="size-8" />
            {AI_PROVIDERS[k].name}
          </button>
        ))}
      </div>
      <p className={`rounded-lg px-3 py-2 text-sm ${p.forEveryone ? "bg-background text-muted" : "bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-100"}`}>
        <span className="font-medium">למי זה מתאים: </span>
        {p.who}
      </p>
      <ol className="flex flex-col gap-3">
        {steps.map((step, i) => (
          <li key={i} className="flex gap-3">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-white dark:text-black" aria-hidden="true">
              {i + 1}
            </span>
            <span className="flex min-w-0 flex-1 flex-col pt-0.5">
              <span>
                <MixedText text={step.text} />
              </span>
              {step.extra}
            </span>
          </li>
        ))}
      </ol>
      <p className="text-xs text-muted">
        <span className="inline-block">לא מוצאים את הכפתור? החברות משנות את שמות התפריטים מדי פעם.</span>{" "}
        <span className="inline-block">חפשו בהגדרות את המילה Connectors או MCP, או השתמשו בהעתקה הידנית למטה.</span>
      </p>
    </div>
  );
}

/**
 * Hebrew text with English menu words in it. Each English run is isolated
 * (<bdi>) so punctuation around it stays in place, and bold, since it is
 * exactly what to look for on the screen.
 */
function MixedText({ text }: { text: string }) {
  return text.split(/([A-Za-z][A-Za-z+ ]*[A-Za-z]|\+)/).map((part, i) =>
    i % 2 ? (
      <bdi key={i} className="whitespace-nowrap font-semibold">
        {part}
      </bdi>
    ) : (
      part
    ),
  );
}
