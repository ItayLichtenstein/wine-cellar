"use client";

import { useSyncExternalStore } from "react";
import { useT } from "@/i18n/provider";

/**
 * The connected AI's card shows on every visit, with an X that hides it
 * until the next one (sessionStorage: a new visit brings it back).
 */
const CLOSED = "ai-card-closed-this-visit";
const EVENT = "ai-card-close";

function read(): boolean {
  try {
    return sessionStorage.getItem(CLOSED) === "1";
  } catch {
    return false;
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  return () => window.removeEventListener(EVENT, onChange);
}

function close() {
  try {
    sessionStorage.setItem(CLOSED, "1");
  } catch {
    // Private mode: hidden until the page is reloaded.
  }
  window.dispatchEvent(new Event(EVENT));
}

export function AiCardClose({ children }: { children: React.ReactNode }) {
  const t = useT();
  const closed = useSyncExternalStore(subscribe, read, () => false);
  if (closed) return null;
  return (
    <div className="relative">
      {children}
      <button
        type="button"
        onClick={close}
        aria-label={t.aiCard.closeForVisit}
        className="absolute -top-2 -end-2 flex size-7 items-center justify-center rounded-full border border-muted/30 bg-background text-muted shadow-sm hover:text-foreground"
      >
        ×
      </button>
    </div>
  );
}
