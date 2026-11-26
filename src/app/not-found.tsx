"use client";

import Link from "next/link";
import { useT } from "@/i18n/provider";

/** Shown for any unknown address – and for a wine or fridge of another cellar (RLS hides it). */
export default function NotFound() {
  const o = useT().oops;
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-12 text-center">
      <div className="text-5xl" aria-hidden="true">🍷</div>
      <h1 className="text-2xl font-bold">{o.notFoundTitle}</h1>
      <p className="text-muted">
{o.notFoundLines.map((line, i) => (
          <span key={line}>
            {i > 0 && " "}
            <span className="inline-block">{line}</span>
          </span>
        ))}
      </p>
      <Link href="/" className="rounded-full bg-accent px-5 py-3 font-medium text-white dark:text-black">
        {o.home}
      </Link>
    </main>
  );
}
