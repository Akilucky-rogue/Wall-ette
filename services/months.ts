/**
 * Entries stored by month (docs/PLAN_1.6.0.md).
 *
 * A wallet's entries live in one Firestore document per month,
 * users/{uid}/months/{YYYY-MM}, as a map from entry id to the entry: about 30
 * documents for 2,700 entries instead of 2,700. A first sign-in on a device
 * then stores a few dozen documents in Firestore's offline cache rather than
 * thousands, which took 51 s in an Android WebView (TECH_SPEC.md §10).
 *
 * A document holds at most 1 MiB. A month whose entries would pass
 * MONTH_DOC_LIMIT spills into YYYY-MM-2, then -3. An entry stays in the
 * document it's in until its month changes or that document runs out of
 * room. An id found in more than one document (a move cut short and run
 * again) is read from the one that matches its month, and taken out of the
 * others at its next change.
 *
 * Plain functions, no Firestore, so the check scripts run them in Node
 * (scripts/check-months.mjs). services/monthStore.ts does the reading and
 * writing.
 */
import type { Transaction } from '../types';
import { fromTimestamp } from '../utils/dates';

/** Bytes a month document may hold before a new entry goes to the next part. */
export const MONTH_DOC_LIMIT = 900 * 1024;

/** A month document's name, its `entries` field and Firestore's own overhead, generously. */
export const DOC_BASE_SIZE = 256;

const MONTH = /^(\d{4})-(\d{2})/;

/** The month an entry belongs to, 'YYYY-MM'; '0000-00' for a day that can't be read. */
export const monthOf = (date: string): string => {
  const m = typeof date === 'string' ? MONTH.exec(date) : null;
  return m ? `${m[1]}-${m[2]}` : '0000-00';
};

/** A month's documents: 'YYYY-MM', then 'YYYY-MM-2', 'YYYY-MM-3'. */
export const partId = (month: string, part: number): string => (part <= 1 ? month : `${month}-${part}`);

/** The month a document holds. */
export const monthOfDoc = (docId: string): string => docId.slice(0, 7);

/** What a month document's id looks like (the rules check the same). */
export const MONTH_DOC_ID = /^\d{4}-\d{2}(-\d+)?$/;

/**
 * Ids Firestore can't take as a map key: empty, or reserved (`__name__`).
 * Ids from the app and from backups never look like this
 * (services/backup.ts); entries with one stay out of the cloud.
 */
export const storableId = (id: unknown): id is string =>
  typeof id === 'string' && id.length > 0 && id.length <= 700 && !/^__.*__$/.test(id);

// UTF-8 length without allocating: Firestore counts strings in UTF-8 bytes.
const utf8 = (s: string): number => {
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 0x80) n += 1;
    else if (c < 0x800) n += 2;
    else if (c >= 0xd800 && c <= 0xdbff) { n += 4; i++; }
    else n += 3;
  }
  return n;
};

// Firestore's storage sizes: a string is its bytes plus one, a number or
// timestamp 8, a boolean or null 1, a map its keys (plus one each) and values.
const valueSize = (v: unknown): number => {
  if (v === null || v === undefined) return 1;
  switch (typeof v) {
    case 'string': return utf8(v) + 1;
    case 'number': return 8;
    case 'boolean': return 1;
    case 'object': {
      if (Array.isArray(v)) return v.reduce((n: number, x) => n + valueSize(x), 0);
      let n = 0;
      for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
        if (x === undefined) continue;
        n += utf8(k) + 1 + valueSize(x);
      }
      return n;
    }
    default: return 8;
  }
};

/** An entry's size in its month's map: its key and its fields. */
export const entrySize = (t: Transaction): number => utf8(t.id) + 1 + valueSize(t);

/** Where each entry is, and how full each document is. */
export interface MonthLayout {
  /** The documents each entry id is in: one, except after a move cut short. */
  docsOf: Map<string, string[]>;
  /** Each document's size in bytes, roughly as Firestore counts it. */
  sizes: Map<string, number>;
  /** Each entry's size inside its document. */
  entrySizes: Map<string, number>;
}

export const emptyLayout = (): MonthLayout => ({ docsOf: new Map(), sizes: new Map(), entrySizes: new Map() });

/** One month document's part of a change: entries to save whole, and ids to take out. */
export interface MonthChange {
  docId: string;
  set: Record<string, Transaction>;
  remove: string[];
}

/** A month document as read: its id and its `entries` map. */
export interface MonthDoc {
  id: string;
  entries: Record<string, unknown> | undefined;
}

/**
 * Every entry in the month documents, and the layout they're in. An id in
 * two documents is read once: from the one that matches its day's month,
 * and between two that both do (parts of one month, after a move cut short
 * and run again), from the later part, whatever order the documents come in.
 */
export function readMonths(docs: MonthDoc[]): { entries: Transaction[]; layout: MonthLayout } {
  const layout = emptyLayout();
  const chosen = new Map<string, { t: Transaction; fits: boolean; docId: string }>();
  for (const d of docs) {
    let size = DOC_BASE_SIZE;
    const entries = d.entries && typeof d.entries === 'object' ? d.entries : {};
    for (const [id, raw] of Object.entries(entries)) {
      if (!raw || typeof raw !== 'object') continue;
      const t = { ...(raw as object), id } as Transaction;
      const s = entrySize(t);
      size += s;
      layout.entrySizes.set(id, s);
      const where = layout.docsOf.get(id);
      if (where) where.push(d.id);
      else layout.docsOf.set(id, [d.id]);
      const fits = monthOf(t.date) === monthOfDoc(d.id);
      const before = chosen.get(id);
      if (!before || (fits && !before.fits) || (fits === before.fits && d.id > before.docId)) chosen.set(id, { t, fits, docId: d.id });
    }
    layout.sizes.set(d.id, size);
  }
  return { entries: [...chosen.values()].map(c => c.t), layout };
}

/**
 * The document changes that save `set` (new or changed entries, sent whole)
 * and take out `remove` (entries, by id, with their day in case the layout
 * doesn't know them yet). The layout is updated as it goes, so changes made
 * before the next snapshot place entries where the last ones went.
 */
export function planChanges(
  layout: MonthLayout,
  set: readonly Transaction[],
  remove: readonly Pick<Transaction, 'id' | 'date'>[] = [],
): MonthChange[] {
  const changes = new Map<string, MonthChange>();
  const changeOf = (docId: string): MonthChange => {
    let c = changes.get(docId);
    if (!c) { c = { docId, set: {}, remove: [] }; changes.set(docId, c); }
    return c;
  };
  const sizeOf = (docId: string) => layout.sizes.get(docId) ?? DOC_BASE_SIZE;
  const takeOut = (docId: string, id: string, size: number) => {
    const c = changeOf(docId);
    delete c.set[id];
    if (!c.remove.includes(id)) c.remove.push(id);
    layout.sizes.set(docId, Math.max(DOC_BASE_SIZE, sizeOf(docId) - size));
  };
  const roomIn = (month: string, size: number): string => {
    for (let part = 1; ; part++) {
      const id = partId(month, part);
      if (sizeOf(id) + size <= MONTH_DOC_LIMIT) return id;
    }
  };

  for (const t of set) {
    if (!storableId(t.id)) continue;
    const month = monthOf(t.date);
    const size = entrySize(t);
    const old = layout.entrySizes.get(t.id) ?? 0;
    const current = layout.docsOf.get(t.id) ?? [];
    const home = current.find(d => monthOfDoc(d) === month && sizeOf(d) - old + size <= MONTH_DOC_LIMIT)
      ?? roomIn(month, size);
    for (const d of current) if (d !== home) takeOut(d, t.id, old);
    const c = changeOf(home);
    c.set[t.id] = t;
    c.remove = c.remove.filter(id => id !== t.id);
    layout.sizes.set(home, sizeOf(home) - (current.includes(home) ? old : 0) + size);
    layout.docsOf.set(t.id, [home]);
    layout.entrySizes.set(t.id, size);
  }

  for (const r of remove) {
    const current = layout.docsOf.get(r.id);
    const docs = current && current.length > 0 ? current : [partId(monthOf(r.date), 1)];
    const size = layout.entrySizes.get(r.id) ?? 0;
    for (const d of docs) takeOut(d, r.id, size);
    layout.docsOf.delete(r.id);
    layout.entrySizes.delete(r.id);
  }

  return [...changes.values()].filter(c => Object.keys(c.set).length > 0 || c.remove.length > 0);
}

/**
 * The day to store for an entry an earlier version saved as a UTC
 * timestamp (audit H4), so a moved wallet keeps local days only.
 */
export const withLocalDay = (t: Transaction): Transaction => {
  const fixed = typeof t.date === 'string' ? fromTimestamp(t.date) : null;
  if (!fixed) return t;
  return t.createdAt || !fixed.createdAt ? { ...t, date: fixed.date } : { ...t, ...fixed };
};

/**
 * Every entry in its month documents, for a wallet moving to month storage:
 * entries in day order (then id), so moving the same entries again lays
 * them out the same way.
 */
export function layOut(entries: readonly Transaction[]): { changes: MonthChange[]; layout: MonthLayout } {
  const layout = emptyLayout();
  const sorted = entries
    .filter(t => storableId(t.id))
    .map(withLocalDay)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return { changes: planChanges(layout, sorted), layout };
}

// ---- Firestore's REST format, for reading the documents the move replaces ----

export interface RestValue {
  stringValue?: string;
  integerValue?: string;
  doubleValue?: number | string;
  booleanValue?: boolean;
  nullValue?: null;
  timestampValue?: string;
  mapValue?: { fields?: Record<string, RestValue> };
  arrayValue?: { values?: RestValue[] };
}

/** A document as the REST API lists it. */
export interface RestDoc {
  name: string;
  fields?: Record<string, RestValue>;
  updateTime?: string;
}

/** A REST value as the JavaScript SDK would read it (timestamps as ISO strings). */
export function fromRest(v: RestValue): unknown {
  if (!v || typeof v !== 'object') return undefined;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return Number(v.doubleValue);
  if ('booleanValue' in v) return v.booleanValue;
  if ('nullValue' in v) return null;
  if ('timestampValue' in v) return v.timestampValue;
  if ('mapValue' in v) return fromRestFields(v.mapValue?.fields ?? {});
  if ('arrayValue' in v) return (v.arrayValue?.values ?? []).map(fromRest);
  return undefined;
}

export const fromRestFields = (fields: Record<string, RestValue>): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) {
    const value = fromRest(v);
    if (value !== undefined) out[k] = value;
  }
  return out;
};

/** A document's id: the last part of its name. */
export const restDocId = (name: string): string => name.slice(name.lastIndexOf('/') + 1);

/** An entry from the old one-document-per-entry collection; its id is the document's. */
export const entryFromRest = (doc: RestDoc): Transaction =>
  ({ ...fromRestFields(doc.fields ?? {}), id: restDocId(doc.name) } as Transaction);
