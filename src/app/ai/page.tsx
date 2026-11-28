import { AiChanges, type AiChange } from "./ai-changes";
import { pageTitle } from "@/i18n/metadata";
import { getLocale, getT } from "@/i18n/server";
import type { Dictionary } from "@/i18n/dictionaries";
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

export const generateMetadata = pageTitle((t) => t.titles.ai);

export default async function AiPage() {
  const t = await getT();
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-1">
        <BackLink href="/" label={t.friends.toMine} />
        <h1 className="text-2xl font-bold">{t.ai.title}</h1>
        <p className="text-sm text-muted">
          <span className="inline-block">{t.ai.intro[0]}</span>{" "}
          <span className="inline-block">{t.ai.intro[1]}</span>
        </p>
      </header>
      <Suspense fallback={<p className="text-muted">{t.common.loading}</p>}>
        <WithData />
      </Suspense>
    </main>
  );
}

/** The changes list looks back this far (an ISO date for the query). */
function daysAgo(days: number): string {
  return new Date(Date.now() - days * 86400000).toISOString();
}

async function WithData() {
  const [user, t, locale] = await Promise.all([getCurrentUser(), getT(), getLocale()]);
  if (!user.canEdit) redirect("/"); // drafts are for the household's editors (RLS too)
  const supabase = await createClient();
  const since = daysAgo(30);
  const [bottles, fridges, loose, ais, draftsRes, changesRes] = await Promise.all([
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
    // What an AI changed by itself in the last 30 days and was not undone.
    supabase
      .from("drafts")
      .select("id, kind, payload, undo, decided_at")
      .eq("cellar_id", user.cellarId)
      .eq("applied_by_ai", true)
      .is("undone_at", null)
      .gte("decided_at", since)
      .order("decided_at", { ascending: false })
      .limit(50),
  ]);
  const changes: AiChange[] = (changesRes.data ?? []).map((c) => {
    const p = (c.payload ?? {}) as { winery?: string; name?: string; year?: number | null; fridge?: string; created?: boolean };
    const undo = (c.undo ?? {}) as { bottles?: unknown[] };
    return {
      id: c.id,
      kind: c.kind as AiChange["kind"],
      title: c.kind === "fridge" ? (p.fridge ?? "") : `${p.winery ?? ""} – ${p.name ?? ""} ${p.year ?? ""}`.trim(),
      created: c.kind === "fridge" && p.created === true,
      count: undo.bottles?.length ?? 1,
      when: c.decided_at ?? "",
    };
  });

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
    const targetText = r.action.kind === "move" ? placeText(fridges, r.action.to, locale) : "";
    return [{ id: d.id, action: r.action, bottle, target, targetText }];
  });

  const connectedKeys = ais.flatMap((a) => (a.key ? [a.key] : []));
  const first = connectedKeys[0];

  return (
    <>
      {/* What waits on the user comes first. */}
      <PendingActions actions={actions} />
      <PendingDrafts drafts={drafts} fridges={fridges} cellarId={user.cellarId} />
      <AiChanges changes={changes} />

      {ais.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">{t.ai.connected}</h2>
          <ConnectedAis ais={ais} />
          {first && <Examples ai={first} t={t} />}
        </section>
      ) : (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">{t.ai.connectTitle}</h2>
          <p className="text-sm text-muted">
            <span className="inline-block">{t.ai.connectIntro[0]}</span>{" "}
            <span className="inline-block">{t.ai.connectIntro[1]}</span>
          </p>
          <ConnectAi />
        </section>
      )}

      {ais.length > 0 && CONNECTABLE.some((k) => !connectedKeys.includes(k)) && (
        <details className="flex flex-col gap-2">
          <summary className="cursor-pointer text-sm underline underline-offset-2">{t.ai.connectAnother}</summary>
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
function Examples({ ai, t }: { ai: AiKey; t: Dictionary }) {
  const examples = t.ai.examples;
  return (
    <div className="flex flex-col gap-1 rounded-xl bg-surface p-4 text-sm shadow-sm">
      <p className="text-muted">{t.ai.setup[ai].chatHint ?? t.ai.examplesFor(AI_PROVIDERS[ai].name)}</p>
      <ul className="flex flex-col gap-1">
        {examples.map((e) => (
          <li key={e}>״{e}״</li>
        ))}
      </ul>
    </div>
  );
}
