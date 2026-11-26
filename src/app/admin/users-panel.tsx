"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { inputClass } from "@/app/bottle/details";
import { useT } from "@/i18n/provider";
import { daysAgo } from "@/lib/admin";
import { createClient } from "@/lib/supabase/client";

export type AdminUser = {
  user_id: string;
  display_name: string;
  created_at: string;
  last_active: string | null;
  cellar_name: string | null;
  members: number;
  bottles: number;
  banned: boolean;
  is_admin: boolean;
  is_me: boolean;
};

type Action = "ban" | "unban" | "sign_out" | "delete_user" | "add_admin" | "remove_admin";

/**
 * The user list with a search box. Tapping a user opens their actions.
 * Destructive actions ask once, with an optional reason that goes to the log;
 * deleting also asks to type the confirmation word.
 */
export function UsersPanel({ users }: { users: AdminUser[] }) {
  const a = useT().admin;
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const now = useMemo(() => new Date(), []);
  const q = query.trim().toLowerCase();
  const shown = q ? users.filter((u) => `${u.display_name} ${u.cellar_name ?? ""}`.toLowerCase().includes(q)) : users;

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold">{a.usersTitle(users.length)}</h2>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={a.search}
        aria-label={a.search}
        dir="auto"
        className={inputClass}
      />
      <ul className="flex flex-col divide-y divide-muted/15 rounded-xl bg-surface shadow-sm">
        {shown.map((u) => {
          const days = daysAgo(u.last_active, now);
          return (
            <li key={u.user_id}>
              <button
                type="button"
                onClick={() => setOpen(open === u.user_id ? null : u.user_id)}
                aria-expanded={open === u.user_id}
                className="flex w-full flex-col items-start gap-0.5 px-3 py-2.5 text-start"
              >
                <span className="flex flex-wrap items-center gap-1.5 font-medium">
                  <span dir="auto">{u.display_name}</span>
                  {u.is_me && <Tag>{a.you}</Tag>}
                  {u.is_admin && <Tag>{a.adminTag}</Tag>}
                  {u.banned && <Tag danger>{a.bannedTag}</Tag>}
                </span>
                <span className="text-xs text-muted">
                  {days === null ? a.neverActive : a.activeAgo(days)} · {a.bottlesCount(u.bottles)}
                  {u.members > 1 && ` · ${a.partners(u.members)}`}
                </span>
              </button>
              {open === u.user_id && <UserActions user={u} />}
            </li>
          );
        })}
      </ul>
      {shown.length === 0 && <p className="text-sm text-muted">{a.noMatch}</p>}
    </section>
  );
}

function Tag({ children, danger }: { children: React.ReactNode; danger?: boolean }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs ${danger ? "bg-red-700 text-white" : "bg-muted/20 text-muted"}`}>{children}</span>
  );
}

function UserActions({ user }: { user: AdminUser }) {
  const a = useT().admin;
  const router = useRouter();
  const [asking, setAsking] = useState<Action | null>(null);
  const [reason, setReason] = useState("");
  const [word, setWord] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "failed">("idle");

  async function run(action: Action) {
    setState("busy");
    const supabase = createClient();
    const r = reason.trim() || undefined;
    const { error } =
      action === "ban" || action === "unban"
        ? await supabase.rpc("admin_set_ban", { p_user: user.user_id, p_ban: action === "ban", p_reason: r })
        : action === "sign_out"
          ? await supabase.rpc("admin_sign_out", { p_user: user.user_id, p_reason: r })
          : action === "delete_user"
            ? await supabase.rpc("admin_delete_user", { p_user: user.user_id, p_reason: r })
            : await supabase.rpc("admin_set_admin", { p_user: user.user_id, p_on: action === "add_admin" });
    if (error) return setState("failed");
    setState("idle");
    setAsking(null);
    setReason("");
    setWord("");
    router.refresh();
  }

  const joined = new Date(user.created_at).toLocaleDateString();
  const choices: Action[] = user.is_me
    ? []
    : [user.banned ? "unban" : "ban", "sign_out", user.is_admin ? "remove_admin" : "add_admin", "delete_user"];

  return (
    <div className="flex flex-col gap-2 px-3 pb-3 text-sm">
      <p className="text-muted">
        <span dir="auto">{user.cellar_name ?? a.noCellar}</span> · {a.joined(joined)}
      </p>
      {user.is_me && <p className="text-muted">{a.selfNote}</p>}
      {!asking ? (
        <div className="flex flex-wrap gap-2">
          {choices.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setAsking(c)}
              className={`rounded-full border px-3 py-1.5 ${c === "delete_user" || c === "ban" ? "border-red-700/50 text-red-700 dark:text-red-400" : "border-muted/40"}`}
            >
              {a.buttons[c]}
            </button>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-2 rounded-lg border border-muted/30 p-3">
          <p className="font-medium">{a.confirm[asking]}</p>
          {asking !== "add_admin" && asking !== "remove_admin" && asking !== "unban" && (
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={300}
              placeholder={a.reason}
              aria-label={a.reason}
              dir="auto"
              className={inputClass}
            />
          )}
          {asking === "delete_user" && (
            <input
              value={word}
              onChange={(e) => setWord(e.target.value)}
              placeholder={a.typeWord(a.deleteWord)}
              aria-label={a.typeWord(a.deleteWord)}
              dir="auto"
              className={inputClass}
            />
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => run(asking)}
              disabled={state === "busy" || (asking === "delete_user" && word.trim() !== a.deleteWord)}
              className="rounded-full bg-accent px-4 py-1.5 font-medium text-white disabled:opacity-50 dark:text-black"
            >
              {a.buttons[asking]}
            </button>
            <button type="button" onClick={() => setAsking(null)} className="rounded-full border border-muted/40 px-4 py-1.5">
              {a.cancel}
            </button>
          </div>
        </div>
      )}
      {state === "failed" && (
        <p role="alert" className="text-red-700 dark:text-red-400">
          {a.failed}
        </p>
      )}
    </div>
  );
}
