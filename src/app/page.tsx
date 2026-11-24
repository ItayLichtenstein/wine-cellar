import Link from "next/link";
import { Suspense } from "react";
import { FridgePreview } from "@/components/fridge-preview";
import { getCurrentUser } from "@/lib/auth";
import { DRINK_STATES, DRINK_STATE_ORDER } from "@/lib/drink-state";
import { fridgeCapacity } from "@/lib/fridge-layout";
import { getLooseBottleCounts, getMyFridges } from "@/lib/fridges";
import { SignOutButton } from "./sign-out-button";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-8">
      {/* Everything personal reads the session, so it streams in behind Suspense. */}
      <Suspense fallback={<p className="text-muted">טוען…</p>}>
        <Header />
        <Fridges />
      </Suspense>
    </main>
  );
}

async function Header() {
  const user = await getCurrentUser();
  return (
    <header className="flex items-center justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold">מרתף יין</h1>
        <p className="text-sm text-muted">שלום {user.displayName}</p>
      </div>
      <SignOutButton />
    </header>
  );
}

async function Fridges() {
  const [fridges, loose] = await Promise.all([getMyFridges(), getLooseBottleCounts()]);

  if (fridges.length === 0) {
    return (
      <section className="flex flex-col items-center gap-4 rounded-2xl bg-surface p-8 text-center shadow-sm">
        <div className="text-4xl" aria-hidden="true">🧊</div>
        <h2 className="text-xl font-semibold">עוד אין כאן מקרר</h2>
        <p className="text-muted">נתחיל מהבסיס: כמה מדפים יש, ואיך כל מדף מסודר.</p>
        <Link href="/fridges/new" className="rounded-full bg-accent px-5 py-3 font-medium text-white dark:text-black">
          הגדרת המקרר הראשון
        </Link>
      </section>
    );
  }

  const stored = fridges.flatMap((f) => f.shelves.flatMap((s) => s.zones.flatMap((z) => z.bottles)));

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          {stored.length} בקבוקים במקרר
          {loose.unplaced > 0 && ` · ${loose.unplaced} מחוץ למקרר`}
          {loose.inTransit > 0 && ` · ${loose.inTransit} בדרך`}
        </p>
        <Link href="/bottles/new" className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-white dark:text-black">
          + הוספת בקבוקים
        </Link>
      </div>

      {fridges.map((fridge) => (
        <article key={fridge.id} className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold">{fridge.name}</h2>
            <span className="text-sm text-muted">
              {[fridge.brand, fridge.model].filter(Boolean).join(" ")}
              {fridge.brand || fridge.model ? " · " : ""}
              מקום ל־{fridgeCapacity(fridge.shelves)}
            </span>
          </div>
          <FridgePreview shelves={fridge.shelves} />
        </article>
      ))}

      {stored.length > 0 && <Legend />}

      <Link href="/fridges/new" className="self-start text-sm underline underline-offset-2">
        + הוספת מקרר
      </Link>
    </section>
  );
}

/** What the year-badge colors mean. */
function Legend() {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted" aria-label="מקרא צבעים">
      {DRINK_STATE_ORDER.filter((s) => s !== "none").map((s) => (
        <li key={s} className="flex items-center gap-1.5">
          <span className="size-3 rounded-sm" style={{ backgroundColor: DRINK_STATES[s].color }} aria-hidden="true" />
          {DRINK_STATES[s].label}
        </li>
      ))}
    </ul>
  );
}
