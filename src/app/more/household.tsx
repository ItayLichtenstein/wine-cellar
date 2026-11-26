"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type Member = { userId: string; name: string; role: "member" | "viewer" };

const ROLE = { member: "שותף", viewer: "צופה" } as const;

/** Household members, invite links, roles and leaving. */
export function Household({ members, me }: { members: Member[]; me: string }) {
  const router = useRouter();
  const [link, setLink] = useState<string | null>(null);
  const [inviteRole, setInviteRole] = useState<Member["role"]>("member");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const iAmMember = members.find((m) => m.userId === me)?.role === "member";

  async function call(fn: () => PromiseLike<{ error: { hint?: string } | null }>, ok: () => void) {
    setError(null);
    const { error: e } = await fn();
    if (!e) return ok();
    setError(
      e.hint === "last_member"
        ? "במרתף חייב להישאר לפחות שותף אחד."
        : e.hint === "alone"
          ? "את/ה היחיד/ה במרתף – אין ממה לעזוב."
          : "הפעולה לא הצליחה. נסו שוב.",
    );
  }

  async function invite() {
    setCopied(false);
    const { data, error: e } = await createClient().rpc("create_invite", { p_role: inviteRole });
    if (e || !data) return setError("לא הצלחנו ליצור קישור. נסו שוב.");
    // The token goes after "#": browsers never send that part to a server.
    setLink(`${window.location.origin}/join#${data}`);
  }

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section id="household" className="flex scroll-mt-4 flex-col gap-2">
      <h3 className="font-semibold">מי במרתף</h3>
      <ul className="flex flex-col divide-y divide-muted/20 rounded-xl bg-surface shadow-sm">
        {members.map((m) => (
          <li key={m.userId} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
            <span dir="auto">
              {m.name}
              {m.userId === me && <span className="text-muted"> (את/ה)</span>}
            </span>
            {iAmMember && m.userId !== me ? (
              <span className="flex items-center gap-3 text-sm">
                <select
                  value={m.role}
                  aria-label={`התפקיד של ${m.name}`}
                  onChange={(e) =>
                    call(
                      () => createClient().rpc("set_member_role", { p_user_id: m.userId, p_role: e.target.value as Member["role"] }),
                      () => router.refresh(),
                    )
                  }
                  className="rounded-lg border border-muted/40 bg-background px-2 py-1"
                >
                  <option value="member">{ROLE.member}</option>
                  <option value="viewer">{ROLE.viewer}</option>
                </select>
                <button
                  type="button"
                  onClick={() => call(() => createClient().rpc("remove_member", { p_user_id: m.userId }), () => router.refresh())}
                  className="text-muted underline underline-offset-2"
                >
                  הסרה
                </button>
              </span>
            ) : (
              <span className="text-sm text-muted">{ROLE[m.role]}</span>
            )}
          </li>
        ))}
      </ul>

      {iAmMember && (
        <div className="flex flex-col gap-2 rounded-xl bg-surface p-3 text-sm shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span>הזמנה של</span>
            <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value as Member["role"])} className="rounded-lg border border-muted/40 bg-background px-2 py-1">
              <option value="member">{ROLE.member} (יכול לערוך)</option>
              <option value="viewer">{ROLE.viewer} (קריאה בלבד)</option>
            </select>
            <button type="button" onClick={invite} className="rounded-full bg-accent px-3 py-1 font-medium text-white dark:text-black">
              יצירת קישור
            </button>
          </div>
          {link && (
            <>
              <p className="text-muted">
                <span className="inline-block">שלחו את הקישור לבן/בת הבית.</span>{" "}
                <span className="inline-block">הוא עובד פעם אחת ובתוקף 7 ימים.</span>
              </p>
              <div className="flex gap-2">
                <input readOnly value={link} dir="ltr" aria-label="קישור ההזמנה" className="min-w-0 flex-1 rounded-lg border border-muted/40 bg-background px-2 py-1 text-xs" />
                <button type="button" onClick={copy} className="rounded-full border border-muted/40 px-3 py-1">
                  {copied ? "הועתק ✓" : "העתקה"}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {members.length > 1 &&
        (confirmLeave ? (
          <p className="flex flex-wrap items-center gap-3 text-sm">
            <span>לעזוב? הבקבוקים וההיסטוריה נשארים כאן, ואת/ה מקבל/ת מרתף ריק.</span>
            <button
              type="button"
              onClick={() => call(() => createClient().rpc("leave_cellar"), () => window.location.assign("/"))}
              className="font-medium text-red-700 underline underline-offset-2 dark:text-red-400"
            >
              כן, לעזוב
            </button>
            <button type="button" onClick={() => setConfirmLeave(false)} className="text-muted underline underline-offset-2">
              ביטול
            </button>
          </p>
        ) : (
          <button type="button" onClick={() => setConfirmLeave(true)} className="self-start text-sm text-muted underline underline-offset-2">
            עזיבת המרתף
          </button>
        ))}

      {error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {error}
        </p>
      )}
    </section>
  );
}
