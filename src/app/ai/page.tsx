import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth";
import { DRINK_STATES } from "@/lib/drink-state";
import { parseBottleDraft } from "@/lib/drafts";
import { getCellarBottles } from "@/lib/fridges";
import { buildRows, EMPTY_FILTERS } from "@/lib/bottle-list";
import { createClient } from "@/lib/supabase/server";
import { AiTools, type PendingDraft } from "./ai-tools";
import { ConnectAi } from "./connect-ai";
import { ConnectedAis } from "./connected-ais";
import { BackLink } from "@/components/back-link";

export const metadata: Metadata = { title: "בינה מלאכותית · מרתף יין" };

export default function AiPage({ searchParams }: { searchParams: Promise<{ task?: string }> }) {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-1">
        <BackLink href="/" label="המקרר" />
        <h1 className="text-2xl font-bold">בינה מלאכותית</h1>
        <p className="text-sm text-muted">
          <span className="inline-block">האתר לא שולח את הנתונים שלכם לשום AI.</span>{" "}
          <span className="inline-block">אתם מעתיקים לבינה שלכם, ומה שהיא מציעה מחכה כאן לאישור.</span>
        </p>
      </header>
      <Suspense fallback={<p className="text-muted">טוען…</p>}>
        <WithData searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function WithData({ searchParams }: { searchParams: Promise<{ task?: string }> }) {
  const initialTask = (await searchParams).task === "drink" ? "drink" : "add";
  const user = await getCurrentUser();
  if (!user.canEdit) redirect("/more"); // drafts are for the household's editors (RLS too)
  const supabase = await createClient();
  const [bottles, draftsRes] = await Promise.all([
    getCellarBottles(user.cellarId),
    supabase
      .from("drafts")
      .select("id, payload, source, created_at")
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
  const drafts: PendingDraft[] = (draftsRes.data ?? []).flatMap((d) => {
    const r = parseBottleDraft(d.payload, year);
    return r.ok ? [{ id: d.id, source: d.source, draft: r.draft }] : [];
  });

  return (
    <>
      <ConnectedAis />
      <AiTools cellar={cellar} drafts={drafts} cellarId={user.cellarId} initialTask={initialTask} />
      <ConnectAi />
    </>
  );
}
