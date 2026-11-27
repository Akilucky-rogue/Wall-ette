/**
 * Google Play's own screens (the purchase sheet, the subscriptions page)
 * put Wall-ette in the background like the file picker does. The app lock
 * (App.tsx) skips those trips: while a purchase sheet is open, and once on
 * coming back from Play's subscriptions page.
 */
let holds = 0;
let untilResume = false;

/** A Play sheet opens over the app: no lock until releaseLock(). */
export const holdLock = (): void => { holds++; };
export const releaseLock = (): void => { holds = Math.max(0, holds - 1); };

/** The member is leaving for Play's subscriptions page: no lock when they come back. */
export const skipLockOnce = (): void => { untilResume = true; };

/** App.tsx: whether going to the background should lock now. */
export const lockHeld = (): boolean => holds > 0 || untilResume;

/** App.tsx: back in the app; the next trip out locks as usual. */
export const resumed = (): void => { untilResume = false; };
