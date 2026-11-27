import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getLocale, getT } from "@/i18n/server";
import { getCurrentUser } from "@/lib/auth";
import { drinkNow } from "@/lib/bottle-list";
import { cellarTitle } from "@/lib/cellar-title";
import { getConnectedAis } from "@/lib/ai-grants";
import { GUIDE_SEEN_COOKIE, shouldOpenGuide } from "@/lib/guide-first";
import { getFriendList } from "@/lib/friend-list";
import { FriendsPicker } from "@/components/friends-picker";
import { createClient } from "@/lib/supabase/server";
import { getCellarBottles, getFridges, getLooseBottles } from "@/lib/fridges";
import { LineIcon } from "@/components/line-icon";
import { AiCard } from "./ai-card";
import { CellarView } from "./cellar-view";
import { LabelThumbBackfill } from "./label-thumb-backfill";
import { FirstSteps } from "./first-steps";
import { NamePrompt } from "./name-prompt";

export default async function Home() {
  const t = await getT();
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-8">
      {/* Everything personal reads the session, so it streams in behind Suspense. */}
      <Suspense fallback={<p className="text-muted">{t.common.loading}</p>}>
        <Header />
        <Fridges />
      </Suspense>
    </main>
  );
}

async function Header() {
  const [user, supabase, t, locale, jar] = await Promise.all([getCurrentUser(), createClient(), getT(), getLocale(), cookies()]);
  // First visit: the guide comes before anything else.
  if (shouldOpenGuide(user.onboarded, jar.get(GUIDE_SEEN_COOKIE)?.value)) redirect("/guide");
  // Full members only, in joining order.
  const { data: members } = await supabase
    .from("cellar_members")
    .select("role, profiles(display_name)")
    .eq("cellar_id", user.cellarId)
    .eq("role", "member")
    .order("joined_at");
  const names = (members ?? []).map((m) => m.profiles?.display_name ?? "");
  const [{ data: cellar }, friends] = await Promise.all([
    supabase.from("cellars").select("custom_name").eq("id", user.cellarId).maybeSingle(),
    getFriendList(),
  ]);
  return (
    <header>
      {/* Hebrew: the title follows its own text (a custom name may be English).
          English: "<name>'s cellar" must read left to right even with a Hebrew name. */}
      <h1 className="text-2xl font-bold" dir={locale === "en" ? "ltr" : "auto"}>
        {cellarTitle(names, cellar?.custom_name, locale)}
      </h1>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted">{t.home.hello(user.displayName)}</p>
        {/* Friends' fridges one tap away (before: More → Sharing, mid-page). */}
        <FriendsPicker friends={friends} />
      </div>
      {!user.onboarded && <NamePrompt userId={user.id} initial={user.displayName === "משתמש חדש" ? "" : user.displayName} />}
    </header>
  );
}

async function Fridges() {
  const [user, t] = await Promise.all([getCurrentUser(), getT()]);
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
        <span className="text-accent">
          <LineIcon name="fridge" className="size-10" strokeWidth={1.4} />
        </span>
        <h2 className="text-xl font-semibold">{t.home.noFridgeTitle}</h2>
        <p className="text-muted">
          <span className="inline-block">{t.home.noFridgeText[0]}</span>{" "}
          <span className="inline-block">{t.home.noFridgeText[1]}</span>
        </p>
        <Link href="/fridges/new" className="rounded-full bg-accent px-5 py-3 font-medium text-white dark:text-black">
          {t.home.setUpFirst}
        </Link>
        <Link href="/guide" className="text-sm text-muted underline underline-offset-2">
          {t.home.guideLink}
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
          {stored.length === 0 ? t.home.fridgeEmpty : t.home.inFridge(stored.length)}
          {unplaced > 0 && ` · ${t.home.outside(unplaced)}`}
          {inTransit > 0 && ` · ${t.home.onTheWay(inTransit)}`}
        </p>
        {user.canEdit && (
          <Link href="/bottles/new" className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-white dark:text-black">
            {t.home.addBottles}
          </Link>
        )}
      </div>

      {user.canEdit && user.firstSteps !== "closed" && (
        <FirstSteps userId={user.id} initial={user.firstSteps} done={{ bottle: all.length > 0, people: await hasPeople(user.cellarId) }} />
      )}

      {/* A fridge with hardly any bottles yet: offer to fill it with the AI. */}
      {user.canEdit && <AiCard connected={connected} pendingDrafts={drafts} nearlyEmpty={stored.length + loose.length < 6} />}

      <CellarView fridges={fridges} loose={loose} drinkNow={drinkNow(all)} canEdit={user.canEdit} />
      {user.canEdit && <LabelThumbBackfill cellarId={user.cellarId} />}

    </section>
  );
}

/** Someone to share with yet: a household partner or a friend. */
async function hasPeople(cellarId: string): Promise<boolean> {
  const supabase = await createClient();
  const [{ count }, friends] = await Promise.all([
    supabase.from("cellar_members").select("user_id", { count: "exact", head: true }).eq("cellar_id", cellarId),
    getFriendList(),
  ]);
  return (count ?? 0) > 1 || friends.length > 0;
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
