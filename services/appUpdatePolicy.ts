/**
 * When to offer, require or skip a Google Play update.
 *
 * Pure logic with no imports, so scripts/check-app-updates.mjs can test it in
 * Node. services/appUpdates.ts feeds it what Play reports and acts on the plan.
 * The numbers mirror Google Play's in-app update API, as passed through by
 * @capawesome/capacitor-app-update.
 */

export const UpdateAvailability = {
  UNKNOWN: 0,
  NOT_AVAILABLE: 1,
  AVAILABLE: 2,
  /** An update the app started (flexible or immediate) is still running. */
  IN_PROGRESS: 3,
} as const;

/** Install status of a flexible update that has finished downloading. */
export const INSTALL_DOWNLOADED = 11;

/** After "No thanks", that version isn't offered again for this long. A newer one is. */
export const ASK_AGAIN_AFTER_MS = 3 * 24 * 60 * 60 * 1000;

/**
 * In-app update priority (0–5, set when a release rolls out, through the
 * `inAppUpdatePriority` field of the Play Developer API) from which an update
 * counts as required. Normally a required update comes from config/app instead.
 */
export const REQUIRED_PRIORITY = 4;

export interface DeclinedUpdate {
  /** The versionCode the user said "No thanks" to. */
  code: number;
  /** When, in ms since the epoch. */
  at: number;
}

export interface UpdateFacts {
  availability: number;
  installStatus: number;
  currentVersionCode: number;
  availableVersionCode: number;
  immediateAllowed: boolean;
  flexibleAllowed: boolean;
  priority: number;
  /** Builds below this must update before use (Firestore config/app). 0 means no minimum. */
  minVersionCode: number;
  declined: DeclinedUpdate | null;
  now: number;
}

/**
 * - `ready`: a flexible update has downloaded; offer a restart to install it.
 * - `ready-required`: the same, but the update is required; block the app
 *   until the restart.
 * - `flexible`: offer the update in Google's dialog; the app stays usable
 *   while it downloads.
 * - `immediate`: required; run Google's full-screen update.
 * - `required-store`: required, but Google's full-screen update can't start
 *   (one is already running, or Play doesn't allow it); block the app and
 *   send people to the store page.
 * - `none`: nothing to do.
 */
export type UpdatePlan = 'none' | 'ready' | 'ready-required' | 'flexible' | 'immediate' | 'required-store';

export function isRequired(f: Pick<UpdateFacts, 'currentVersionCode' | 'minVersionCode' | 'priority'>): boolean {
  return f.currentVersionCode < f.minVersionCode || f.priority >= REQUIRED_PRIORITY;
}

/** Whether the plan depends on the minimum version, so config/app is worth reading. */
export function needsMinimum(availability: number, installStatus: number): boolean {
  return installStatus === INSTALL_DOWNLOADED
    || availability === UpdateAvailability.AVAILABLE
    || availability === UpdateAvailability.IN_PROGRESS;
}

/**
 * What the last check found, for Self → About and the bell:
 * - `latest`: Google Play has nothing newer for this phone.
 * - `available`: Play has a newer version, whether or not its dialog was
 *   shown or turned down.
 * - `downloading`: an update is downloading.
 * - `ready`: an update has downloaded and waits for a restart.
 * - `not-from-play`: this copy wasn't installed from Google Play (a build from
 *   Android Studio, or an APK), so Play can't update it.
 * - `unavailable`: Play couldn't be asked: offline, no Play Store, or no answer.
 */
export type UpdateFinding = 'latest' | 'available' | 'downloading' | 'ready' | 'not-from-play' | 'not-allowed' | 'unavailable';

export function findingOf(availability: number, installStatus: number): UpdateFinding {
  if (installStatus === INSTALL_DOWNLOADED) return 'ready';
  if (availability === UpdateAvailability.IN_PROGRESS) return 'downloading';
  if (availability === UpdateAvailability.AVAILABLE) return 'available';
  if (availability === UpdateAvailability.NOT_AVAILABLE) return 'latest';
  return 'unavailable';
}

/**
 * A failed check, from Play's error message. Play refuses with
 * InstallErrorCode.ERROR_APP_NOT_OWNED (-10) when the app wasn't installed
 * from Play: "Install Error(-10): The app is not owned by any user on this device…",
 * and with ERROR_INSTALL_NOT_ALLOWED (-6) when the phone won't allow it just
 * now: no Google account in Play, low storage or battery. Neither is the
 * connection, which is what 'unavailable' says.
 */
export function failureOf(message: string): UpdateFinding {
  if (/Install Error\(-10\)|ERROR_APP_NOT_OWNED|not owned by any user/i.test(message)) return 'not-from-play';
  if (/Install Error\(-6\)|ERROR_INSTALL_NOT_ALLOWED|not allowed, due to the current device state/i.test(message)) return 'not-allowed';
  return 'unavailable';
}

export function planUpdate(f: UpdateFacts): UpdatePlan {
  if (f.installStatus === INSTALL_DOWNLOADED) return isRequired(f) ? 'ready-required' : 'ready';
  if (f.availability === UpdateAvailability.IN_PROGRESS) return isRequired(f) ? 'required-store' : 'none';
  if (f.availability !== UpdateAvailability.AVAILABLE) return 'none';
  if (isRequired(f)) return f.immediateAllowed ? 'immediate' : 'required-store';
  if (!f.flexibleAllowed) return 'none';
  const quiet = f.declined !== null
    && f.declined.code >= f.availableVersionCode
    && f.now - f.declined.at < ASK_AGAIN_AFTER_MS;
  return quiet ? 'none' : 'flexible';
}
