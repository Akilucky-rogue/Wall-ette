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
    versionCode: 16,
    version: '1.5.8',
    items: [
      'Restore a Full backup in Data Studio: entries and settings come back, and nothing is deleted.',
      "Payments Wall-ette can't name show as To review, and after each import you can say what they were.",
      'A payment and its reversal cancel out, and fund redemptions no longer count as income.',
      'Each import leaves a receipt: rows added and skipped, and how the balance check read.',
      'Home says what Balance includes and how far your entries reach; new wallets start with a guide.',
      'Clearer text in the light themes.',
    ],
  },
  {
    versionCode: 15,
    version: '1.5.7',
    // Play allows 500 characters in all (scripts/check-app-updates.mjs).
    items: [
      "What's new opens properly from the bell, on phones and computers.",
      'Self → About can check Google Play for updates, and the bell shows when a new version is waiting.',
    ],
  },
  {
    versionCode: 14,
    version: '1.5.6',
    items: [
      'A new Pulse: money in and out, your spending pace, where it went and what stands out, with charts.',
      'Show amounts in any currency. They stay saved in rupees.',
      'Left to spend, on Home: what you can still spend before your next pay.',
      'Statement reports match Pulse to the rupee and look like the app.',
      'The bell and phone reminders flag budgets, bills due and price rises.',
      'Payees show by name, Vault is more compact, and Fee Hunter is gone.',
      'Statement import and New entry are exact to the paisa.',
    ],
  },
  {
    versionCode: 13,
    version: '1.5.5',
    items: [
      'Import statements from HDFC, SBI, Kotak, Union Bank and Saraswat Bank, as well as IDFC FIRST.',
      'Password-locked statement PDFs open once you enter their password.',
      'Forgot Password tells you when no account uses an email, and catches typos like gmial.com.',
      'Crash reports help fix problems. They never include your transactions, and you can turn them off in Profile.',
      'If Android stops the app to free memory, Wall-ette reopens instead of closing.',
    ],
  },
  {
    versionCode: 12,
    version: '1.5.4',
    items: [
      "Wall-ette tells you if a change didn't save to your account, and lets you try again.",
      'Re-imports match payments by bank reference, so same-day payments of the same amount are never mixed up.',
      'Entries imported twice, from both the PDF and the Excel of a statement, are found and can be removed.',
      'Signing out or deleting your account also clears your data from this phone.',
      'Screenshots and the recent-apps view no longer show your wallet, and phone backups leave it out.',
    ],
  },
  {
    versionCode: 11,
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
