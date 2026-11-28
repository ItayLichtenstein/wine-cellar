"use client";

import { useT } from "@/i18n/provider";
import { useState, useSyncExternalStore } from "react";
import { AiLogo } from "@/components/ai-logos";
import { AI_PROVIDERS, CONNECTABLE, type AiKey } from "@/lib/ai-providers";

const noop = () => () => {};

/**
 * Connecting an AI to the cellar for good (MCP): pick the assistant, and
 * get its steps and the address to paste. The address is this site's own,
 * so it is read in the browser.
 */
export function ConnectAi({ except = [] }: { except?: AiKey[] }) {
  const a = useT().ai;
  const choices = CONNECTABLE.filter((k) => !except.includes(k));
  const [ai, setAi] = useState<AiKey>(choices[0] ?? "claude");
  const origin = useSyncExternalStore(
    noop,
    () => window.location.origin,
    () => "",
  );
  const url = `${origin}/api/mcp`;
  const [copied, setCopied] = useState(false);
  const p = AI_PROVIDERS[ai];
  const setup = a.setup[ai];

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
  // When the AI's page comes already filled in (Claude), its button goes
  // first and copying is only needed if the field turns up empty.
  const copyStep = {
    text: p.prefilled ? a.copyIfEmpty : a.copyAddress,
    extra: (
      <span className="mt-2 flex items-center gap-2">
        <code dir="ltr" className="min-w-0 flex-1 truncate rounded-lg bg-background px-3 py-2 text-sm">
          {url}
        </code>
        <button type="button" onClick={copy} className="shrink-0 rounded-full bg-accent px-4 py-2 text-sm font-medium text-white dark:text-black">
          {copied ? a.copied : a.copy}
        </button>
      </span>
    ),
  };
  const linkButton = (href: string, label: string) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-2 inline-flex w-fit items-center gap-1 rounded-full border border-accent/50 px-4 py-2 text-sm font-medium text-accent"
    >
      {label} ↗
    </a>
  );
  const aiSteps = setup.steps.map((text, i) => ({
    text,
    extra:
      i === 0 && p.setupUrl
        ? linkButton(p.setupUrl(url, a.connectorName), setup.linkLabel)
        : p.stepUrls[i] && setup.stepLinks[i]
          ? linkButton(p.stepUrls[i], setup.stepLinks[i])
          : null,
  }));
  const steps = [
    ...(p.prefilled ? [aiSteps[0], copyStep, ...aiSteps.slice(1)] : [copyStep, ...aiSteps]),
    { text: a.approveStep, extra: null },
    ...setup.afterApprove.map((text) => ({ text, extra: null })),
    { text: setup.chatHint ?? a.doneStep(p.name), extra: null },
  ];

  return (
    <div className="flex flex-col gap-4 rounded-xl bg-surface p-4 shadow-sm">
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={a.pickAi}>
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
            {AI_PROVIDERS[k].recommended && <span className="rounded-full bg-accent/15 px-2 text-xs font-medium text-accent">{a.recommended}</span>}
          </button>
        ))}
      </div>
      <p className="text-sm text-muted">
        <MixedText text={setup.who} />
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
      {setup.tip && <p className="text-sm text-muted">{setup.tip}</p>}
      <p className="text-xs text-muted">
        <span className="inline-block">{a.troubleshoot[0]}</span>{" "}
        <span className="inline-block">{a.troubleshoot[1]}</span>
      </p>
      <p className="text-xs text-muted">
        <span className="inline-block">{a.cantFind[0]}</span>{" "}
        <span className="inline-block">{a.cantFind[1]}</span>
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
  // In English the whole sentence is Latin: nothing to isolate, and bolding it
  // would make it one unbreakable line.
  if (!/[֐-׿]/.test(text)) return text;
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
