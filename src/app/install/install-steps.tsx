"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useT } from "@/i18n/provider";

type Platform = "ios" | "android" | "other";

// Chrome on Android fires this when the site can be installed; prompt() opens its own install dialog.
type InstallPrompt = Event & { prompt: () => Promise<void> };

function detect(): Platform {
  const ua = navigator.userAgent;
  // iPadOS reports itself as a Mac, but a Mac has no touch screen.
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "ios";
  if (/Android/.test(ua)) return "android";
  return "other";
}

const noop = () => () => {};

/**
 * The steps for both phones, the visitor's own phone first. Read on the
 * client only (the server can't know the phone), with a neutral order
 * during the first render so server and client HTML match.
 */
export function InstallSteps() {
  const t = useT();
  const platform = useSyncExternalStore<Platform>(noop, detect, () => "other");
  const installed = useSyncExternalStore(
    noop,
    () => window.matchMedia("(display-mode: standalone)").matches,
    () => false,
  );
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallPrompt);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (installed) {
    return <p className="rounded-xl bg-surface p-4 shadow-sm">{t.install.already}</p>;
  }

  const ios = <Steps key="ios" title={t.install.iphone} steps={t.install.iosSteps} mine={platform === "ios"} />;
  const android = (
    <Steps key="android" title={t.install.android} steps={t.install.androidSteps} mine={platform === "android"}>
      {prompt && (
        <button
          type="button"
          onClick={() => prompt.prompt().then(() => setPrompt(null))}
          className="self-start rounded-full bg-accent px-5 py-2.5 font-medium text-white dark:text-black"
        >
          {t.install.installNow}
        </button>
      )}
    </Steps>
  );

  return <div className="flex flex-col gap-4">{platform === "android" ? [android, ios] : [ios, android]}</div>;
}

function Steps({ title, steps, mine, children }: { title: string; steps: readonly string[]; mine: boolean; children?: React.ReactNode }) {
  const t = useT();
  return (
    <section className={`flex flex-col gap-3 rounded-2xl bg-surface p-4 shadow-sm ${mine ? "ring-2 ring-accent" : ""}`}>
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        {title}
        {mine && <span className="rounded-full bg-accent/15 px-2 py-0.5 text-xs font-medium text-accent">{t.install.yourPhone}</span>}
      </h2>
      <ol className="flex list-decimal flex-col gap-2 ps-5">
        {steps.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
      {children}
    </section>
  );
}
