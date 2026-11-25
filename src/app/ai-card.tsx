import Link from "next/link";
import { AI_PROVIDERS, AI_REQUESTS, type AiKey } from "@/lib/ai-providers";
import { OpenChat } from "./open-chat";

/**
 * The AI on the main screen, in two states:
 * - not connected: one card that says what a connected AI does, and leads to setting it up;
 * - connected: the household's AI by name, with the two tasks as buttons
 *   that open that AI's chat with the request already typed.
 * Pending drafts get their own line, since they wait on the user.
 */
export function AiCard({ connected, pendingDrafts }: { connected: AiKey | null; pendingDrafts: number }) {
  return (
    <section aria-label="בינה מלאכותית" className="flex flex-col gap-2">
      {connected ? <Connected ai={connected} /> : <NotConnected />}
      {pendingDrafts > 0 && (
        <Link href="/ai" className="flex items-center justify-between rounded-xl bg-accent/15 px-4 py-2 text-sm">
          <span>{pendingDrafts === 1 ? "בקבוק אחד מה־AI מחכה לאישור שלכם" : `${pendingDrafts} בקבוקים מה־AI מחכים לאישור שלכם`}</span>
          <span aria-hidden="true">←</span>
        </Link>
      )}
    </section>
  );
}

function NotConnected() {
  return (
    <Link href="/ai" className="flex flex-col gap-1 rounded-xl border border-accent/30 bg-surface p-4 shadow-sm hover:border-accent">
      <span className="font-medium">חברו AI למרתף</span>
      <span className="text-sm text-muted">
        <span className="inline-block">צלמו תווית, והבקבוקים מחכים כאן לאישור.</span>{" "}
        <span className="inline-block">שאלו מה לפתוח הערב, והתשובה לפי מה שבמקרר.</span>
      </span>
      <span className="text-sm text-accent">עם Claude, ChatGPT או Gemini ←</span>
    </Link>
  );
}

function Connected({ ai }: { ai: AiKey }) {
  const p = AI_PROVIDERS[ai];
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-accent/30 bg-surface p-3 shadow-sm">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span>
          <span className="text-muted">ה־AI שלכם:</span> {p.name}
        </span>
        <Link href="/ai" className="text-muted underline underline-offset-2">
          הגדרות
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <OpenChat
          url={p.chatUrl(AI_REQUESTS.scan)}
          request={AI_REQUESTS.scan}
          copy={!p.prefills}
          title="הוספה מצילום"
          text="פותח את הצ׳אט, ואתם מצרפים צילום"
        />
        <OpenChat
          url={p.chatUrl(AI_REQUESTS.drink)}
          request={AI_REQUESTS.drink}
          copy={!p.prefills}
          title="מה לפתוח הערב?"
          text="פותח את הצ׳אט, ואתם מוסיפים את האירוע"
        />
      </div>
      {!p.prefills && <p className="text-xs text-muted">הקישור ל־{p.name} לא יכול להכיל בקשה מוכנה, אז היא מועתקת. הדביקו אותה בצ׳אט.</p>}
    </div>
  );
}
