import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth";
import { fridgeCapacity } from "@/lib/fridge-layout";
import { getFridges } from "@/lib/fridges";
import { createClient } from "@/lib/supabase/server";
import { ExportButton } from "./export-button";
import { Friends } from "./friends";
import { ShareLink } from "./share-link";
import { Household, type Member } from "./household";
import { SignOutButton } from "./sign-out-button";

export const metadata: Metadata = { title: "עוד · מרתף יין" };

/** Settings and rarely used actions, kept off the main screen. */
export default function MorePage() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-8">
      <h1 className="text-2xl font-bold">עוד</h1>
      <Suspense fallback={<p className="text-muted">טוען…</p>}>
        <Fridges />
        <Members />
        <FriendsSection />
        <ShareSection />
        <Account />
      </Suspense>
      <Link href="/privacy" className="self-start text-sm text-muted underline underline-offset-2">
        מדיניות הפרטיות
      </Link>
    </main>
  );
}

async function Fridges() {
  const user = await getCurrentUser();
  const fridges = await getFridges(user.cellarId);
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold">המקררים שלי</h2>
      {fridges.length > 0 && (
        <ul className="flex flex-col divide-y divide-muted/20 rounded-xl bg-surface shadow-sm">
          {fridges.map((f) => (
            <li key={f.id} className="flex items-baseline justify-between gap-2 px-4 py-3">
              <span>
                {f.name}{" "}
                {user.canEdit && (
                  <Link href={`/fridges/${f.id}/edit`} className="text-sm underline underline-offset-2">
                    עריכה
                  </Link>
                )}
              </span>
              <span className="text-sm text-muted">
                {[f.brand, f.model].filter(Boolean).join(" ")}
                {f.brand || f.model ? " · " : ""}
                מקום ל־{fridgeCapacity(f.shelves)}
              </span>
            </li>
          ))}
        </ul>
      )}
      {user.canEdit && (
        <Link href="/fridges/new" className="self-start rounded-full border border-muted/40 px-4 py-2 text-sm">
          + הוספת מקרר
        </Link>
      )}
    </section>
  );
}

async function Members() {
  const [user, supabase] = await Promise.all([getCurrentUser(), createClient()]);
  const { data } = await supabase
    .from("cellar_members")
    .select("user_id, role, profiles(display_name)")
    .eq("cellar_id", user.cellarId)
    .order("joined_at");
  const members: Member[] = (data ?? []).map((m) => ({
    userId: m.user_id,
    name: m.profiles?.display_name ?? "",
    role: m.role,
  }));
  return <Household members={members} me={user.id} />;
}

async function FriendsSection() {
  const [user, supabase] = await Promise.all([getCurrentUser(), createClient()]);
  const { data } = await supabase.rpc("my_friends");
  const friends = (data ?? []).map((f) => ({
    cellarId: f.cellar_id,
    names: f.names,
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
    .select("hide_prices, hide_history")
    .eq("cellar_id", user.cellarId)
    .is("revoked_at", null)
    .maybeSingle();
  return <ShareLink active={data ? { hidePrices: data.hide_prices, hideHistory: data.hide_history } : null} />;
}

async function Account() {
  const user = await getCurrentUser();
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold">חשבון</h2>
      <p className="text-sm text-muted">מחובר בתור {user.displayName}</p>
      <ExportButton cellarId={user.cellarId} />
      <div>
        <SignOutButton />
      </div>
    </section>
  );
}
