import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth";
import { DRINK_STATES } from "@/lib/drink-state";
import { parseBottleDraft, parseActionDraft } from "@/lib/drafts";
import { getCellarBottles, getFridges, getLooseBottles } from "@/lib/fridges";
import { buildRows, EMPTY_FILTERS } from "@/lib/bottle-list";
import { createClient } from "@/lib/supabase/server";
import { ManualTools, PendingDrafts, type PendingDraft } from "./ai-tools";
import { getConnectedAis } from "@/lib/ai-grants";
import { AI_PROVIDERS, type AiKey, CONNECTABLE } from "@/lib/ai-providers";
import { describeFridges, findBottle, placeText, resolvePlaces } from "@/lib/draft-places";
import { ConnectAi } from "./connect-ai";
import { PendingActions, type PendingAction } from "./pending-actions";
import { ConnectedAis } from "./connected-ais";
import { BackLink } from "@/components/back-link";

export const metadata: Metadata = { title: "בינה מלאכותית · מרתף יין" };

export default function AiPage() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-1">
        <BackLink href="/" label="המקרר" />
        <h1 className="text-2xl font-bold">בינה מלאכותית</h1>
        <p className="text-sm text-muted">
          <span className="inline-block">ה־AI רואה רק את המרתף שלכם, ולא יכול לשנות או למחוק כלום.</span>{" "}
          <span className="inline-block">בקבוקים שהוא מציע מחכים כאן לאישור שלכם.</span>
        </p>
      </header>
      <Suspense fallback={<p className="text-muted">טוען…</p>}>
        <WithData />
      </Suspense>
    </main>
  );
}

async function WithData() {
  const user = await getCurrentUser();
  if (!user.canEdit) redirect("/more"); // drafts are for the household's editors (RLS too)
  const supabase = await createClient();
  const [bottles, fridges, loose, ais, draftsRes] = await Promise.all([
    getCellarBottles(user.cellarId),
    getFridges(user.cellarId),
    getLooseBottles(user.cellarId),
    getConnectedAis(),
    supabase
      .from("drafts")
      .select("id, kind, payload, source, created_at")
      .eq("cellar_id", user.cellarId)
      .eq("status", "pending")
      .order("created_at"),
  ]);

  // One line per vintage for the prompt: the AI sees what we have and how ready it is.
  const cellar = buildRows(bottles, EMPTY_FILTERS, "state").map((r) => ({
    title: `${r.first.winery} – ${r.first.name}`,
    year: r.first.year,
    count: r.bottles.length,
    state: DRINK_STATES[r.first.state].label,
    where: r.first.where,
  }));

  const year = new Date().getFullYear();
  const rows = draftsRes.data ?? [];
  const drafts: PendingDraft[] = rows.flatMap((d) => {
    if (d.kind !== "add_bottles") return [];
    const r = parseBottleDraft(d.payload, year);
    return r.ok ? [{ id: d.id, source: d.source, draft: r.draft }] : [];
  });
  // "Drink it" / "move it": which bottle, and (for a move) whether the new place is free.
  const actions: PendingAction[] = rows.flatMap((d) => {
    if (d.kind === "add_bottles") return [];
    const r = parseActionDraft(d.kind, d.payload);
    if (!r.ok) return [];
    const bottle = findBottle(fridges, loose, r.action);
    const target = r.action.kind === "move" ? (resolvePlaces(fridges, [r.action.to])[0] ?? null) : null;
    const targetText = r.action.kind === "move" ? placeText(fridges, r.action.to) : "";
    return [{ id: d.id, action: r.action, bottle, target, targetText }];
  });

  const connectedKeys = ais.flatMap((a) => (a.key ? [a.key] : []));
  const first = connectedKeys[0];

  return (
    <>
      {/* What waits on the user comes first. */}
      <PendingActions actions={actions} />
      <PendingDrafts drafts={drafts} fridges={fridges} cellarId={user.cellarId} />

      {ais.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">מחובר למרתף</h2>
          <ConnectedAis ais={ais} />
          {first && <Examples ai={first} />}
        </section>
      ) : (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">חיבור AI למרתף</h2>
          <p className="text-sm text-muted">
            <span className="inline-block">פעם אחת מחברים, ומאז פשוט מדברים איתו:</span>{" "}
            <span className="inline-block">שולחים צילום של תווית או קבלה, ושואלים מה לפתוח הערב.</span>
          </p>
          <ConnectAi />
        </section>
      )}

      {ais.length > 0 && CONNECTABLE.some((k) => !connectedKeys.includes(k)) && (
        <details className="flex flex-col gap-2">
          <summary className="cursor-pointer text-sm underline underline-offset-2">חיבור AI נוסף</summary>
          <div className="mt-2">
            <ConnectAi except={connectedKeys} />
          </div>
        </details>
      )}

      <ManualTools cellar={cellar} cellarId={user.cellarId} layout={describeFridges(fridges)} />
    </>
  );
}

/** What to say to the connected AI, so the first conversation is easy. */
function Examples({ ai }: { ai: AiKey }) {
  const examples = [
    "צילמתי את המדף העליון במקרר, תכניס את כל הבקבוקים למקום שלהם",
    "צילמתי את התווית הזו, תוסיף למרתף",
    "מה לפתוח הערב לארוחה איטלקית עם חברים?",
    "מה כדאי לשתות בקרוב לפני שיעבור השיא?",
    "איזה יין שתינו בקיץ ואהבנו במיוחד?",
  ];
  return (
    <div className="flex flex-col gap-1 rounded-xl bg-surface p-4 text-sm shadow-sm">
      <p className="text-muted">אפשר לבקש מ־{AI_PROVIDERS[ai].name}, למשל:</p>
      <ul className="flex flex-col gap-1">
        {examples.map((e) => (
          <li key={e}>״{e}״</li>
        ))}
      </ul>
    </div>
  );
}
