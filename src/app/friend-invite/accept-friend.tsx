"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useLocale, useT } from "@/i18n/provider";
import { cellarTitle } from "@/lib/cellar-title";
import { createClient } from "@/lib/supabase/client";

const KEY = "friend-invite-token";
const TOKEN = /^[0-9a-f]{64}$/;

type State = "loading" | "invalid" | "own" | "friends" | "signed-out" | "ready" | "accepting";

/**
 * Same token handling as the household invite (/join): the token comes
 * after "#", so it never reaches a server log, and waits in sessionStorage
 * through the Google sign-in.
 */
export function AcceptFriend() {
  const t = useT();
  const locale = useLocale();
  const f = t.friendInvite;
  const router = useRouter();
  const [state, setState] = useState<State>("loading");
  const [names, setNames] = useState<string[]>([]);
  const [friendCellar, setFriendCellar] = useState<string | null>(null);
  const [showPrices, setShowPrices] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fromHash = window.location.hash.slice(1);
    try {
      if (TOKEN.test(fromHash)) sessionStorage.setItem(KEY, fromHash);
    } catch {
      // storage blocked – the token is still usable in this page view
    }
    if (fromHash) history.replaceState(null, "", "/friend-invite");
    const token = TOKEN.test(fromHash) ? fromHash : readStored();
    const supabase = createClient();
    supabase.auth.getClaims().then(async ({ data }) => {
      if (!token) return setState("invalid");
      if (!data?.claims?.sub) return setState("signed-out");
      // One call says what to show: ok / friends / own / invalid.
      const { data: rows } = await supabase.rpc("friend_invite_status", { p_token: token });
      const row = rows?.[0];
      if (!row || row.status === "invalid") {
        forget();
        return setState("invalid");
      }
      if (row.status !== "ok") forget();
      setNames(row.names ?? []);
      setFriendCellar(row.cellar_id);
      setState(row.status === "friends" ? "friends" : row.status === "own" ? "own" : "ready");
    });
  }, []);

  async function accept() {
    const token = readStored();
    if (!token) return setState("invalid");
    setState("accepting");
    setError(null);
    const { data, error: e } = await createClient().rpc("accept_friend_invite", { p_token: token, p_shows_prices: showPrices });
    if (!e && data) {
      forget();
      router.push(`/friends/${data}`);
      return;
    }
    setState("ready");
    if (e?.code === "P0002") {
      forget();
      setState("invalid");
    } else if (e?.code === "23505") {
      forget();
      setState("friends");
    } else if (e?.code === "23514") {
      setState("own");
    } else if (e?.code === "42501") {
      setError(f.onlyMember);
    } else {
      setError(f.failed);
    }
  }

  const cellar = cellarTitle(names, null, locale);
  const backHome = (
    <Link href="/" className="rounded-full border border-muted/40 px-5 py-3">
      {f.toMine}
    </Link>
  );

  if (state === "loading") return <p className="text-muted">{f.wait}</p>;

  if (state === "friends") {
    return (
      <>
        <div className="text-5xl" aria-hidden="true">🥂</div>
        <h1 className="text-2xl font-bold">{f.alreadyTitle}</h1>
        <p className="text-muted" dir="auto">{f.alreadyText(cellar)}</p>
        {friendCellar && (
          <Link href={`/friends/${friendCellar}`} className="rounded-full bg-accent px-5 py-3 font-medium text-white dark:text-black">
            {f.toTheirs}
          </Link>
        )}
        {backHome}
      </>
    );
  }

  return (
    <>
      <div className="text-5xl" aria-hidden="true">🥂</div>
      <h1 className="text-2xl font-bold">{f.title}</h1>
      {state === "invalid" ? (
        <>
          <p className="text-muted">
            <span className="inline-block">{f.invalid}.</span> <span className="inline-block">{f.askNew}</span>
          </p>
          {backHome}
        </>
      ) : state === "own" ? (
        <>
          <p className="text-muted">{f.own}</p>
          {backHome}
        </>
      ) : state === "signed-out" ? (
        <>
          <p className="text-muted">{f.signInFirst}</p>
          <Link href="/login?next=/friend-invite" className="rounded-full bg-accent px-5 py-3 font-medium text-white dark:text-black">
            {f.signIn}
          </Link>
        </>
      ) : (
        <>
          <p>
            <span className="inline-block font-semibold" dir="auto">{cellar}</span>{" "}
            <span className="inline-block">{f.invites}</span>
          </p>
          <p className="text-sm text-muted">
            <span className="inline-block">{f.seeEachOther}</span> <span className="inline-block">{f.viewOnly}</span>
          </p>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={showPrices} onChange={(e) => setShowPrices(e.target.checked)} className="size-4 accent-accent" />
            {f.showPrices}
          </label>
          <button
            type="button"
            onClick={accept}
            disabled={state === "accepting"}
            className="rounded-full bg-accent px-5 py-3 font-medium text-white disabled:opacity-60 dark:text-black"
          >
            {state === "accepting" ? f.accepting : f.accept}
          </button>
          {error && <p className="text-sm text-red-700 dark:text-red-400">{error}</p>}
          {backHome}
        </>
      )}
    </>
  );
}

function readStored(): string | null {
  try {
    const t = sessionStorage.getItem(KEY);
    return t && TOKEN.test(t) ? t : null;
  } catch {
    return null;
  }
}

function forget() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // nothing stored
  }
}
