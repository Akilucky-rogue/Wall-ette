// ═══════════════════════════════════════════════════════════════
// TO REVIEW — transfers the importer couldn't name, until someone says
// what they were
// ═══════════════════════════════════════════════════════════════
//
// The importer files a UPI, IMPS, NEFT or IFT payment it can't name as
// "Transfer Out", and those count as spending (services/spend.ts). In one
// tester's wallet that was 89% of all payments, under a label that sounded
// settled. So a payment like that shows as "To review" on every screen until
// its payee is sorted, and the review after each import (and in Money moved)
// suggests what each payee was.
//
// Nothing here changes a stored entry: the label is worked out from the
// payee rules each time (WalletContext.transactions), so sorting a payee, or
// deleting its rule, relabels every payment to it at once.
//
// No React or Firebase imports, so the check scripts run it in Node.

import { Transaction, TransactionType, type PayeeKind } from '../types';
import { INVESTMENT_PLATFORM } from './categorize';
import { matchText, payeeName, suggestPayees, type FlowInfo, type PayeeSuggestion } from './spend';

export const TO_REVIEW = 'To review';

/** Categories that only say money was transferred, not what it was for. */
const TRANSFER_CATEGORIES = new Set(['Transfer Out', 'Transfer In', TO_REVIEW]);

/**
 * The category an entry shows under:
 *   - a transfer out to a payee no rule covers: "To review"
 *   - a transfer out to a payee sorted as counting, with a category: that
 *     category (a landlord's payments as Rent)
 *   - otherwise its own category ("To review" kept in storage reads as
 *     Transfer Out or Transfer In once its payee is sorted)
 * Only statement payments with a payee name can be sorted, so only those
 * read "To review"; a transfer typed by hand keeps its category.
 */
export function shownCategory(t: Transaction, info: FlowInfo): string {
  if (!TRANSFER_CATEGORIES.has(t.category)) return t.category;
  const out = t.type === TransactionType.EXPENSE;
  if (out && info.rule?.kind === 'counts' && info.rule.category) return info.rule.category;
  if (out && !info.rule && info.flow === 'spend' && payeeName(t.merchant)) return TO_REVIEW;
  return t.category === TO_REVIEW ? (out ? 'Transfer Out' : 'Transfer In') : t.category;
}

/** The list with each entry under the category it shows; unchanged entries keep their object. */
export function withShownCategories(list: readonly Transaction[], flowOf: (t: Transaction) => FlowInfo): Transaction[] {
  return list.map(t => {
    const category = shownCategory(t, flowOf(t));
    return category === t.category ? t : { ...t, category };
  });
}

/**
 * The category to store when an entry shown as `shown` is saved from the
 * Edit dialog with `category`: unchanged from what was shown means the
 * stored one stays, so a relabel never becomes data.
 */
export const categoryToStore = (stored: Transaction, shown: string, category: string): string =>
  category === shown ? stored.category : category;

// ── The review: what each payee was ─────────────────────────────────────────

export type ReviewChoiceId = 'investment' | 'rent' | 'software' | 'family' | 'mine' | 'spend';

export interface ReviewChoice {
  id: ReviewChoiceId;
  label: string;
  icon: string;
  /** The rule a tap saves for the payee. */
  kind: PayeeKind;
  /** For a payee that counts: the category its payments show under. */
  category?: string;
}

/** The answers the review offers, in the order shown. */
export const REVIEW_CHOICES: readonly ReviewChoice[] = [
  { id: 'investment', label: 'Investment', icon: 'trending_up', kind: 'investment' },
  { id: 'rent', label: 'Rent or maintenance', icon: 'home', kind: 'counts', category: 'Rent' },
  { id: 'software', label: 'Software', icon: 'terminal', kind: 'counts', category: 'Software' },
  { id: 'family', label: 'Family', icon: 'diversity_3', kind: 'family' },
  { id: 'mine', label: 'My own account', icon: 'account_balance', kind: 'mine' },
  { id: 'spend', label: 'Other spending', icon: 'payments', kind: 'counts', category: 'Other' },
];

const INVESTMENT_WORDS = /mutual ?fund|\bmf\b|\bamc\b|\bsip\b|securities|broking|brokers?|capital market|invest|wealth|\bnps\b|\bppf\b|demat|clearing|stock ?exchange|\bnse\b|\bbse\b|asset management/;
const RENT_WORDS = /\brent\b|rental|landlord|society|\bchs\b|co ?op(erative)? (hsg|housing)|\bhsg\b|housing|maintenance|apartments?|residency|residences|towers?|heights|owners? association|\brwa\b|nobroker|nestaway|realty|estates?/;
const SOFTWARE_WORDS = /google|apple|microsoft|adobe|openai|chatgpt|anthropic|claude|github|atlassian|jetbrains|notion|figma|canva|zoom|slack|dropbox|digitalocean|hostinger|godaddy|namecheap|cloudflare|vercel|heroku|amazon web services|\baws\b|linode|replit|cursor|grammarly|1password/;
// Words that mark a business, not a person.
const BUSINESS_WORDS = /\b(ltd|limited|pvt|private|llp|inc|corp|corporation|co|company|enterprises?|traders?|trading|stores?|mart|services?|solutions?|technologies|technology|tech|india|bank|finance|financial|payments?|retail|foods?|hotels?|restaurants?|cafe|medical|medicals|pharma|pharmacy|hospital|clinic|motors?|agency|agencies|industries|international|global|digital|systems?|labs?|ventures|associates|group|trust|foundation|centre|center|shop|studio|works|electricals?|electronics|garments|textiles|jewell?ers|sweets|bakery|dairy|kirana|general|automobiles?)\b/;

/**
 * What a payee most likely was, from its name alone, or null when the name
 * says nothing. A guess to tap, never applied without the tap.
 */
export function suggestChoice(name: string): ReviewChoiceId | null {
  const text = name.toLowerCase();
  if (INVESTMENT_PLATFORM.test(text) || INVESTMENT_WORDS.test(text)) return 'investment';
  if (RENT_WORDS.test(text)) return 'rent';
  if (SOFTWARE_WORDS.test(text)) return 'software';
  // A person: two to four words of letters, none a business word.
  const words = matchText(name).split(' ').filter(Boolean);
  if (words.length >= 2 && words.length <= 4 && words.every(w => /^[a-z]+$/.test(w)) && !BUSINESS_WORDS.test(words.join(' '))) return 'family';
  return null;
}

export interface ReviewPayee extends PayeeSuggestion {
  suggestion: ReviewChoiceId | null;
}

/**
 * Payees with payments still to review, money out first and largest first,
 * each with a suggestion. With `onlyIds`, only payees with a payment among
 * those (the rows an import just added).
 */
export function reviewPayees(
  transactions: readonly Transaction[],
  flowOf: (t: Transaction) => FlowInfo,
  onlyIds?: ReadonlySet<string>,
): ReviewPayee[] {
  const list = onlyIds ? transactionsOfPayeesIn(transactions, onlyIds) : transactions;
  return suggestPayees(list, flowOf, 0)
    .filter(p => p.out > 0)
    .map(p => ({ ...p, suggestion: suggestChoice(p.name) }));
}

// Every payment to a payee that has at least one payment among `ids`, so a
// payee's totals cover all its payments, not only this import's.
function transactionsOfPayeesIn(transactions: readonly Transaction[], ids: ReadonlySet<string>): Transaction[] {
  const keys = new Set<string>();
  for (const t of transactions) {
    if (!ids.has(t.id)) continue;
    const name = payeeName(t.merchant);
    if (name) keys.add(matchText(name));
  }
  return transactions.filter(t => {
    const name = payeeName(t.merchant);
    return !!name && keys.has(matchText(name));
  });
}

/** Money out still to review in `list` (entries already under their shown category). */
export const toReviewTotal = (list: readonly Transaction[]): { amount: number; count: number } => {
  let amount = 0, count = 0;
  for (const t of list) {
    if (t.category !== TO_REVIEW || t.type !== TransactionType.EXPENSE) continue;
    amount += t.amount;
    count++;
  }
  return { amount, count };
};
