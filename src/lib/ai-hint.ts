// The "Saved – connect an AI?" screen after adding a bottle (users without
// an AI). Shown the first time, once more a week later, then never: often
// enough to be noticed, not so often that it nags those who skip AI on purpose.

export type AiHintSeen = { count: number; last: number };

export const AI_HINT_KEY = "ai-hint-seen";
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function shouldShowAiHint(seen: AiHintSeen | null, now: number): boolean {
  if (!seen || seen.count < 1) return true;
  if (seen.count === 1) return now - seen.last >= WEEK_MS;
  return false;
}

export function markAiHintSeen(seen: AiHintSeen | null, now: number): AiHintSeen {
  return { count: (seen?.count ?? 0) + 1, last: now };
}

/** Reads the stored record; storage may be missing or blocked (private mode). */
export function readAiHintSeen(): AiHintSeen | null {
  try {
    const raw = localStorage.getItem(AI_HINT_KEY);
    const v = raw ? JSON.parse(raw) : null;
    return v && typeof v.count === "number" && typeof v.last === "number" ? v : null;
  } catch {
    return null;
  }
}

export function writeAiHintSeen(seen: AiHintSeen): void {
  try {
    localStorage.setItem(AI_HINT_KEY, JSON.stringify(seen));
  } catch {
    // Blocked storage: worst case the hint shows again.
  }
}
