import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BackLink } from "@/components/back-link";
import { pageTitle } from "@/i18n/metadata";
import { getLocale, getT } from "@/i18n/server";
import { intlTag } from "@/i18n/locales";
import { FREE_DB_BYTES, FREE_STORAGE_BYTES, megabytes, percentOf } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { UsersPanel } from "./users-panel";

export const generateMetadata = pageTitle((t) => t.titles.admin);

/**
 * The app owner's page (spec: "עמוד ניהול", ADR 0011). Numbers, users and
 * a log of admin actions; never the contents of anyone's cellar. Anyone who
 * is not an admin gets a plain 404, so the page does not reveal it exists.
 * Every number and action is checked again in the database.
 */
export default async function AdminPage() {
  const t = await getT();
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-1">
        <BackLink href="/settings" label={t.settings.title} />
        <h1 className="text-2xl font-bold">{t.admin.title}</h1>
        <p className="text-muted">{t.admin.intro}</p>
      </header>
      <Suspense fallback={<p className="text-muted">{t.common.loading}</p>}>
        <AdminData />
      </Suspense>
    </main>
  );
}

type Overview = Record<
  | "users" | "new_7d" | "new_30d" | "active_7d" | "active_30d" | "banned" | "cellars" | "shared_cellars"
  | "bottles" | "consumed" | "wines" | "fridges" | "friendships" | "share_links" | "imports_30d"
  | "ai_connections" | "label_files" | "label_bytes" | "orphan_files" | "db_bytes",
  number
>;

async function AdminData() {
  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc("is_app_admin");
  if (!isAdmin) notFound();

  const [t, locale, overview, users, actions] = await Promise.all([
    getT(),
    getLocale(),
    supabase.rpc("admin_overview"),
    supabase.rpc("admin_users"),
    supabase.from("admin_actions").select("id, action, target_name, reason, created_at").order("id", { ascending: false }).limit(50),
  ]);
  const o = overview.data as Overview | null;
  if (!o) return <p role="alert">{t.admin.loadFailed}</p>;
  const a = t.admin;
  const date = (iso: string) => new Date(iso).toLocaleDateString(intlTag(locale), { day: "numeric", month: "short" });

  const groups: { title: string; items: [string, number][] }[] = [
    {
      title: a.groups.people,
      items: [
        [a.stats.users, o.users],
        [a.stats.active7, o.active_7d],
        [a.stats.active30, o.active_30d],
        [a.stats.new7, o.new_7d],
        [a.stats.new30, o.new_30d],
        [a.stats.banned, o.banned],
      ],
    },
    {
      title: a.groups.cellars,
      items: [
        [a.stats.cellars, o.cellars],
        [a.stats.sharedCellars, o.shared_cellars],
        [a.stats.fridges, o.fridges],
        [a.stats.bottles, o.bottles],
        [a.stats.consumed, o.consumed],
        [a.stats.wines, o.wines],
      ],
    },
    {
      title: a.groups.usage,
      items: [
        [a.stats.friendships, o.friendships],
        [a.stats.shareLinks, o.share_links],
        [a.stats.imports30, o.imports_30d],
        [a.stats.aiConnections, o.ai_connections],
        [a.stats.labelFiles, o.label_files],
      ],
    },
  ];

  return (
    <>
      {groups.map((g) => (
        <section key={g.title} className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">{g.title}</h2>
          <dl className="grid grid-cols-3 gap-2">
            {g.items.map(([label, value]) => (
              <div key={label} className="flex flex-col rounded-xl bg-surface p-3 shadow-sm">
                <dt className="text-xs text-muted">{label}</dt>
                <dd className="text-xl font-semibold tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">{a.groups.limits}</h2>
        <Meter label={a.dbSize} used={o.db_bytes} limit={FREE_DB_BYTES} text={a.ofLimit(megabytes(o.db_bytes), megabytes(FREE_DB_BYTES))} />
        <Meter
          label={a.photosSize}
          used={o.label_bytes}
          limit={FREE_STORAGE_BYTES}
          text={a.ofLimit(megabytes(o.label_bytes), megabytes(FREE_STORAGE_BYTES))}
        />
        {o.orphan_files > 0 && <p className="text-sm text-muted">{a.orphans(o.orphan_files)}</p>}
        <p className="text-xs text-muted">{a.limitsNote}</p>
      </section>

      <UsersPanel users={users.data ?? []} />

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">{a.logTitle}</h2>
        {(actions.data ?? []).length === 0 ? (
          <p className="text-sm text-muted">{a.logEmpty}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-muted/15 rounded-xl bg-surface text-sm shadow-sm">
            {(actions.data ?? []).map((row) => (
              <li key={row.id} className="flex flex-col gap-0.5 px-3 py-2">
                <span>
                  <span className="font-medium">{a.actions[row.action as keyof typeof a.actions]}</span>{" "}
                  <span dir="auto">{row.target_name ?? a.deletedUser}</span>
                </span>
                <span className="text-xs text-muted">
                  {date(row.created_at)}
                  {row.reason && (
                    <>
                      {" · "}
                      <span dir="auto">{row.reason}</span>
                    </>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function Meter({ label, used, limit, text }: { label: string; used: number; limit: number; text: string }) {
  const pct = percentOf(used, limit);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-sm">
        <span>{label}</span>
        <span className="text-muted tabular-nums">{text}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted/20" role="meter" aria-label={label} aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className={`h-full rounded-full ${pct >= 80 ? "bg-red-600" : "bg-accent"}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
