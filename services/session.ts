/**
 * Signing out and deleting the account, including this device's copy of the
 * data (audit M2).
 *
 * The device holds a user's data twice: WalletContext's localStorage mirror
 * (keys ending in `_<uid>`, with the fingerprint flag) and Firestore's offline
 * cache in IndexedDB. Both go on sign-out and after account deletion, with
 * any waiting or shown phone notifications (services/phoneNotifier.ts). The
 * cache also queues changes that haven't reached the cloud, so sign-out only
 * clears it once those have synced; offline, it stays, and they sync at this
 * user's next sign-in on the device.
 *
 * Clearing the cache stops Firestore for the rest of the page's life, so the
 * app reloads afterwards and skips the launch splash.
 */
import { signOut } from 'firebase/auth';
import { clearIndexedDbPersistence, terminate, waitForPendingWrites } from 'firebase/firestore';
import { auth, db } from './firebase';
import { clearPhoneNotes } from './phoneNotifier';
import { log } from '../utils/log';

const QUIET_START_KEY = 'walletQuietStart';
/** How long sign-out waits for unsynced changes to reach the cloud. */
const SYNC_WAIT_MS = 4000;

/** Removes the localStorage keys that belong to `uid` (they end in `_<uid>`). */
export function removeUserKeys(uid: string, storage: Storage = localStorage): void {
  try {
    const suffix = `_${uid}`;
    const keys: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key?.endsWith(suffix)) keys.push(key);
    }
    keys.forEach(key => storage.removeItem(key));
  } catch { /* storage unavailable */ }
}

/** Whether every queued change reaches the cloud within `ms`. */
export async function changesSynced(ms: number = SYNC_WAIT_MS): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      waitForPendingWrites(db).then(() => true),
      new Promise<boolean>(resolve => { timer = setTimeout(() => resolve(false), ms); }),
    ]);
  } catch (e) {
    log.warn('Could not check for unsynced changes', e);
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/** Stops Firestore and deletes its offline cache. Firestore can't be used again in this page. */
export async function clearOfflineCache(): Promise<void> {
  try {
    await terminate(db);
    await clearIndexedDbPersistence(db);
  } catch (e) {
    log.warn('Could not clear the offline cache', e);
  }
}

function reloadQuietly(): void {
  try { sessionStorage.setItem(QUIET_START_KEY, '1'); } catch { /* storage unavailable */ }
  window.location.reload();
}

/**
 * Signs out and removes this user's data from the device. Reloads the app
 * when the cache was cleared; otherwise the auth listener shows sign-in.
 */
export async function signOutOfDevice(): Promise<void> {
  const uid = auth.currentUser?.uid ?? null;
  // Checked before signing out: the queue belongs to the signed-in user.
  const synced = uid ? await changesSynced() : true;
  await signOut(auth);
  // Bill reminders and alerts are this user's; none may show after sign-out.
  await clearPhoneNotes();
  if (uid) removeUserKeys(uid);
  if (synced) {
    await clearOfflineCache();
    reloadQuietly();
  }
}

/** After the account is deleted: removes what's left of it on this device, then reloads. */
export async function forgetDeletedAccount(uid: string): Promise<void> {
  await clearPhoneNotes();
  removeUserKeys(uid);
  await clearOfflineCache();
  reloadQuietly();
}

/** True once, on the start-up right after one of the reloads above. */
export function consumeQuietStart(): boolean {
  try {
    const quiet = sessionStorage.getItem(QUIET_START_KEY) === '1';
    sessionStorage.removeItem(QUIET_START_KEY);
    return quiet;
  } catch {
    return false;
  }
}
