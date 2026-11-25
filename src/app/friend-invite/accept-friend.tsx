"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { cellarTitle } from "@/lib/cellar-title";
import { createClient } from "@/lib/supabase/client";

const KEY = "friend-invite-token";
const TOKEN = /^[0-9a-f]{64}$/;

type State = "loading" | "invalid" | "signed-out" | "ready" | "accepting";

/**
 * Same token handling as the household invite (/join): the token comes
 * after "#", so it never reaches a server log, and waits in sessionStorage
 * through the Google sign-in.
 */
export function AcceptFriend() {
  const router = useRouter();
  const [state, setState] = useState<State>("loading");
  const [from, setFrom] = useState("");
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
      const { data: names } = await supabase.rpc("peek_friend_invite", { p_token: token });
      if (!names) return setState("invalid");
      setFrom(cellarTitle(names));
      setState("ready");
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
      setError("אתם כבר חברים.");
    } else if (e?.code === "23514") {
      setError("זה הקישור של המרתף שלכם. שלחו אותו לחבר.");
    } else if (e?.code === "42501") {
      setError("רק שותף במרתף יכול לאשר חברות.");
    } else {
      setError("האישור לא הצליח. נסו שוב.");
    }
  }

  if (state === "loading") return <p className="text-muted">רגע…</p>;
  if (state === "invalid") {
    return (
      <p className="text-muted">
        <span className="inline-block">הקישור לא תקף:</span>{" "}
        <span className="inline-block">הוא שומש, לא שלם או שעברו 7 ימים.</span>{" "}
        <span className="inline-block">בקשו מהחבר קישור חדש.</span>
      </p>
    );
  }
  if (state === "signed-out") {
    return (
      <>
        <p className="text-muted">כדי לאשר צריך קודם להתחבר.</p>
        <Link href="/login?next=/friend-invite" className="rounded-full bg-accent px-5 py-3 font-medium text-white dark:text-black">
          התחברות
        </Link>
      </>
    );
  }

  return (
    <>
      <p>
        <span className="inline-block font-semibold" dir="auto">{from}</span>{" "}
        <span className="inline-block">מזמין אתכם להיות חברים.</span>
      </p>
      <p className="text-sm text-muted">
        <span className="inline-block">תוכלו לראות את המרתף שלהם,</span>{" "}
        <span className="inline-block">והם את שלכם. רק צפייה.</span>
      </p>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={showPrices} onChange={(e) => setShowPrices(e.target.checked)} className="size-4 accent-accent" />
        הם יראו את המחירים שלנו
      </label>
      <button
        type="button"
        onClick={accept}
        disabled={state === "accepting"}
        className="rounded-full bg-accent px-5 py-3 font-medium text-white disabled:opacity-60 dark:text-black"
      >
        {state === "accepting" ? "מאשרים…" : "אישור חברות"}
      </button>
      {error && <p className="text-sm text-red-700 dark:text-red-400">{error}</p>}
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
