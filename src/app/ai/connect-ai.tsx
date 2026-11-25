"use client";

import { useState, useSyncExternalStore } from "react";
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

  return (
    <div className="flex flex-col gap-3 rounded-xl bg-surface p-4 shadow-sm">
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="איזה AI לחבר">
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
            className={`rounded-full border px-4 py-1.5 text-sm ${ai === k ? "border-accent bg-accent text-white dark:text-black" : "border-muted/40"}`}
          >
            {AI_PROVIDERS[k].name}
          </button>
        ))}
      </div>
      <ol className="flex list-inside list-decimal flex-col gap-2 text-sm">
        <li>
          בהגדרות של {p.name} נכנסים אל{" "}
          <span dir="ltr" className="inline-block font-medium">
            {p.path}
          </span>
        </li>
        <li>
          מדביקים את הכתובת:
          <span className="mt-1 flex items-center gap-2">
            <code dir="ltr" className="min-w-0 flex-1 truncate rounded-lg bg-background px-3 py-2">
              {url}
            </code>
            <button type="button" onClick={copy} className="shrink-0 rounded-full border border-muted/40 px-3 py-1.5">
              {copied ? "הועתק ✓" : "העתקה"}
            </button>
          </span>
        </li>
        <li>מאשרים במסך שנפתח כאן באתר. זהו.</li>
      </ol>
      <p className="text-xs text-muted">
        {p.note && <span className="inline-block">{p.note}</span>}{" "}
        <span className="inline-block">
          שמות התפריטים משתנים מדי פעם; אם לא מוצאים, מחפשים &quot;MCP&quot; או &quot;Connectors&quot; בהגדרות.
        </span>
      </p>
    </div>
  );
}
