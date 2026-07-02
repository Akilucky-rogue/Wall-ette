/**
 * Device biometric unlock (fingerprint / face) — native only.
 *
 * Uses @aparajita/capacitor-biometric-auth on Android/iOS. On web the helpers
 * report "unavailable" and the UI hides biometric options.
 *
 * Note: biometrics gate the LOCAL session lock (the user is already signed in
 * to Firebase). Enablement is a per-device preference stored in localStorage,
 * not synced to Firestore — a fingerprint enrolled on one phone says nothing
 * about another device.
 */
import { Capacitor } from '@capacitor/core';
import { log } from './log';

export const isNative = (): boolean => Capacitor.isNativePlatform();

// One shared module load — checkBiometry and authenticate were each paying
// for their own dynamic import, adding visible latency to the unlock prompt.
let pluginPromise: Promise<typeof import('@aparajita/capacitor-biometric-auth')> | null = null;
const loadPlugin = () => (pluginPromise ??= import('@aparajita/capacitor-biometric-auth'));

/** Kick off the plugin load early (e.g., the moment the lock screen mounts). */
export function preloadBiometric(): void {
  if (isNative()) void loadPlugin();
}

/** Is a biometric sensor available and enrolled on this device? */
export async function isBiometricAvailable(): Promise<boolean> {
  if (!isNative()) return false;
  try {
    const { BiometricAuth } = await loadPlugin();
    const info = await BiometricAuth.checkBiometry();
    return info.isAvailable;
  } catch (e) {
    log.warn('Biometry check failed');
    return false;
  }
}

/** Prompt the OS biometric dialog. Resolves true on success, false otherwise. */
export async function authenticateBiometric(reason: string): Promise<boolean> {
  if (!isNative()) return false;
  try {
    const { BiometricAuth } = await loadPlugin();
    await BiometricAuth.authenticate({
      reason,
      cancelTitle: 'Use password',
      allowDeviceCredential: true, // fall back to PIN/pattern if biometrics fail
      androidTitle: 'Unlock Walter',
      androidSubtitle: reason,
      androidConfirmationRequired: false,
    });
    return true;
  } catch (e) {
    // User cancelled or auth failed — caller falls back to password.
    return false;
  }
}

// ── Per-device, per-user preference ─────────────────────────────────────────

const key = (uid: string) => `biometricUnlock_${uid}`;

export const isBiometricEnabled = (uid: string): boolean => {
  try { return localStorage.getItem(key(uid)) === '1'; } catch { return false; }
};

export const setBiometricEnabled = (uid: string, enabled: boolean): void => {
  try {
    if (enabled) localStorage.setItem(key(uid), '1');
    else localStorage.removeItem(key(uid));
  } catch { /* storage unavailable — non-fatal */ }
};
