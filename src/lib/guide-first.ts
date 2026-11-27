// The beginner's guide opens by itself on the first visit (people did not
// notice the link and did not know where to start). A cookie marks that the
// guide was opened on this device; once the user saved their name
// (profiles.onboarded_at), it never opens by itself again.

export const GUIDE_SEEN_COOKIE = "guide-seen";

/** True when the home page should send the user to the guide first. */
export function shouldOpenGuide(onboarded: boolean, seenCookie: string | undefined): boolean {
  return !onboarded && seenCookie !== "1";
}
