import Link from "next/link";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth";
import { DRINK_STATES, DRINK_STATE_ORDER } from "@/lib/drink-state";
import { drinkNow } from "@/lib/bottle-list";
import { cellarTitle } from "@/lib/cellar-title";
import { getConnectedAis } from "@/lib/ai-grants";
import { createClient } from "@/lib/supabase/server";
import { getCellarBottles, getFridges, getLooseBottles } from "@/lib/fridges";
import { AiCard } from "./ai-card";
import { CellarView } from "./cellar-view";
import { GuideCard } from "./guide-card";
import { NamePrompt } from "./name-prompt";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-8">
      {/* Everything personal reads the session, so it streams in behind Suspense. */}
      <Suspense fallback={<p className="text-muted">טוען…</p>}>
        <Header />
        <Fridges />
      </Suspense>
    </main>
  );
}

async function Header() {
  const [user, supabase] = await Promise.all([getCurrentUser(), createClient()]);
  // Full members only, in joining order.
  const { data: members } = await supabase
    .from("cellar_members")
    .select("role, profiles(display_name)")
    .eq("cellar_id", user.cellarId)
    .eq("role", "member")
    .order("joined_at");
  const names = (members ?? []).map((m) => m.profiles?.display_name ?? "");
  return (
    <header>
      <h1 className="text-2xl font-bold" dir="auto">
        {cellarTitle(names)}
      </h1>
      <p className="text-sm text-muted">שלום {user.displayName}</p>
      {!user.onboarded && <NamePrompt userId={user.id} initial={user.displayName === "משתמש חדש" ? "" : user.displayName} />}
    </header>
  );
}

async function Fridges() {
  const user = await getCurrentUser();
  const [fridges, loose, all, drafts, ais] = await Promise.all([
    getFridges(user.cellarId),
    getLooseBottles(user.cellarId),
    getCellarBottles(user.cellarId),
    countPendingDrafts(user.cellarId, user.canEdit),
    user.canEdit ? getConnectedAis() : [],
  ]);
  // The first of the three assistants the user connected (any other MCP client has no chat link).
  const connected = ais.find((a) => a.key)?.key ?? null;

  if (fridges.length === 0) {
    return (
      <section className="flex flex-col items-center gap-4 rounded-2xl bg-surface p-8 text-center shadow-sm">
        <div className="text-4xl" aria-hidden="true">🧊</div>
        <h2 className="text-xl font-semibold">עוד אין כאן מקרר</h2>
        <p className="text-muted">
          <span className="inline-block">נתחיל מהבסיס:</span>{" "}
          <span className="inline-block">כמה מדפים יש, ואיך כל מדף מסודר.</span>
        </p>
        <Link href="/fridges/new" className="rounded-full bg-accent px-5 py-3 font-medium text-white dark:text-black">
          הגדרת המקרר הראשון
        </Link>
        <Link href="/guide" className="text-sm text-muted underline underline-offset-2">
          איך זה עובד? מדריך קצר למתחילים
        </Link>
      </section>
    );
  }

  const stored = fridges.flatMap((f) => f.shelves.flatMap((s) => s.zones.flatMap((z) => z.bottles)));
  const unplaced = loose.filter((b) => b.status === "unplaced").length;
  const inTransit = loose.length - unplaced;

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          {stored.length === 0 ? "המקרר עוד ריק" : stored.length === 1 ? "בקבוק אחד במקרר" : `${stored.length} בקבוקים במקרר`}
          {unplaced > 0 && ` · ${unplaced} מחוץ למקרר`}
          {inTransit > 0 && ` · ${inTransit} בדרך`}
        </p>
        {user.canEdit && (
          <Link href="/bottles/new" className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-white dark:text-black">
            + הוספת בקבוקים
          </Link>
        )}
      </div>

      <GuideCard />

      {/* A fridge with hardly any bottles yet: offer to fill it with the AI. */}
      {user.canEdit && <AiCard connected={connected} pendingDrafts={drafts} nearlyEmpty={stored.length + loose.length < 6} />}

      <CellarView fridges={fridges} loose={loose} drinkNow={drinkNow(all)} canEdit={user.canEdit} />

      {(stored.length > 0 || loose.length > 0) && <Legend />}
    </section>
  );
}

/** Drafts are for editors only (RLS too), so viewers skip the query. */
async function countPendingDrafts(cellarId: string, canEdit: boolean): Promise<number> {
  if (!canEdit) return 0;
  const supabase = await createClient();
  const { count } = await supabase
    .from("drafts")
    .select("id", { count: "exact", head: true })
    .eq("cellar_id", cellarId)
    .eq("status", "pending");
  return count ?? 0;
}

/** What the year-badge colors mean. */
function Legend() {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted" aria-label="מקרא צבעים">
      {DRINK_STATE_ORDER.filter((s) => s !== "none").map((s) => (
        <li key={s} className="flex items-center gap-1.5">
          <span className="size-3 rounded-sm" style={{ backgroundColor: DRINK_STATES[s].color }} aria-hidden="true" />
          {DRINK_STATES[s].label}
        </li>
      ))}
    </ul>
  );
}
