import Link from "next/link";
import { AI_PROVIDERS, AI_REQUESTS, type AiKey } from "@/lib/ai-providers";
import { AiLogo, AiLogoStack } from "@/components/ai-logos";
import type { Dictionary } from "@/i18n/dictionaries";
import { getT } from "@/i18n/server";
import { AiCardGate } from "./ai-card-gate";
import { OpenChat } from "./open-chat";

/**
 * The AI on the main screen, in two states:
 * - not connected: one card that says what a connected AI does, and leads to setting it up;
 * - connected: the household's AI by name, with the two tasks as buttons
 *   that open that AI's chat with the request already typed.
 * Pending drafts get their own line, since they wait on the user.
 */
export async function AiCard({ connected, pendingDrafts, nearlyEmpty }: { connected: AiKey | null; pendingDrafts: number; nearlyEmpty: boolean }) {
  const t = await getT();
  // Not connected: an invitation that shows twice and can be closed (AiCardGate).
  const card = connected ? (
    <Connected ai={connected} nearlyEmpty={nearlyEmpty} t={t} />
  ) : (
    <AiCardGate>
      <NotConnected nearlyEmpty={nearlyEmpty} t={t} />
    </AiCardGate>
  );
  // Nothing else to say: no wrapper, so a hidden card leaves no empty gap.
  if (pendingDrafts === 0) return card;
  return (
    <section aria-label={t.aiCard.label} className="flex flex-col gap-2">
      {card}
      {pendingDrafts > 0 && (
        <Link href="/ai" className="flex items-center justify-between rounded-xl bg-accent/15 px-4 py-2 text-sm">
          <span>{t.aiCard.pending(pendingDrafts)}</span>
          <span aria-hidden="true">{t.common.forward}</span>
        </Link>
      )}
    </section>
  );
}

function NotConnected({ nearlyEmpty, t }: { nearlyEmpty: boolean; t: Dictionary }) {
  return (
    <Link href="/ai" className="flex flex-col gap-1 rounded-xl border border-accent/30 bg-surface p-4 shadow-sm hover:border-accent">
      <span className="flex items-center justify-between gap-3">
        <span className="font-medium">{t.aiCard.connect}</span>
        <AiLogoStack />
      </span>
      <span className="text-sm text-muted">
        {nearlyEmpty ? (
          <>
            <span className="inline-block">{t.aiCard.emptyText[0]}</span>{" "}
            <span className="inline-block">{t.aiCard.emptyText[1]}</span>
          </>
        ) : (
          <>
            <span className="inline-block">{t.aiCard.fullText[0]}</span>{" "}
            <span className="inline-block">{t.aiCard.fullText[1]}</span>
          </>
        )}
      </span>
      <span className="text-sm text-accent">
        {t.aiCard.withWhich} {t.common.forward}
      </span>
    </Link>
  );
}

function Connected({ ai, nearlyEmpty, t }: { ai: AiKey; nearlyEmpty: boolean; t: Dictionary }) {
  const p = AI_PROVIDERS[ai];
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-accent/30 bg-surface p-3 shadow-sm">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="flex items-center gap-2">
          <AiLogo ai={ai} className="size-7" />
          <span>
            <span className="text-muted">{t.aiCard.yourAi}</span> {p.name}
          </span>
        </span>
        <Link href="/ai" className="text-muted underline underline-offset-2">
          {t.common.settings}
        </Link>
      </div>
      {nearlyEmpty && (
        <OpenChat
          url={p.chatUrl(AI_REQUESTS.fill)}
          request={AI_REQUESTS.fill}
          copy={!p.prefills}
          title={t.aiCard.fill[0]}
          text={t.aiCard.fill[1]}
        />
      )}
      <div className="grid grid-cols-2 gap-2">
        <OpenChat
          url={p.chatUrl(AI_REQUESTS.scan)}
          request={AI_REQUESTS.scan}
          copy={!p.prefills}
          title={t.aiCard.scan[0]}
          text={t.aiCard.scan[1]}
        />
        <OpenChat
          url={p.chatUrl(AI_REQUESTS.drink)}
          request={AI_REQUESTS.drink}
          copy={!p.prefills}
          title={t.aiCard.drink[0]}
          text={t.aiCard.drink[1]}
        />
      </div>
      {!p.prefills && <p className="text-xs text-muted">{t.aiCard.copied(p.name)}</p>}
    </div>
  );
}
