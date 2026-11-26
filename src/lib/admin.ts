/** Small pure helpers for the admin page (ADR 0011). */

/** Whole days from `then` to `now` (0 = today, null = never). */
export function daysAgo(then: string | null, now: Date): number | null {
  if (!then) return null;
  const ms = now.getTime() - new Date(then).getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

/** Bytes as a short MB figure, e.g. 12.3 (one decimal under 100, whole above). */
export function megabytes(bytes: number): string {
  const mb = bytes / 1_000_000;
  return mb < 100 ? mb.toFixed(1) : Math.round(mb).toString();
}

/** Share of a free-tier limit, 0–100, rounded up so a sliver still shows. */
export function percentOf(used: number, limit: number): number {
  if (limit <= 0) return 0;
  return Math.min(100, Math.ceil((used / limit) * 100));
}

// Supabase Free limits (supabase.com/pricing, checked Nov 2026). If the plan
// changes, change these two numbers.
export const FREE_DB_BYTES = 500_000_000;
export const FREE_STORAGE_BYTES = 1_000_000_000;
