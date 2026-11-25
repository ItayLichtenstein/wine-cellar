import Link from "next/link";

/**
 * "Up" to the parent screen, at the top of every inner page. A fixed
 * parent (like an app's up button), not the browser's back: a page opened
 * from a link or a refresh still has somewhere sensible to go.
 * The arrow points right, which is "back" in a right-to-left layout.
 */
export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="-ms-2 inline-flex items-center gap-1 self-start rounded-full px-2 py-1.5 text-sm text-muted hover:text-foreground"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="m9 6 6 6-6 6" />
      </svg>
      {label}
    </Link>
  );
}
