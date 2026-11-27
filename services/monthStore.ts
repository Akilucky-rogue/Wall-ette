/**
 * Month documents in Firestore (services/months.ts holds the layout rules),
 * and the one-time move of a wallet from one document per entry
 * (users/{uid}/transactions, up to 1.5.9) to one per month.
 *
 * The move reads and deletes the old documents through Firestore's REST API.
 * The SDK would first store every one of them in its offline cache, which is
 * the minute this storage is meant to save (docs/PLAN_1.6.0.md).
 */
import {
  collection, deleteField, doc, FieldPath, getDocs, writeBatch,
  type CollectionReference, type Firestore,
} from 'firebase/firestore';
import type { Transaction } from '../types';
import {
  entryFromRest, layOut, MONTH_DOC_ID, planChanges,
  type MonthChange, type MonthLayout, type RestDoc,
} from './months';

export const monthsCollection = (db: Firestore, uid: string): CollectionReference =>
  collection(db, `users/${uid}/months`);

// Firestore refuses fields set to undefined; leave them out.
const forCloud = (t: Transaction): Record<string, unknown> =>
  Object.fromEntries(Object.entries(t).filter(([, v]) => v !== undefined));

/** Entries in one document write, and writes and bytes in one batch, kept well under Firestore's limits. */
const PATHS_PER_WRITE = 400;
const WRITES_PER_BATCH = 400;
const BYTES_PER_BATCH = 4 * 1024 * 1024;

interface Write {
  docId: string;
  items: [string, unknown][];
  bytes: number;
}

/**
 * Commits `changes`: each entry saved whole or taken out by its own field,
 * so two devices changing different entries of a month don't overwrite each
 * other. Saves go before take-outs, so a batch that fails leaves an entry in
 * two documents (read once) rather than in none. Every batch is handed to
 * Firestore at once: offline, they all wait in its queue.
 */
export function commitChanges(db: Firestore, uid: string, changes: readonly MonthChange[]): Promise<void>[] {
  const saves: Write[] = [];
  const takeOuts: Write[] = [];
  for (const c of changes) {
    const set = Object.entries(c.set).map(([id, t]): [string, unknown] => [id, forCloud(t)]);
    for (let i = 0; i < set.length; i += PATHS_PER_WRITE) {
      const items = set.slice(i, i + PATHS_PER_WRITE);
      saves.push({ docId: c.docId, items, bytes: JSON.stringify(items).length });
    }
    for (let i = 0; i < c.remove.length; i += PATHS_PER_WRITE) {
      const ids = c.remove.slice(i, i + PATHS_PER_WRITE);
      takeOuts.push({ docId: c.docId, items: ids.map(id => [id, deleteField()]), bytes: ids.join('').length + ids.length * 8 });
    }
  }

  const batches: Write[][] = [];
  let current: Write[] = [];
  let bytes = 0;
  for (const w of [...saves, ...takeOuts]) {
    if (current.length > 0 && (current.length >= WRITES_PER_BATCH || bytes + w.bytes > BYTES_PER_BATCH)) {
      batches.push(current);
      current = [];
      bytes = 0;
    }
    current.push(w);
    bytes += w.bytes;
  }
  if (current.length > 0) batches.push(current);

  return batches.map(writes => {
    const batch = writeBatch(db);
    for (const w of writes) {
      batch.set(
        doc(db, `users/${uid}/months/${w.docId}`),
        { entries: Object.fromEntries(w.items) },
        { mergeFields: w.items.map(([id]) => new FieldPath('entries', id)) },
      );
    }
    return batch.commit();
  });
}

/** Saves `set` and takes out `remove` wherever `layout` says they go (it's updated to match). */
export const saveToMonths = (
  db: Firestore,
  uid: string,
  layout: MonthLayout,
  set: readonly Transaction[],
  remove: readonly Pick<Transaction, 'id' | 'date'>[] = [],
): Promise<void> => Promise.all(commitChanges(db, uid, planChanges(layout, set, remove))).then(() => undefined);

/**
 * Deletes month documents: every one named, and with `sweep`, every one the
 * cloud has (Clear all before the wallet arrived, and account deletion).
 */
export async function deleteMonths(db: Firestore, uid: string, docIds: Iterable<string>, sweep = false): Promise<void> {
  const ids = new Set(docIds);
  if (sweep) (await getDocs(monthsCollection(db, uid))).forEach(d => { ids.add(d.id); });
  const list = [...ids].filter(id => MONTH_DOC_ID.test(id));
  const commits: Promise<void>[] = [];
  for (let i = 0; i < list.length; i += WRITES_PER_BATCH) {
    const batch = writeBatch(db);
    list.slice(i, i + WRITES_PER_BATCH).forEach(id => batch.delete(doc(db, `users/${uid}/months/${id}`)));
    commits.push(batch.commit());
  }
  await Promise.all(commits);
}

// ---- The old collection, through the REST API ----

/** Where the REST API is, and who's asking. */
export interface RestTarget {
  projectId: string;
  /** A Firebase ID token for the signed-in user. */
  token: () => Promise<string>;
  /** Defaults to Firestore's; the check script points it at the emulator. */
  base?: string;
  fetch?: typeof fetch;
}

const REST_BASE = 'https://firestore.googleapis.com/v1';
const REST_TIMEOUT_MS = 30_000;

const documentsUrl = (t: RestTarget): string =>
  `${t.base ?? REST_BASE}/projects/${encodeURIComponent(t.projectId)}/databases/(default)/documents`;

/** An HTTP error from the REST API; `code` is its status name, as the SDK's errors have. */
export class RestError extends Error {
  constructor(readonly status: number, readonly code: string) {
    super(`Firestore REST ${status} ${code}`);
  }
}

async function call(t: RestTarget, url: string, init: RequestInit = {}): Promise<any> {
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), REST_TIMEOUT_MS) : undefined;
  try {
    const res = await (t.fetch ?? fetch)(url, {
      ...init,
      headers: { Authorization: `Bearer ${await t.token()}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
      signal: controller?.signal,
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new RestError(res.status, String(body?.error?.status ?? 'unknown'));
    return body;
  } finally {
    clearTimeout(timer);
  }
}

/** Every document left in a wallet's old collection, as the REST API lists them. */
export async function listOldEntries(t: RestTarget, uid: string): Promise<RestDoc[]> {
  const out: RestDoc[] = [];
  let pageToken = '';
  do {
    const query = `pageSize=1000${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`;
    const body = await call(t, `${documentsUrl(t)}/users/${encodeURIComponent(uid)}/transactions?${query}`);
    if (Array.isArray(body.documents)) out.push(...body.documents);
    pageToken = typeof body.nextPageToken === 'string' ? body.nextPageToken : '';
  } while (pageToken);
  return out;
}

/** Deletes old documents by their full names, 500 to a request. */
export async function deleteOldEntries(t: RestTarget, names: readonly string[]): Promise<void> {
  for (let i = 0; i < names.length; i += 500) {
    await call(t, `${documentsUrl(t)}:commit`, {
      method: 'POST',
      body: JSON.stringify({ writes: names.slice(i, i + 500).map(name => ({ delete: name })) }),
    });
  }
}

export interface Moved {
  /** The wallet's entries, as written to their months. */
  entries: Transaction[];
  layout: MonthLayout;
  /** The old documents' full names, to delete once the move is marked done. */
  oldNames: string[];
}

/**
 * Writes every entry of the old collection to its month. Run only once
 * older versions can no longer add to the old collection (the rules refuse
 * them once settings say `entriesIn: 'moving'`), so the read misses nothing.
 * Safe to run again: each entry is written whole to the same place.
 */
export async function moveToMonths(db: Firestore, uid: string, t: RestTarget): Promise<Moved> {
  const old = await listOldEntries(t, uid);
  const { changes, layout } = layOut(old.map(entryFromRest));
  await Promise.all(commitChanges(db, uid, changes));
  const entries = changes.flatMap(c => Object.values(c.set));
  return { entries, layout, oldNames: old.map(d => d.name) };
}

/**
 * Deletes what's left of the old collection. An entry the months don't hold
 * (a document no earlier read saw) is written to its month first. Returns
 * how many documents were left.
 */
export async function clearOldEntries(
  db: Firestore,
  uid: string,
  t: RestTarget,
  layout: MonthLayout,
  known: readonly string[] = [],
): Promise<number> {
  const listed = await listOldEntries(t, uid);
  const names = new Set([...known, ...listed.map(d => d.name)]);
  const strays = listed.map(entryFromRest).filter(e => !layout.docsOf.has(e.id));
  if (strays.length > 0) await saveToMonths(db, uid, layout, strays);
  await deleteOldEntries(t, [...names]);
  return names.size;
}
