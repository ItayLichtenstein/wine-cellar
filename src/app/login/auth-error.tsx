"use client";

import { useSearchParams } from "next/navigation";

/** Shows a generic message when the callback sent us back with ?error=auth. */
export function AuthError() {
  const error = useSearchParams().get("error");
  if (!error) return null;

  return (
    <p role="alert" className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">
      ההתחברות לא הושלמה. נסו שוב.
    </p>
  );
}
