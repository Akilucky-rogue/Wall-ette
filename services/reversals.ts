// ═══════════════════════════════════════════════════════════════
// REVERSALS — a payment that came back cancels out
// ═══════════════════════════════════════════════════════════════
//
// When a UPI or IMPS payment fails after the money left, the bank sends it
// back as a credit that names the same reference ("REV/UPI/612345678901/…",
// "UPI/REV/612345678901/…"). Counted as they come, the payment is spending
// and its reversal income, and both totals are wrong. Paired here by bank
// reference and amount, both become money moved (services/spend.ts), so they
// cancel out and stay in the balance.
//
// Only an exact pair counts: the same reference, the same amount to the
// paisa, the credit on or after the payment's day, and a word saying it was
// reversed or refunded. Each payment pairs once.
//
// No React or Firebase imports, so the check scripts run it in Node.

import { Transaction, TransactionType } from '../types';
import { bankReference } from './statementImport';
import { narrationFields } from './narration';

const SAYS_REVERSED = /\brev\b|\brevers(al|ed)\b|\brefund(ed)?\b|\brfnd\b|\bchargeback\b/i;
const LEADING_REV = /^rev(ersal)?$/i;

const paise = (amount: number): number => Math.round(amount * 100);

/** The bank reference of a payment: its narration, or the note when the payee was renamed. */
const referenceOf = (t: Transaction): string | null => bankReference(t.merchant) ?? bankReference(t.note);

/**
 * The reference a reversal names. Its narration may put "REV" before the
 * rail ("REV/UPI/6123…/…", HDFC's "REV-UPI-…"), where bankReference expects
 * the rail first, so a leading REV field is dropped before reading it.
 */
function reversedReference(t: Transaction): string | null {
  for (const text of [t.merchant, t.note]) {
    if (!text) continue;
    const fields = narrationFields(text.replace(/^\s*rev(ersal)?\s*-\s*/i, 'REV/'));
    while (fields.length > 1 && LEADING_REV.test(fields[0].replace(/\s+/g, ''))) fields.shift();
    const ref = bankReference(fields.join('/'));
    if (ref) return ref;
  }
  return null;
}

/** Ids of payments and the reversals that cancel them, both sides of each pair. */
export function reversalPairs(list: readonly Transaction[]): Set<string> {
  const paymentsByRef = new Map<string, Transaction[]>();
  for (const t of list) {
    if (t.type !== TransactionType.EXPENSE) continue;
    const ref = referenceOf(t);
    if (!ref) continue;
    const same = paymentsByRef.get(ref);
    if (same) same.push(t); else paymentsByRef.set(ref, [t]);
  }
  const paired = new Set<string>();
  if (paymentsByRef.size === 0) return paired;
  for (const t of list) {
    if (t.type !== TransactionType.INCOME) continue;
    if (!SAYS_REVERSED.test(`${t.merchant ?? ''} ${t.note ?? ''}`)) continue;
    const ref = reversedReference(t);
    if (!ref) continue;
    const payment = paymentsByRef.get(ref)?.find(p =>
      !paired.has(p.id) && paise(p.amount) === paise(t.amount) && p.date.slice(0, 10) <= t.date.slice(0, 10));
    if (!payment) continue;
    paired.add(payment.id);
    paired.add(t.id);
  }
  return paired;
}
