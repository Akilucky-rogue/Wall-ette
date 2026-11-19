/**
 * Changes the cloud refused (audit M4).
 *
 * Firestore shows a change on this device at once and queues it until the
 * server has it, offline and across restarts. When the server refuses one
 * (security rules, the daily quota), Firestore undoes it on the device as
 * well, and the only sign is the write's rejected promise. WalletContext sends
 * its writes through sendToCloud, which keeps each refusal for the "didn't
 * save" banner (components/CloudSaveBanner.tsx) and its Try again.
 *
 * Module state, so it outlives the lock screen, which unmounts the wallet.
 */
import { log } from '../utils/log';

interface Refused {
  /** Transactions or settings the write covered, for the banner's count. */
  items: number;
  code: string;
  send: () => Promise<unknown>;
}

export interface UnsavedState {
  /** Changes refused and not yet sent again; 0 when all is saved. */
  count: number;
  /** Firestore's error code, e.g. 'permission-denied' or 'resource-exhausted'. */
  code: string | null;
  /** A Try again is still waiting for the server. */
  retrying: boolean;
}

let owner: string | null = null;
const refused = new Map<string, Refused>();
const listeners = new Set<() => void>();
let retrying = 0;
let state: UnsavedState = { count: 0, code: null, retrying: false };

function publish(): void {
  let count = 0;
  let code: string | null = null;
  for (const r of refused.values()) {
    count += r.items;
    // The quota is the one cause the user can wait out; name it if it's there.
    if (code !== 'resource-exhausted') code = r.code;
  }
  state = { count, code, retrying: retrying > 0 };
  listeners.forEach(listener => listener());
}

export function subscribeUnsaved(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export const getUnsaved = (): UnsavedState => state;

/** The signed-in user (null when signed out). Refusals kept for anyone else are dropped. */
export function setCloudOwner(uid: string | null): void {
  if (uid === owner) return;
  owner = uid;
  if (refused.size > 0) {
    refused.clear();
    publish();
  }
}

/**
 * Sends one write. `key` names what it changes (a transaction, a settings
 * field, an import batch), so a later write to the same thing replaces a
 * refusal kept for it. Resolves true once the server has the write, false if
 * it refused it.
 */
export function sendToCloud(key: string, items: number, send: () => Promise<unknown>): Promise<boolean> {
  const by = owner;
  // A write Firestore rejects before sending (invalid data) throws instead.
  return new Promise<unknown>(resolve => resolve(send())).then(
    () => {
      if (by === owner && refused.delete(key)) publish();
      return true;
    },
    (e: any) => {
      log.warn('Cloud write refused:', key, e?.code || e?.message);
      if (by === owner) {
        refused.set(key, { items, code: e?.code || 'unknown', send });
        publish();
      }
      return false;
    },
  );
}

/** Sends every refused change again; any refused again stays listed. */
export function retryUnsaved(): void {
  const again = [...refused.entries()];
  if (again.length === 0) return;
  retrying += again.length;
  publish();
  for (const [key, r] of again) {
    void sendToCloud(key, r.items, r.send).finally(() => {
      retrying--;
      publish();
    });
  }
}

/** Forgets the refused changes. They stay undone. */
export function dismissUnsaved(): void {
  if (refused.size === 0) return;
  refused.clear();
  publish();
}
