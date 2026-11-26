/** What the profile remembers about the first-steps card (see migration 38). */
export type FirstStepsState = null | "shown" | "using" | "closed";

/**
 * Whether the card shows. A never-shown card shows once; after that it shows
 * only if the user started using it (tapped a step), or for the rest of the
 * visit in which it first appeared. Closing hides it for good.
 */
export function showFirstSteps(state: FirstStepsState, openThisVisit: boolean, allDone = false): boolean {
  if (state === "closed") return false;
  // Someone who already did everything (an invited partner, say) has nothing to learn here.
  if (allDone && state !== "using") return false;
  if (state === null || state === "using") return true;
  return openThisVisit;
}

/** The state to store when the card first appears; null means nothing to store. */
export function stateOnShow(state: FirstStepsState): FirstStepsState {
  return state === null ? "shown" : null;
}
