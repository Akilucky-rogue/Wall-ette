/**
 * Entries Wall-ette adds by itself from payment apps' notifications and
 * shared text (from 1.6.0): what to add, what to ask about, and, when a
 * statement arrives, which of its rows take their place. Nothing counts
 * twice:
 *   - the same notification read again (after the reader reconnects, or an
 *     app posting it again) is added once;
 *   - one payment notified by two apps (Google Pay and the bank's app) is
 *     added once;
 *   - a payment that looks like one already typed in New Entry, or another
 *     from the same app moments before, is asked about, not added;
 *   - a statement row for a payment read from an app takes the entry's
 *     place on import, keeping its category and note (services/statementImport.ts
 *     users: components/ImportStatement.tsx).
 *
 * No React or Firebase imports, so the check scripts run it in Node.
 */
import type { Transaction } from '../types';
import { readNotice, readShared, noticeEntryId, sharedEntryId, paymentEntry, SHARED, type AppPayment, type Notice } from './paymentAlerts';
import { bankReference } from './statementImport';
import { payeeFields } from './narration';

/** An entry Wall-ette added from a payment app or shared text. */
export const isCaptured = (t: Pick<Transaction, 'via'>): boolean => !!t.via;

const paise = (n: number) => Math.round(n * 100);
const refOf = (t: Pick<Transaction, 'merchant' | 'note'>): string | null => bankReference(t.merchant) ?? bankReference(t.note);
const dayGap = (a: string, b: string): number =>
  Math.abs(Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10)) - Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10))) / 86_400_000;
const MINUTE = 60_000;

// ── Whose payment ────────────────────────────────────────────────────────────

const NOT_A_NAME_WORD = new Set(['upi', 'imps', 'neft', 'rtgs', 'pos', 'atm', 'the', 'and', 'pvt', 'ltd', 'bank', 'payment', 'paid', 'from', 'okaxis', 'okhdfcbank', 'okicici', 'oksbi', 'ybl', 'ibl', 'axl', 'paytm', 'upiapp']);

/** The words of the payee an entry Wall-ette added names (its narration's last field). */
function payeeWords(t: Pick<Transaction, 'merchant'>): string[] {
  const fields = t.merchant ? payeeFields(t.merchant) : [];
  const last = fields.length > 1 ? fields[fields.length - 1] : '';
  if (!last || /^[A-Z0-9]{8,22}$/i.test(last) && /\d{6}/.test(last)) return [];
  return last.toLowerCase().split(/[^a-z]+/).filter(w => w.length >= 3 && !NOT_A_NAME_WORD.has(w));
}

/**
 * Whether a statement row names the payee an entry read from an app does:
 * most of its words in the row's narration (banks cut names short: "SAI
 * PRASAD BAR AND R"), none of them, or nothing to tell by.
 */
export function namesAgree(captured: Pick<Transaction, 'merchant'>, row: Pick<Transaction, 'merchant' | 'note'>): 'yes' | 'no' | 'unknown' {
  const words = payeeWords(captured);
  const text = `${row.merchant ?? ''} ${row.note ?? ''}`.toLowerCase().replace(/[^a-z]/g, '');
  if (words.length === 0 || text.length < 3) return 'unknown';
  const found = words.filter(w => text.includes(w)).length;
  if (found === 0) return 'no';
  return found / words.length >= 0.6 ? 'yes' : 'unknown';
}

// ── A statement arrives ──────────────────────────────────────────────────────

/**
 * Which entries read from apps a statement's rows stand for: row id →
 * entry id. A row stands for an entry with the same direction and amount
 * and, when both have a bank reference, the same one (within three days);
 * without one, dated the same day or a day either side (a payment late at
 * night can post the next day), unless they name different payees. Each
 * entry and each row pairs once, the closest first.
 */
export function capturedRows(rows: readonly Transaction[], wallet: readonly Transaction[]): Map<string, string> {
  const captured = wallet.filter(isCaptured);
  const pairs: { row: string; entry: string; score: number }[] = [];
  if (captured.length === 0) return new Map();
  for (const r of rows) {
    const rRef = refOf(r);
    for (const c of captured) {
      if (r.type !== c.type || paise(r.amount) !== paise(c.amount)) continue;
      const days = dayGap(r.date.slice(0, 10), c.date.slice(0, 10));
      const cRef = refOf(c);
      if (rRef && cRef) {
        if (rRef === cRef && days <= 3) pairs.push({ row: r.id, entry: c.id, score: 1000 - days });
        continue;
      }
      if (days > 1) continue;
      const names = namesAgree(c, r);
      if (names === 'no') continue;
      pairs.push({ row: r.id, entry: c.id, score: (names === 'yes' ? 500 : 100) - days * 10 });
    }
  }
  pairs.sort((a, b) => b.score - a.score || a.row.localeCompare(b.row) || a.entry.localeCompare(b.entry));
  const byRow = new Map<string, string>();
  const used = new Set<string>();
  for (const p of pairs) {
    if (byRow.has(p.row) || used.has(p.entry)) continue;
    byRow.set(p.row, p.entry);
    used.add(p.entry);
  }
  return byRow;
}

/** Categories that only say money moved: a statement row's own is as good. */
const PLAIN = new Set(['Other', 'Uncategorized', 'Transfer Out', 'Transfer In', 'To review']);

/** The statement row that takes an app entry's place, with the category and note it was given. */
export function carryOver(row: Transaction, entry: Transaction): Transaction {
  const out: Transaction = { ...row };
  if (entry.category && !PLAIN.has(entry.category)) out.category = entry.category;
  if (entry.note && !row.note) out.note = entry.note;
  return out;
}

// ── Reading new ones ─────────────────────────────────────────────────────────

/** A payment read and waiting for a tap ("Add this?"). Kept on this phone only. */
export interface ToCheck {
  /** The entry it becomes. */
  entry: Transaction;
  /** The notification's or shared text, for the review. */
  text: string;
  /**
   * Why it's asked about: unclear wording; "Ask me first" is on; the same
   * app notified the same amount moments before; something like it is in
   * the wallet already (typed in, or from a statement); or it was shared.
   */
  reason: 'unsure' | 'ask-first' | 'maybe-twice' | 'in-wallet' | 'shared';
  /** When it arrived (ms). */
  at: number;
}

/** A notification read, remembered for a week so an app posting it again isn't read twice. */
export interface Seen {
  app: string;
  key: string;
  type: Transaction['type'];
  amount: number;
  at: number;
  entryId: string;
}

export interface IntakePlan {
  /** Added without asking (sure, and nothing like them in the wallet). */
  add: Transaction[];
  /** To ask about. */
  check: ToCheck[];
  /** The reader's notices handled (all of them): to tell it they're read. */
  read: string[];
  /** Notifications to remember. */
  seen: Seen[];
}

const TEXT_MAX = 300;
const noticeText = (n: Notice): string =>
  [n.title, n.big || n.text].map(s => (s ?? '').replace(/\s+/g, ' ').trim()).filter(Boolean).join(' · ').slice(0, TEXT_MAX);

/**
 * What to do with notifications read from the phone: each one that is a
 * payment is added, asked about or found to be in the wallet already.
 *   - an entry with its id is in the wallet, or waiting to be checked: done;
 *   - the same app's notification with the same key, direction and amount
 *     read in the last 10 minutes: the app posted it again; done;
 *   - another app's entry with the same direction and amount within 15
 *     minutes, references not differing: the same payment; done;
 *   - the same app's, under another notification: maybe paid twice; ask;
 *   - an entry typed in New Entry with the same direction and amount, made
 *     within an hour: maybe typed already; ask;
 *   - a statement row with the same reference: done; with the same amount
 *     on the same day, not naming another payee: ask;
 *   - otherwise sure ones are added (unless "Ask me first") and the rest
 *     asked about.
 */
export function planIntake(
  notices: readonly Notice[],
  wallet: readonly Transaction[],
  waiting: readonly ToCheck[],
  seen: readonly Seen[],
  options: { askFirst: boolean },
): IntakePlan {
  const plan: IntakePlan = { add: [], check: [], read: [], seen: [] };
  const ids = new Set([...wallet.map(t => t.id), ...waiting.map(w => w.entry.id)]);
  // What a new one is compared with: the wallet's entries and those planned so far.
  const captured = wallet.filter(isCaptured).map(t => ({ t, at: Date.parse(t.createdAt ?? '') }));
  const typed = wallet.filter(t => t.id.startsWith('txn-') && t.createdAt).map(t => ({ t, at: Date.parse(t.createdAt!) }));
  const imported = wallet.filter(t => t.id.startsWith('import-'));
  const recent = [...seen];

  const sorted = [...notices].sort((a, b) => a.posted - b.posted);
  for (const n of sorted) {
    plan.read.push(n.id);
    const p = readNotice(n);
    if (!p) continue;
    const id = noticeEntryId(n, p);
    const entry = paymentEntry(p, id);
    const amount = paise(entry.amount);
    const remember = (): void => {
      const s: Seen = { app: p.app, key: n.key ?? n.id, type: entry.type, amount: entry.amount, at: p.at, entryId: id };
      plan.seen.push(s);
      recent.push(s);
    };
    if (ids.has(id)) continue;
    if (recent.some(s => s.app === p.app && s.key === (n.key ?? n.id) && s.type === entry.type && paise(s.amount) === amount && Math.abs(s.at - p.at) <= 10 * MINUTE)) continue;

    const ref = refOf(entry);
    const near = captured.filter(c => c.t.type === entry.type && paise(c.t.amount) === amount && Math.abs(c.at - p.at) <= 15 * MINUTE);
    const otherApp = near.find(c => c.t.via !== p.app && (!ref || !refOf(c.t) || refOf(c.t) === ref));
    if (otherApp) { remember(); continue; }
    const sameApp = near.some(c => c.t.via === p.app);
    const typedNear = typed.some(c => c.t.type === entry.type && paise(c.t.amount) === amount && Math.abs(c.at - p.at) <= 60 * MINUTE);
    const inStatement = imported.filter(t => t.type === entry.type && paise(t.amount) === amount && dayGap(t.date.slice(0, 10), entry.date) <= 1);
    if (ref && inStatement.some(t => refOf(t) === ref)) { remember(); continue; }

    const reason: ToCheck['reason'] | null = sameApp ? 'maybe-twice'
      : typedNear || inStatement.some(t => dayGap(t.date.slice(0, 10), entry.date) === 0 && namesAgree(entry, t) !== 'no') ? 'in-wallet'
      : !p.sure ? 'unsure'
      : options.askFirst ? 'ask-first'
      : null;
    ids.add(id);
    remember();
    captured.push({ t: entry, at: p.at });
    if (reason) plan.check.push({ entry, text: noticeText(n), reason, at: p.at });
    else plan.add.push(entry);
  }
  return plan;
}

/** Shared text as a payment to check, or null when it holds none. */
export function sharedToCheck(text: string, at: Date): ToCheck | null {
  const p: AppPayment | null = readShared(text, at);
  if (!p) return null;
  const entry = paymentEntry(p, sharedEntryId(text));
  return { entry, text: text.replace(/\s+/g, ' ').trim().slice(0, TEXT_MAX), reason: 'shared', at: at.getTime() };
}

// ── Kept on the phone ────────────────────────────────────────────────────────

const WEEK = 7 * 24 * 60 * MINUTE;
const TO_CHECK_DAYS = 60;

/** Notifications remembered for a week, at most 500. */
export const keepSeen = (list: readonly Seen[], now: number): Seen[] =>
  list.filter(s => now - s.at <= WEEK).slice(-500);

/**
 * Payments waiting for a tap: newest first, at most 100, none older than 60
 * days, one per entry id.
 */
export function keepToCheck(list: readonly ToCheck[], now: number): ToCheck[] {
  const seenIds = new Set<string>();
  return [...list]
    .sort((a, b) => b.at - a.at)
    .filter(w => now - w.at <= TO_CHECK_DAYS * 24 * 60 * MINUTE && !seenIds.has(w.entry.id) && (seenIds.add(w.entry.id), true))
    .slice(0, 100);
}

export { SHARED };
