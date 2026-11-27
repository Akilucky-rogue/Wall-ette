// ═══════════════════════════════════════════════════════════════
// SPENDING — what counts as spending, income, or money moved
// ═══════════════════════════════════════════════════════════════
//
// The statement categorizer files every UPI, IFT, NEFT or IMPS debit it can't
// name as Transfer Out, so the payment rail says nothing about whether money
// was spent (audit H3). This decides by payee instead, in this order:
//   1. A payee rule (Money Moved screen) wins. Your own accounts, family,
//      investments and ignored payees are money moved; "counts" and "salary"
//      keep a payee counted.
//   0. A payment and its reversal (paired by bank reference in
//      services/reversals.ts) cancel out: both are money moved.
//   1. (as above)
//   2. Investments (debits filed as Investment, credits from a broker or a
//      fund redemption) and balance adjustments are money moved.
//   3. Everything else counts: debits as spending, credits as income.
// Money moved stays in the balance but is neither spending nor income. Every
// screen reads totals through flowClassifier (via the wallet's flowOf and
// counted), so they agree.

import { Transaction, TransactionType, type PayeeKind, type PayeeRule } from '../types';
import { INVESTMENT_PLATFORM } from './categorize';
import { payeeFields } from './narration';

export type Flow = 'spend' | 'income' | 'moved';
export type MovedKind = 'mine' | 'family' | 'investment' | 'ignore' | 'adjustment' | 'reversal';

export interface FlowInfo {
  flow: Flow;
  /** Why the money was moved, when it was. */
  moved: MovedKind | null;
  /** The payee rule that decided it, if one did. */
  rule: PayeeRule | null;
}

export const MOVED_LABELS: Record<MovedKind, string> = {
  mine: 'My accounts',
  family: 'Family',
  investment: 'Investments',
  ignore: 'Not counted',
  adjustment: 'Adjustments',
  reversal: 'Reversed',
};

const MOVED_KINDS = new Set<PayeeKind>(['mine', 'family', 'investment', 'ignore']);
const FUND_REDEMPTION = /redemption/;

// Words that vary between narrations of the same payee ("Mr.", "and", "Pvt Ltd").
const FILLER = new Set(['mr', 'mrs', 'ms', 'dr', 'and', 'the', 'pvt', 'private', 'ltd', 'limited']);

/**
 * Lower-case words, without filler, for matching payees:
 * "Mr. RAVI/KUMAR" → "ravi kumar",
 * "TEST AND SONS PVT LTD" → "test sons".
 */
export const matchText = (s: string): string =>
  s.toLowerCase().split(/[^a-z0-9]+/).filter(w => w && !FILLER.has(w)).join(' ');

/** Shortest match a rule may have, so one letter can't swallow everything. */
export const MIN_MATCH = 2;

/**
 * A classifier for one set of rules, and the ids of payments paired with
 * their reversals. Results are cached per transaction object; make a new
 * classifier when either changes.
 */
export function flowClassifier(
  rules: readonly PayeeRule[],
  reversed: ReadonlySet<string> = new Set(),
): (t: Transaction) => FlowInfo {
  const compiled = rules
    .map(rule => ({ rule, needle: ` ${matchText(rule.match)} ` }))
    .filter(r => r.needle.trim().length >= MIN_MATCH)
    .sort((a, b) => b.needle.length - a.needle.length); // most specific first
  const cache = new WeakMap<Transaction, FlowInfo>();

  return (t: Transaction): FlowInfo => {
    const hit = cache.get(t);
    if (hit) return hit;
    const income = t.type === TransactionType.INCOME;
    const counted: Flow = income ? 'income' : 'spend';
    let info: FlowInfo = { flow: counted, moved: null, rule: null };

    const haystack = ` ${matchText(t.merchant || '')} `;
    const match = reversed.has(t.id) ? undefined : compiled.find(c => haystack.includes(c.needle));
    if (reversed.has(t.id)) {
      info = { flow: 'moved', moved: 'reversal', rule: null };
    } else if (match) {
      const kind = match.rule.kind;
      info = MOVED_KINDS.has(kind)
        ? { flow: 'moved', moved: kind as MovedKind, rule: match.rule }
        : { flow: counted, moved: null, rule: match.rule };
    } else if (t.category === 'Adjustment') {
      info = { flow: 'moved', moved: 'adjustment', rule: null };
    } else if (!income && t.category === 'Investment') {
      info = { flow: 'moved', moved: 'investment', rule: null };
    } else if (income && t.category === 'Redemption proceeds') {
      info = { flow: 'moved', moved: 'investment', rule: null };
    } else if (income) {
      const text = (t.merchant || '').toLowerCase();
      if (INVESTMENT_PLATFORM.test(text) || FUND_REDEMPTION.test(text)) {
        info = { flow: 'moved', moved: 'investment', rule: null };
      }
    }
    cache.set(t, info);
    return info;
  };
}

/** The audit's isSpend(): true when a transaction is real spending. */
export const isSpend = (t: Transaction, flowOf: (t: Transaction) => FlowInfo): boolean =>
  flowOf(t).flow === 'spend';

// ── Payees ─────────────────────────────────────────────────────────────────

// Narration pieces that are plumbing or boilerplate, not a payee.
const NOT_A_PAYEE = /^(upi|mob|dr|cr|rev|neft|imps|rtgs|ift|nach|ach( ?[cd]| credit| debit)?|ecs|mut|si|tpt|pos|atm|nfs|cw|opm|inet|visa|ecom|self|trf ?(fr|from|to)?|pay|pay ?req(uest)?|pay ?via ?r(azorpay)?|fund ?tr(f|ansfer)|transfer|payment|credit adjustment)$/i;

/**
 * Banks' four-letter codes (an IFSC's first part). UPI narrations put the
 * payee's bank after the payee ("…/ZOMATO L/UTIB/…"), but IMPS ones can put
 * it before ("IMPS/DR/…/HDFC/RENT AUG 2026/KAPOOR HOMES"), where it was read
 * as the payee.
 */
export const BANK_CODES = new Set([
  'ABHY', 'AIRP', 'APGB', 'AUBL', 'BACB', 'BARB', 'BDBL', 'BKID', 'CBIN', 'CITI', 'CNRB', 'COSB', 'CSBK', 'DBSS',
  'DEUT', 'DLXB', 'ESFB', 'FDRL', 'FINO', 'GSCB', 'HDFC', 'HSBC', 'IBKL', 'ICIC', 'IDFB', 'IDIB', 'INDB', 'IOBA',
  'JAKA', 'JIOP', 'KARB', 'KCCB', 'KJSB', 'KKBK', 'KVBL', 'MAHB', 'NKGS', 'NSPB', 'PSIB', 'PUNB', 'PYTM', 'RATN',
  'SBIN', 'SCBL', 'SIBL', 'SRCB', 'SURY', 'SVCB', 'TJSB', 'TMBL', 'UBIN', 'UCBA', 'UJVN', 'UTIB', 'UTKS', 'YESB',
]);

/**
 * Payment gateways that stand in a narration's payee field for the shop
 * that used them ("UPI-PAYU-…-BEYOUNG FOLKS PRIV", "UPI-ACWO-ACWO.BDPG@…").
 * A field after them names the shop when there is one.
 */
export const GATEWAYS: Readonly<Record<string, string>> = {
  PAYU: 'PayU', ACWO: 'BillDesk', BDPG: 'BillDesk', BILLDESK: 'BillDesk', RAZORPAY: 'Razorpay', RZP: 'Razorpay',
  CASHFREE: 'Cashfree', CCAVENUE: 'CCAvenue', JUSPAY: 'Juspay', EASEBUZZ: 'Easebuzz', PINELABS: 'Pine Labs',
};

/**
 * The payee named in a statement narration, or null when it names none.
 *   "IFT/1000…/Mr. RAVI KUMAR SHAH/123"           → "Mr. RAVI KUMAR SHAH"
 *   "UPI/DR/6152…/ZOMATO L/UTIB/zomatoo/UPI"       → "ZOMATO L"
 *   "UPI-ZOMATO LTD-zomato@axis-UTIB0…-6152…" (HDFC) → "ZOMATO LTD"
 *   "MB/TRF FR/RAVI SHAH/" (Saraswat)              → "RAVI SHAH"
 *   "NEFT/CMS123/CHOICE EQUITY BROKING PVT LTD/…"  → "CHOICE EQUITY BROKING PVT LTD"
 *   "UPI/MOB/6152…/UPI", "IMPS-OPM/Fund Trf/…"     → null
 */
export function payeeName(narration: string | undefined): string | null {
  if (!narration) return null;
  const segs = payeeFields(narration);
  if (segs.length < 2) return null; // a plain name typed in New Entry is not a statement payee
  // HDFC's UPI Lite top-ups ("UPI-LITE-…-ADD MONEY") move money to your own UPI Lite balance.
  if (/^upi$/i.test(segs[0]) && /^lite$/i.test(segs[1])) return 'UPI Lite top-up';
  let gateway: string | null = null;
  for (const seg of segs.slice(1)) {
    if (NOT_A_PAYEE.test(seg)) continue;
    if (/\d{3,}/.test(seg)) continue;                  // references, account numbers
    if (/^[A-Z]{4}0[A-Z0-9]{5,}$/i.test(seg)) continue; // IFSC codes
    if (BANK_CODES.has(seg.toUpperCase())) continue;   // a bank's code
    if (seg.includes('@')) continue;                   // a UPI ID: the payee's name is in its own field
    if ((seg.match(/[a-z]/gi) || []).length < 3) continue;
    if (GATEWAYS[seg.toUpperCase()]) { gateway ??= seg; continue; }
    return seg;
  }
  return gateway;
}

export interface PayeeSuggestion {
  /** As the statement shows it, e.g. "Mr. RAVI KUMAR SHAH". */
  name: string;
  /** What a rule for it would match. */
  match: string;
  out: number;
  in: number;
  count: number;
  /** Latest date, YYYY-MM-DD. */
  last: string;
}

/**
 * Payees of statement transfers that no rule covers yet, largest first. These
 * count as spending and income until sorted, so they are what to ask about.
 */
export function suggestPayees(
  transactions: readonly Transaction[],
  flowOf: (t: Transaction) => FlowInfo,
  minTotal = 5000,
): PayeeSuggestion[] {
  const groups = new Map<string, PayeeSuggestion>();
  for (const t of transactions) {
    if (t.category !== 'Transfer Out' && t.category !== 'Transfer In' && t.category !== 'To review') continue;
    const info = flowOf(t);
    if (info.rule || info.flow === 'moved') continue;
    const name = payeeName(t.merchant);
    if (!name) continue;
    const match = matchText(name);
    if (match.length < 3) continue;
    let g = groups.get(match);
    if (!g) groups.set(match, (g = { name, match, out: 0, in: 0, count: 0, last: t.date }));
    if (t.type === TransactionType.INCOME) g.in += t.amount; else g.out += t.amount;
    g.count++;
    if (t.date > g.last) g.last = t.date;
  }
  return [...groups.values()]
    .filter(g => g.out + g.in >= minTotal)
    .sort((a, b) => b.out + b.in - (a.out + a.in));
}
