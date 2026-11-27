/**
 * Payments from your apps on this phone: the ones waiting for a tap ("Add
 * this?"), notifications read recently, whether to ask before adding, and
 * the last batch added (for Undo). Kept in this device's storage per
 * account, never in the cloud: the notification text stays on the phone.
 * Screens follow it with useSyncExternalStore (subscribeInbox, getInbox).
 */
import { keepSeen, keepToCheck, type Seen, type ToCheck } from './captured';

export interface Added {
  ids: string[];
  /** App ids the payments came from. */
  apps: string[];
  at: number;
}

export interface Inbox {
  uid: string | null;
  toCheck: ToCheck[];
  /** The "Add this?" sheet is open. */
  open: boolean;
  /** A line the sheet shows on top (shared text with no payment in it). */
  note: string | null;
  /** The last payments added without asking, until dismissed or undone. */
  added: Added | null;
}

let state: Inbox = { uid: null, toCheck: [], open: false, note: null, added: null };
const listeners = new Set<() => void>();

export const subscribeInbox = (fn: () => void): (() => void) => {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
};
export const getInbox = (): Inbox => state;
const set = (patch: Partial<Inbox>): void => {
  state = { ...state, ...patch };
  for (const fn of listeners) fn();
};

// Keys end _<uid>, so signing out removes them (services/session.ts removeUserKeys).
const KEY_TO_CHECK = (uid: string) => `wallette_toCheck_${uid}`;
const KEY_SEEN = (uid: string) => `wallette_alertsSeen_${uid}`;
const KEY_ASK_FIRST = 'wallette.paymentsAskFirst';

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function writeJson(key: string, value: unknown): void {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage full or off: kept in memory */ }
}

const valid = (w: unknown): w is ToCheck => {
  const x = w as ToCheck;
  return !!x && typeof x === 'object' && !!x.entry && typeof x.entry.id === 'string' && typeof x.entry.amount === 'number'
    && typeof x.text === 'string' && typeof x.at === 'number';
};

/** Loads the account's list (on sign-in); null clears what's shown (on sign-out). */
export function loadInbox(uid: string | null): void {
  if (uid === state.uid) return;
  const list = uid ? readJson<unknown[]>(KEY_TO_CHECK(uid), []).filter(valid) : [];
  set({ uid, toCheck: uid ? keepToCheck(list, Date.now()) : [], open: false, note: null, added: null });
}

export function setToCheck(list: ToCheck[]): void {
  const next = keepToCheck(list, Date.now());
  if (state.uid) writeJson(KEY_TO_CHECK(state.uid), next);
  set({ toCheck: next });
}

export const removeToCheck = (entryIds: readonly string[]): void =>
  setToCheck(state.toCheck.filter(w => !entryIds.includes(w.entry.id)));

export function loadSeen(uid: string): Seen[] {
  return keepSeen(readJson<Seen[]>(KEY_SEEN(uid), []).filter(s => s && typeof s.key === 'string'), Date.now());
}
export const saveSeen = (uid: string, list: Seen[]): void => writeJson(KEY_SEEN(uid), keepSeen(list, Date.now()));

/** "Ask me first": every payment waits for a tap. On this phone only. */
export const askFirst = (): boolean => readJson<boolean>(KEY_ASK_FIRST, false) === true;
export function setAskFirst(on: boolean): void {
  writeJson(KEY_ASK_FIRST, on);
  set({});
}

export const openToCheck = (note: string | null = null): void => set({ open: true, note });
export const closeToCheck = (): void => set({ open: false, note: null });
export const showAdded = (added: Added | null): void => set({ added });

/** Forgets this phone's lists for an account (on sign-out). */
export function forgetInbox(uid: string): void {
  try {
    localStorage.removeItem(KEY_TO_CHECK(uid));
    localStorage.removeItem(KEY_SEEN(uid));
  } catch { /* nothing kept */ }
  if (state.uid === uid) set({ toCheck: [], open: false, note: null, added: null });
}
