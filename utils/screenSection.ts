/**
 * Where to open the next screen, set just before navigating to it: a budget
 * notification or Home's budgets open Flow on Goals, and a new wallet's
 * "Restore it" opens Data Studio on its restore card. The screen takes it once
 * when it appears; anything else ignores it.
 */
export type ScreenSection = 'goals' | 'restore';

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
