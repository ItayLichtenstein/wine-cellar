"use client";

import { useState } from "react";
import { useT } from "@/i18n/provider";

/**
 * A freshly created link: the phone's own share sheet first (WhatsApp etc.,
 * where the browser supports it), and a copy button as the fallback.
 */
export function LinkBox({ link, label }: { link: string; label: string }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  // Rendered only after a click created the link, so this never runs on the server.
  const canShare = typeof navigator.share === "function";

  async function share() {
    try {
      await navigator.share({ url: link });
    } catch {
      // The user closed the share sheet: nothing to do.
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <input readOnly value={link} dir="ltr" aria-label={label} className="w-full rounded-lg border border-muted/40 bg-background px-2 py-1 text-xs" />
      <div className="flex gap-2">
        {canShare && (
          <button type="button" onClick={share} className="rounded-full bg-accent px-4 py-1.5 font-medium text-white dark:text-black">
            {t.sharing.share}
          </button>
        )}
        <button type="button" onClick={copy} className="rounded-full border border-muted/40 px-4 py-1.5">
          {copied ? t.sharing.copied : t.sharing.copy}
        </button>
      </div>
    </div>
  );
}
