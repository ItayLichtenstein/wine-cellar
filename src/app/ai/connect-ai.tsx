"use client";

import { useState, useSyncExternalStore } from "react";

const noop = () => () => {};

/**
 * How to connect an AI to the cellar for good (MCP), instead of copying
 * and pasting each time. The address is this site's own, so it is read in
 * the browser; the server render shows the path only.
 */
export function ConnectAi() {
  const origin = useSyncExternalStore(noop, () => window.location.origin, () => "");
  const url = `${origin}/api/mcp`;
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section id="connect" className="flex flex-col gap-3 rounded-xl bg-surface p-4 shadow-sm">
      <h2 className="font-semibold">חיבור קבוע ל־Claude</h2>
      <p className="text-sm text-muted">
        <span className="inline-block">בלי להעתיק ולהדביק:</span>{" "}
        <span className="inline-block">כך Claude רואה את המרתף, ממליץ מה לשתות,</span>{" "}
        <span className="inline-block">ומציע בקבוקים שמחכים כאן לאישור שלכם.</span>{" "}
        <span className="inline-block">הוא לא יכול לשנות או למחוק כלום.</span>
      </p>
      <ol className="flex list-inside list-decimal flex-col gap-1 text-sm">
        <li>
          בהגדרות של Claude נכנסים אל{" "}
          <span dir="ltr" className="inline-block">
            Settings → Connectors → Add custom connector
          </span>
        </li>
        <li>להדביק את הכתובת:</li>
      </ol>
      <div className="flex items-center gap-2">
        <code dir="ltr" className="min-w-0 flex-1 truncate rounded-lg bg-background px-3 py-2 text-sm">
          {url}
        </code>
        <button type="button" onClick={copy} className="shrink-0 rounded-full border border-muted/40 px-3 py-1.5 text-sm">
          {copied ? "הועתק ✓" : "העתקה"}
        </button>
      </div>
      <p className="text-sm text-muted">
        <span className="inline-block">משם Claude יעביר אתכם למסך אישור כאן באתר.</span>{" "}
        <span className="inline-block">אפשר לנתק בכל רגע מאותו עמוד.</span>
      </p>
    </section>
  );
}
