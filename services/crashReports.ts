/**
 * Crash reports, through Firebase Crashlytics (Android only; on the web every
 * call does nothing).
 *
 * The native SDK reports crashes of the app itself. This adds what happens in
 * the WebView, where nearly all of Wall-ette runs: uncaught errors, unhandled
 * promise rejections and problems the app reports (a change the cloud refused).
 * Messages go through crashFormat.redact first, and no user id is set, so a
 * report holds the error, where in the code it happened, the last screens and
 * the device details Crashlytics adds; never transactions, names or amounts.
 *
 * On by default in release builds. Profile → Crash Reports turns them off on
 * this device; debug builds never send (AndroidManifest.xml, from build.gradle).
 */
import { Capacitor } from '@capacitor/core';
import { FirebaseCrashlytics } from '@capacitor-firebase/crashlytics';
import { describe, redact, stackFrames, type ReportFrame } from './crashFormat';

const PREF_KEY = 'crashReports'; // 'off' once turned off on this device
const MAX_PER_SESSION = 20;
// Browser noise with nothing to fix.
const IGNORED = /ResizeObserver loop/;

const native = Capacitor.isNativePlatform();
const sent = new Set<string>();

/** Whether crash reports are on for this device. */
export function crashReportsOn(): boolean {
  try { return localStorage.getItem(PREF_KEY) !== 'off'; } catch { return true; }
}

/** Turns crash reports on or off for this device. Off also deletes reports not yet sent. */
export async function setCrashReports(on: boolean): Promise<void> {
  try {
    if (on) localStorage.removeItem(PREF_KEY);
    else localStorage.setItem(PREF_KEY, 'off');
  } catch { /* storage unavailable */ }
  if (!native) return;
  try {
    await FirebaseCrashlytics.setEnabled({ enabled: on });
    if (!on) await FirebaseCrashlytics.deleteUnsentReports();
  } catch { /* reporting must never break the app */ }
}

const active = (): boolean => native && crashReportsOn();

function send(message: string, frames: ReportFrame[], keys: Record<string, string>): void {
  const signature = `${message}|${frames[0]?.fileName ?? ''}:${frames[0]?.lineNumber ?? ''}`;
  if (sent.has(signature) || sent.size >= MAX_PER_SESSION) return;
  sent.add(signature);
  FirebaseCrashlytics.recordException({
    message,
    stacktrace: frames,
    keysAndValues: Object.entries(keys).map(([key, value]) => ({ key, value, type: 'string' as const })),
  }).catch(() => { /* never report a failed report */ });
}

/** An error nothing caught. `source` says how it surfaced. */
export function reportError(error: unknown, source: string): void {
  if (!active()) return;
  const message = describe(error);
  if (IGNORED.test(message)) return;
  const frames = stackFrames(error instanceof Error ? error.stack : undefined);
  // Crashlytics groups reports by their frames; give frameless ones their own.
  send(message, frames.length ? frames : [{ functionName: source, fileName: 'webview', lineNumber: 0 }], { source });
}

/**
 * A problem the app noticed and handled, such as a change the cloud refused.
 * `what` names it (no data); `keys` add context, e.g. Firestore's error code.
 */
export function reportProblem(what: string, keys: Record<string, string> = {}): void {
  if (!active()) return;
  const name = redact(what);
  const detail = Object.values(keys).map(redact).join('.');
  send(name, [{ functionName: detail ? `${name}.${detail}` : name, fileName: 'app', lineNumber: 0 }],
    Object.fromEntries(Object.entries(keys).map(([k, v]) => [k, redact(v)])));
}

/** A line in the log sent with the next report, e.g. which screen was open. */
export function breadcrumb(text: string): void {
  if (!active()) return;
  FirebaseCrashlytics.log({ message: redact(text) }).catch(() => {});
}

/** Starts reporting WebView errors. Call once, before the app renders. */
export function initCrashReports(): void {
  if (!native) return;
  // Keep the native switch in step with this device's choice.
  if (!crashReportsOn()) void FirebaseCrashlytics.setEnabled({ enabled: false }).catch(() => {});
  window.addEventListener('error', e => reportError(e.error ?? e.message, 'error'));
  window.addEventListener('unhandledrejection', e => reportError(e.reason, 'unhandledrejection'));
}
