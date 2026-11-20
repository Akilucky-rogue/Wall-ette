/**
 * Where to open the next screen, set just before navigating to it: a budget
 * notification opens Flow on Goals, a bill due soon opens Pulse at Recurring
 * Charges. The screen takes it once when it appears; anything else ignores it.
 */
export type ScreenSection = 'goals' | 'recurring';

let pending: ScreenSection | null = null;

export function openAt(section: ScreenSection): void {
  pending = section;
}

/** The section waiting for this screen, if it is `mine`; clears it. */
export function takeSection(mine: ScreenSection): boolean {
  if (pending !== mine) return false;
  pending = null;
  return true;
}
