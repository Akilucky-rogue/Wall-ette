/**
 * Light vibrations for taps that change something: a tab, a switch, an entry
 * saved, entries removed. Android only, and off when the person switches
 * "Vibration" off in Self → Appearance (kept on this device, for everyone who
 * uses it).
 */
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

const KEY = 'walletHaptics';

export function hapticsOn(): boolean {
  try { return localStorage.getItem(KEY) !== 'off'; } catch { return true; }
}

export function setHapticsOn(on: boolean): void {
  try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* storage unavailable */ }
}

const run = (buzz: () => Promise<void>): void => {
  if (!Capacitor.isNativePlatform() || !hapticsOn()) return;
  buzz().catch(() => { /* no vibrator */ });
};

/** A light tick: switching tabs, flipping a switch. */
export const tick = (): void => run(() => Haptics.impact({ style: ImpactStyle.Light }));

/** Something saved. */
export const done = (): void => run(() => Haptics.notification({ type: NotificationType.Success }));

/** Something removed. */
export const removed = (): void => run(() => Haptics.notification({ type: NotificationType.Warning }));
