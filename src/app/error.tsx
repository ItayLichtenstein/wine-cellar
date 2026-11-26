"use client"; // Error boundaries must be Client Components

import { useT } from "@/i18n/provider";

/**
 * Shown when a page fails to load (e.g. the database is unreachable).
 * Never shows the technical error to the user – details stay in the
 * server log (security rule: error messages reveal nothing internal).
 * retry() re-fetches the page's data and renders it again.
 */
export default function Error({ retry }: { error: unknown; retry: () => void }) {
  const o = useT().oops;
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-12 text-center">
      <div className="text-5xl" aria-hidden="true">🍷</div>
      <h1 className="text-2xl font-bold">{o.errorTitle}</h1>
      <p className="text-muted">
{o.errorLines.map((line, i) => (
          <span key={line}>
            {i > 0 && " "}
            <span className="inline-block">{line}</span>
          </span>
        ))}
      </p>
      <button type="button" onClick={retry} className="rounded-full bg-accent px-5 py-3 font-medium text-white dark:text-black">
        {o.retry}
      </button>
    </main>
  );
}
