/**
 * Returns a path that is safe to redirect to after sign-in.
 *
 * Without this check, an attacker could send a link like
 *   /login?next=https://evil.example
 * and the user would land on a fake site right after a real Google login
 * (an "open redirect"). We accept only paths on our own site.
 */
export function safeNextPath(next: string | null | undefined): string {
  if (!next) return "/";

  // Must be a path on this site: exactly one leading slash.
  // "//evil.com" and "/\evil.com" are treated by browsers as other sites.
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return "/";
  }

  // No control characters or backslashes anywhere (browsers "fix" them
  // in surprising ways).
  if (/[\u0000-\u001f\\]/.test(next)) return "/";

  // Final check: resolving it must not leave our origin.
  const base = "http://same.origin";
  if (new URL(next, base).origin !== base) return "/";

  return next;
}
