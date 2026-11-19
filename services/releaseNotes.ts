/**
 * "What's new" notes, newest first.
 *
 * Add an entry for each Play release people should hear about, using the
 * versionCode and versionName from android/app/build.gradle. After an
 * update, the app shows the entries newer than the version this phone last
 * showed (up to three), once; Profile → What's new shows them any time.
 * Paste the same lines into the release notes in Play Console.
 * Write for users: one short sentence per change, no internals.
 *
 * No imports, so scripts/check-app-updates.mjs can test it in Node.
 */

export interface ReleaseNote {
  versionCode: number;
  version: string;
  items: string[];
}

export const RELEASE_NOTES: ReleaseNote[] = [
  {
    versionCode: 10,
    version: '1.5.3',
    items: [
      'Wall-ette now tells you when an update is ready, so you can install it without leaving the app.',
      "After an update, you'll see what changed, like this.",
      'Find your app version and these notes at the bottom of Profile.',
    ],
  },
];

const MAX_SHOWN = 3;

/** Notes newer than `seen` and no newer than `current`, newest first. */
export function notesSince(seen: number, current: number, notes: ReleaseNote[] = RELEASE_NOTES): ReleaseNote[] {
  return notes
    .filter(n => n.versionCode > seen && n.versionCode <= current)
    .sort((a, b) => b.versionCode - a.versionCode)
    .slice(0, MAX_SHOWN);
}

/** The latest notes up to `current`, for Profile → What's new. */
export function latestNotes(current: number, notes: ReleaseNote[] = RELEASE_NOTES): ReleaseNote[] {
  return notesSince(-Infinity, current, notes);
}

/**
 * The notes to show when the main screen appears. `seen` is the versionCode
 * stored the last time notes were shown or skipped (null if never). Without
 * it, signing in during this run means a new install, so there's nothing to
 * show; a saved session means an update from a build that didn't store it.
 */
export function notesToShow(
  seen: number | null,
  current: number,
  signedInThisRun: boolean,
  notes: ReleaseNote[] = RELEASE_NOTES,
): ReleaseNote[] {
  const baseline = seen ?? (signedInThisRun ? current : current - 1);
  return baseline >= current ? [] : notesSince(baseline, current, notes);
}

const SEEN_KEY = 'walletWhatsNewSeen';

export function readSeenVersion(): number | null {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    if (raw === null) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

export function markSeen(versionCode: number): void {
  try {
    localStorage.setItem(SEEN_KEY, String(versionCode));
  } catch { /* storage unavailable */ }
}
