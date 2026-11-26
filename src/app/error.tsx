"use client"; // Error boundaries must be Client Components

/**
 * Shown when a page fails to load (e.g. the database is unreachable).
 * Never shows the technical error to the user – details stay in the
 * server log (security rule: error messages reveal nothing internal).
 * retry() re-fetches the page's data and renders it again.
 */
export default function Error({ retry }: { error: unknown; retry: () => void }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-12 text-center">
      <div className="text-5xl" aria-hidden="true">🍷</div>
      <h1 className="text-2xl font-bold">משהו השתבש</h1>
      <p className="text-muted">
        <span className="inline-block">לא הצלחנו לטעון את העמוד,</span>{" "}
        <span className="inline-block">אבל הנתונים שלכם בסדר. נסו שוב בעוד רגע</span>
      </p>
      <button type="button" onClick={retry} className="rounded-full bg-accent px-5 py-3 font-medium text-white dark:text-black">
        לנסות שוב
      </button>
    </main>
  );
}
