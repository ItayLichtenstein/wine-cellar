"use client";

import Link from "next/link";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { LineIcon } from "@/components/line-icon";
import { useT } from "@/i18n/provider";

/**
 * "Connect an AI" is an invitation, not a fixture: it shows on the first two
 * visits (sessions) on this device, and has an X. Once it goes, by the X or
 * by itself, a small window says where connecting lives from now on
 * (More → Your AI), once. Stored on the device, like the guide card.
 */
const VISITS = "ai-card-visits"; // localStorage: sessions counted so far
const COUNTED = "ai-card-counted"; // sessionStorage: this session already counted
const DISMISSED = "ai-card-dismissed";
const EXPLAINED = "ai-card-explained";
const EVENT = "ai-card-change";
export const AI_CARD_VISITS = 2;

type State = "show" | "hide" | "explain";

/** Pure, so the rule is tested: which state the card is in. */
export function aiCardState(visits: number, countedThisSession: boolean, dismissed: boolean, explained: boolean): State {
  const thisVisit = countedThisSession ? visits : visits + 1;
  const shown = !dismissed && thisVisit <= AI_CARD_VISITS;
  if (shown) return "show";
  return explained ? "hide" : "explain";
}

function read(): State {
  try {
    return aiCardState(
      Number(localStorage.getItem(VISITS)) || 0,
      sessionStorage.getItem(COUNTED) === "1",
      localStorage.getItem(DISMISSED) === "1",
      localStorage.getItem(EXPLAINED) === "1",
    );
  } catch {
    return "show"; // storage blocked: just show it, with its X
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  return () => window.removeEventListener(EVENT, onChange);
}

function save(key: string, value: string, store: "local" | "session" = "local") {
  try {
    (store === "local" ? localStorage : sessionStorage).setItem(key, value);
  } catch {
    // Private mode: the choice holds until the page is reloaded.
  }
  window.dispatchEvent(new Event(EVENT));
}

export function AiCardGate({ children }: { children: React.ReactNode }) {
  const t = useT();
  // The server renders it hidden, so a dismissed card never flashes in.
  const state = useSyncExternalStore(subscribe, read, () => "hide" as State);
  const dialog = useRef<HTMLDialogElement>(null);

  // Count this visit once per session (a refresh is not a new visit).
  useEffect(() => {
    try {
      if (sessionStorage.getItem(COUNTED) === "1") return;
      const visits = (Number(localStorage.getItem(VISITS)) || 0) + 1;
      localStorage.setItem(VISITS, String(visits));
      save(COUNTED, "1", "session");
    } catch {
      // No storage: nothing to count.
    }
  }, []);

  useEffect(() => {
    if (state === "explain" && !dialog.current?.open) dialog.current?.showModal();
  }, [state]);

  const close = () => {
    dialog.current?.close();
    save(EXPLAINED, "1");
  };

  return (
    <>
      {state === "show" && (
        <div className="relative">
          {children}
          <button
            type="button"
            onClick={() => save(DISMISSED, "1")}
            aria-label={t.aiCard.dismiss}
            className="absolute -top-2 -end-2 flex size-7 items-center justify-center rounded-full border border-muted/30 bg-background text-muted shadow-sm hover:text-foreground"
          >
            ×
          </button>
        </div>
      )}
      <dialog
        ref={dialog}
        onClose={close}
        onClick={(e) => e.target === e.currentTarget && close()}
        aria-labelledby="ai-later-title"
        className="m-auto w-[min(22rem,calc(100%-2rem))] rounded-2xl bg-background p-0 text-foreground shadow-xl backdrop:bg-black/50"
      >
        <div className="flex flex-col gap-4 p-5">
          <h2 id="ai-later-title" className="text-lg font-semibold">
            {t.aiCard.later.title}
          </h2>
          <p className="text-sm text-muted">{t.aiCard.later.text}</p>
          {/* The way there, drawn like the real buttons: More → Your AI. */}
          <div className="flex items-center justify-center gap-2 rounded-xl bg-surface p-3 text-sm">
            <span className="flex flex-col items-center gap-1">
              <LineIcon name="more" />
              {t.nav.more}
            </span>
            <span className="text-muted" aria-hidden="true">
              {t.common.forward}
            </span>
            <span className="flex items-center gap-2 rounded-lg border border-accent/40 px-3 py-2 font-medium">
              <span className="text-accent">
                <LineIcon name="sparkle" className="size-5" />
              </span>
              {t.more.links.ai[0]}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <Link href="/ai" onClick={close} className="text-sm text-muted underline underline-offset-2">
              {t.aiCard.later.connectNow}
            </Link>
            <button type="button" onClick={close} className="rounded-full bg-accent px-5 py-2 font-medium text-white dark:text-black">
              {t.aiCard.later.ok}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
