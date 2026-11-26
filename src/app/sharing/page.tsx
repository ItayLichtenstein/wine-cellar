import { pageTitle } from "@/i18n/metadata";
import { Suspense } from "react";
import { BackLink } from "@/components/back-link";
import { getT } from "@/i18n/server";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { CellarName } from "./cellar-name";
import { Friends } from "./friends";
import { Household, type Member } from "./household";
import { ShareLink } from "./share-link";

export const generateMetadata = pageTitle((t) => t.titles.sharing);

/**
 * Everyone who sees the cellar. Friends first, since that's what people come
 * here for most; then partners who run the cellar with us; then a view link
 * for people without an account.
 */
export default async function SharingPage() {
  const t = await getT();
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-8 px-4 py-8">
      <header className="flex flex-col gap-1">
        <BackLink href="/" label={t.friends.toMine} />
        <h1 className="text-2xl font-bold">{t.sharing.title}</h1>
      </header>
      <Suspense fallback={<p className="text-muted">{t.common.loading}</p>}>
        <FriendsSection />
        <OurCellar />
        <ShareSection />
      </Suspense>
    </main>
  );
}

async function OurCellar() {
  const [user, supabase, t] = await Promise.all([getCurrentUser(), createClient(), getT()]);
  const [{ data }, { data: cellar }] = await Promise.all([
    supabase.from("cellar_members").select("user_id, profiles(display_name)").eq("cellar_id", user.cellarId).order("joined_at"),
    supabase.from("cellars").select("custom_name").eq("id", user.cellarId).maybeSingle(),
  ]);
  const members: Member[] = (data ?? []).map((m) => ({
    userId: m.user_id,
    name: m.profiles?.display_name ?? "",
  }));
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold">{t.sharing.partnersTitle}</h2>
      <p className="text-sm text-muted">
        <span className="inline-block">{t.sharing.partnersIntro[0]}</span> <span className="inline-block">{t.sharing.partnersIntro[1]}</span>
      </p>
      <CellarName
        cellarId={user.cellarId}
        names={members.map((m) => m.name)}
        customName={cellar?.custom_name ?? null}
        canEdit={user.canEdit}
      />
      <Household members={members} me={user.id} />
    </section>
  );
}

async function FriendsSection() {
  const [user, supabase] = await Promise.all([getCurrentUser(), createClient()]);
  const [{ data }, { data: custom }] = await Promise.all([supabase.rpc("my_friends"), supabase.rpc("friend_cellar_names")]);
  const friends = (data ?? []).map((f) => ({
    cellarId: f.cellar_id,
    names: f.names,
    customName: custom?.find((c) => c.cellar_id === f.cellar_id)?.custom_name ?? null,
    iShowPrices: f.i_show_prices,
    theyShowPrices: f.they_show_prices,
  }));
  return <Friends friends={friends} canEdit={user.canEdit} />;
}

async function ShareSection() {
  const [user, supabase] = await Promise.all([getCurrentUser(), createClient()]);
  if (!user.canEdit) return null;
  const { data } = await supabase
    .from("share_links")
    .select("hide_prices")
    .eq("cellar_id", user.cellarId)
    .is("revoked_at", null)
    .maybeSingle();
  return <ShareLink active={data ? { hidePrices: data.hide_prices } : null} />;
}
