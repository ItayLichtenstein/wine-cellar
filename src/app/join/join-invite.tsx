"use client";

import { useT } from "@/i18n/provider";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const KEY = "invite-token";
const TOKEN = /^[0-9a-f]{64}$/;

type State = "loading" | "no-token" | "signed-out" | "ready" | "has-data" | "joining";

/**
 * The invite token arrives after "#" (/join#<token>): the part after "#" is
 * never sent to the server, so it stays out of server logs. It is kept in
 * sessionStorage (this tab only) so it survives the Google sign-in round
 * trip, and is removed from the address bar right away.
 */
export function JoinInvite() {
  const j = useT().join;
  const [state, setState] = useState<State>("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fromHash = window.location.hash.slice(1);
    try {
      if (TOKEN.test(fromHash)) sessionStorage.setItem(KEY, fromHash);
    } catch {
      // storage blocked – the token is still usable in this page view
    }
    if (fromHash) history.replaceState(null, "", "/join");
    const token = TOKEN.test(fromHash) ? fromHash : readStored();
    createClient()
      .auth.getClaims()
      .then(({ data }) => setState(!token ? "no-token" : data?.claims?.sub ? "ready" : "signed-out"));
  }, []);

  async function join(bringData = false) {
    const token = readStored();
    if (!token) return setState("no-token");
    setState("joining");
    setError(null);
    const { error: rpcError } = await createClient().rpc("accept_invite", { p_token: token, p_bring_data: bringData });
    if (!rpcError) {
      forget();
      window.location.assign("/"); // full reload: the whole app now shows the shared cellar
      return;
    }
    setState("ready");
    if (rpcError.code === "P0002") {
      forget();
      setError(j.usedUp);
    } else if (rpcError.code === "23505") {
      forget();
      setError(j.already);
    } else if (rpcError.hint === "has_data") {
      setState("has-data"); // ask first: the old cellar will be merged and deleted
    } else if (rpcError.hint === "last_member") {
      setError(j.lastMember);
    } else {
      setError(j.failed);
    }
  }

  if (state === "loading") return <p className="text-muted">{j.wait}</p>;
  if (state === "no-token") return <p className="text-muted">{j.noToken}</p>;
  if (state === "signed-out") {
    return (
      <>
        <p className="text-muted">{j.signInFirst}</p>
        <Link href="/login?next=/join" className="rounded-full bg-accent px-5 py-3 font-medium text-white dark:text-black">
          {j.signIn}
        </Link>
      </>
    );
  }
  if (state === "has-data") {
    return (
      <>
        <div className="rounded-xl bg-amber-50 p-4 text-start text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">
          <p className="mb-2 font-semibold">{j.haveBottles}</p>
          <ul className="list-disc space-y-1 ps-5">
            <li>{j.moveBottles}</li>
            <li>{j.moveOutside}</li>
            <li>{j.notMoved}</li>
          </ul>
        </div>
        <button type="button" onClick={() => join(true)} className="rounded-full bg-accent px-5 py-3 font-medium text-white dark:text-black">
          {j.joinWithBottles}
        </button>
        <Link href="/" className="text-sm text-muted underline underline-offset-2">
          {j.notNow}
        </Link>
      </>
    );
  }

  return (
    <>
      <p className="text-muted">
        <span className="inline-block">{j.shared[0]}</span>{" "}
        <span className="inline-block">{j.shared[1]}</span>
      </p>
      <button
        type="button"
        onClick={() => join()}
        disabled={state === "joining"}
        className="rounded-full bg-accent px-5 py-3 font-medium text-white disabled:opacity-60 dark:text-black"
      >
        {state === "joining" ? j.joining : j.join}
      </button>
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">
          {error}
        </p>
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
    // nothing to forget
  }
}
