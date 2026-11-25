import Link from "next/link";

const ICONS = {
  // A camera: read labels or a receipt from a photo.
  scan: <path d="M4 8a2 2 0 0 1 2-2h2l1.5-2h5L16 6h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8Zm8 8a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />,
  // A wine glass: what to open tonight.
  drink: <path d="M8 3h8l-.5 6a3.5 3.5 0 0 1-7 0L8 3Zm4 9.5V20m-3.5 0h7M8.3 7h7.4" />,
} as const;

/**
 * The AI features, on the main screen where they are used (not buried in
 * "more"). One card per task, each saying what it does; pending drafts get
 * their own line, because they wait on the user.
 */
export function AiShortcuts({ pendingDrafts }: { pendingDrafts: number }) {
  const cards = [
    { href: "/ai?task=add", icon: ICONS.scan, title: "הוספה מצילום", text: "צלמו תווית או קבלה, וה־AI ימלא את הפרטים" },
    { href: "/ai?task=drink", icon: ICONS.drink, title: "מה לפתוח הערב?", text: "המלצה מה־AI לפי האירוע ומה שבמקרר" },
  ];
  return (
    <section aria-label="בינה מלאכותית" className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-3">
        {cards.map((c) => (
          <Link key={c.href} href={c.href} className="flex flex-col gap-1 rounded-xl border border-accent/30 bg-surface p-3 shadow-sm hover:border-accent">
            <svg viewBox="0 0 24 24" aria-hidden="true" className="size-6 text-accent" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
              {c.icon}
            </svg>
            <span className="font-medium">{c.title}</span>
            <span className="text-xs text-muted">{c.text}</span>
          </Link>
        ))}
      </div>
      {pendingDrafts > 0 && (
        <Link href="/ai" className="flex items-center justify-between rounded-xl bg-accent/15 px-4 py-2 text-sm">
          <span>{pendingDrafts === 1 ? "בקבוק אחד מה־AI מחכה לאישור שלכם" : `${pendingDrafts} בקבוקים מה־AI מחכים לאישור שלכם`}</span>
          <span aria-hidden="true">←</span>
        </Link>
      )}
    </section>
  );
}
