/**
 * Payments read from payment and bank apps' notifications (Android, from
 * 1.6.0), and from text shared to Wall-ette: which apps may be read, and
 * turning one notification into a payment. Nothing here stores or sends
 * anything. The native reader (android/…/PaymentAlertListener.java) keeps
 * the notifications of the apps below that show an amount, on the phone,
 * until the app reads them; services/captured.ts decides what becomes an
 * entry.
 *
 * Which apps. Only the packages in PAYMENT_APPS. Every other app's
 * notifications are dropped unread by the native reader, and never a
 * messaging app: Play doesn't allow deriving SMS data by other means, and
 * a messaging app's notifications are messages. The Java list must match
 * this one (scripts/check-payment-alerts.mjs checks it).
 *
 * Wording. Payment apps say "Paid ₹249 to Swiggy" or "Rahul paid you ₹500";
 * bank apps mostly repeat their SMS alerts ("Rs.450.00 debited from A/c
 * XX1234 …"). Both kinds are read from every app on the list. A payment is
 * `sure` only when its wording leaves no doubt: a payment app's phrase that
 * names the amount, the direction and who it was with, or a bank alert with
 * one amount and one direction. Anything else that looks like a payment
 * waits for a tap ("Add this?").
 *
 * What is not a payment: OTPs, failed or pending payments, money requests,
 * bills due, AutoPay mandates being set up, payments still to come, offers,
 * rewards still to claim and balance alerts give nothing. Only the last
 * digits of an account or card are kept.
 *
 * The wording is checked on made-up notifications in each app's style
 * (scripts/check-payment-alerts.mjs). IDFC FIRST's bank alerts follow real
 * ones; the payment apps' must be confirmed against real notifications.
 *
 * Types and the TransactionType enum only, so the checks run in Node.
 */
import { TransactionType, type Transaction } from '../types';
import { categorizeNarration } from './categorize';

// ── Which apps ───────────────────────────────────────────────────────────────

export interface PaymentApp {
  /** Short id, kept on each entry it adds (Transaction.via). */
  id: string;
  name: string;
  /** Android package names. A bank can have an old and a new app. */
  packages: readonly string[];
  /** For a bank's own app: the bank. */
  bank?: string;
}

/**
 * The apps whose notifications may be read. Package names are from each
 * app's Google Play listing (checked 27 Nov 2026), except Axis Mobile's,
 * which is to be confirmed before release.
 */
export const PAYMENT_APPS: readonly PaymentApp[] = [
  { id: 'gpay', name: 'Google Pay', packages: ['com.google.android.apps.nbu.paisa.user'] },
  { id: 'phonepe', name: 'PhonePe', packages: ['com.phonepe.app'] },
  { id: 'paytm', name: 'Paytm', packages: ['net.one97.paytm'] },
  { id: 'bhim', name: 'BHIM', packages: ['in.org.npci.upiapp'] },
  { id: 'hdfc', name: 'HDFC Bank', bank: 'HDFC Bank', packages: ['com.snapwork.hdfc'] },
  { id: 'sbi', name: 'YONO SBI', bank: 'SBI', packages: ['com.sbi.lotusintouch'] },
  { id: 'icici', name: 'ICICI iMobile', bank: 'ICICI Bank', packages: ['com.csam.icici.bank.imobile'] },
  { id: 'axis', name: 'Axis Mobile', bank: 'Axis Bank', packages: ['com.axis.mobile'] },
  { id: 'kotak', name: 'Kotak Bank', bank: 'Kotak Mahindra Bank', packages: ['com.kotak.bank.mobile', 'com.msf.kbank.mobile'] },
  { id: 'idfc', name: 'IDFC FIRST Bank', bank: 'IDFC FIRST Bank', packages: ['com.idfcfirstbank.optimus'] },
  { id: 'union', name: 'Union Bank Vyom', bank: 'Union Bank of India', packages: ['com.infrasoft.uboi'] },
  { id: 'saraswat', name: 'Saraswat Bank', bank: 'Saraswat Bank', packages: ['com.saraswatbank.retailbanking', 'com.saraswat.mobilebankingv2'] },
  { id: 'equitas', name: 'Equitas', bank: 'Equitas Small Finance Bank', packages: ['com.equitas.elevate'] },
];

/** Text shared to Wall-ette from another app (always waits for a tap). */
export const SHARED = 'share';

const BY_PACKAGE = new Map(PAYMENT_APPS.flatMap(a => a.packages.map(p => [p, a] as const)));
const BY_ID = new Map(PAYMENT_APPS.map(a => [a.id, a]));

/** The app behind a package, or null if its notifications must not be read. */
export const appOfPackage = (pkg: string): PaymentApp | null => BY_PACKAGE.get(pkg) ?? null;

/** What an entry's `via` says, for showing: "Google Pay", "Shared text". */
export const viaName = (via: string | undefined): string | null =>
  !via ? null : via === SHARED ? 'Shared text' : BY_ID.get(via)?.name ?? null;

// ── What the native reader hands over ────────────────────────────────────────

/** One notification, as PaymentAlertListener.java keeps it. */
export interface Notice {
  /** The reader's id for it (its key and when it was posted). */
  id: string;
  pkg: string;
  /** Android's key for the notification. */
  key?: string;
  /** The time the app put on it (ms). */
  when?: number;
  /** When it was posted (ms). */
  posted: number;
  title?: string;
  text?: string;
  /** The expanded text, when the app gives one. */
  big?: string;
}

export type Rail = 'UPI' | 'Card' | 'ATM' | 'NEFT' | 'IMPS' | 'RTGS';

export interface AppPayment {
  /** PaymentApp id, or SHARED. */
  app: string;
  direction: 'debit' | 'credit';
  /** Rupees, to the paisa. */
  amount: number;
  /** Local day, 'YYYY-MM-DD': the one in the text, else the day it arrived. */
  date: string;
  /** When it arrived (ms). */
  at: number;
  payee?: string;
  /** Last digits only ("1234"), never a whole account or card number. */
  account?: string;
  /** UPI RRN, UTR or the bank's reference. */
  reference?: string;
  rail?: Rail;
  /** Money in that isn't from a person: a refund, cashback or a reward, or interest. */
  kind?: 'refund' | 'cashback' | 'interest';
  /** Read with certainty: may be added without asking. */
  sure: boolean;
}

// ── What is not a payment ────────────────────────────────────────────────────

const OTP = /\bis your (?:OTP|one[- ]time password)\b|\bOTP\b|verification code|\bpasscode\b/i;
const FAILED = /\b(?:failed|declined|unsuccessful|could not be (?:processed|completed)|was not successful|insufficient (?:funds|balance)|cancell?ed|rejected|expired)\b/i;
const NOT_YET = new RegExp([
  String.raw`\bwill be (?:auto[- ]?)?(?:debited|credited|refunded|reversed|processed|deducted|paid)\b`,
  String.raw`\bto be (?:debited|credited|paid)\b`,
  String.raw`\bis due\b|\bdue (?:on|by|date|today|tomorrow)\b|\bpayment due\b|\bminimum (?:amount )?due\b|\boverdue\b`,
  String.raw`\bpending\b|\bprocessing\b|\bbeing processed\b|\bin progress\b|\bawaiting\b|\binitiated\b|\bon hold\b`,
  String.raw`\bis scheduled\b|\bscheduled for\b|\bupcoming\b|\breminder\b`,
  String.raw`\bmandate\b[^.]{0,40}\b(?:created|registered|set ?up|successfully)\b|\be-?mandate (?:registration|request)\b|\bautopay (?:set ?up|created|activated)\b`,
].join('|'), 'i');
const REQUEST = /\brequest(?:s|ed|ing)?\b|\bcollect\b|\bapprove\b|\bsplit\b|\bowes? you\b|\bpay now\b|\btap to pay\b/i;
/**
 * Cashback or a reward said to have arrived ("₹150 cashback received"): real
 * money in, unlike an offer to win some. Always asked about.
 */
const MONEY_BACK = /\b(?:cashback|reward)\b[^.]{0,40}?\b(?:received|credited)\b|\b(?:received|credited)\b[^.]{0,40}?\b(?:cashback|reward)\b/i;
const STILL_TO_WIN = /\b(?:win|won|claim|scratch|unlock|up ?to|get)\b/i;
const OFFER = new RegExp([
  String.raw`\b(?:get|win|won|earn|grab|claim|unlock|avail|enjoy|save|saved|assured)\b[^.!]{0,30}(?:₹|\brs\.?|\binr\b)`,
  String.raw`\bup ?to\s*(?:₹|rs\b|rs\.|inr\b)`,
  String.raw`\boffers?\b|\bcoupons?\b|\bvouchers?\b|\bscratch\b|\brewards?\b|\bdiscount\b|\bdeals?\b|\b\d+% off\b|\bflat\s*(?:₹|rs)`,
  String.raw`\bpre-?approved\b|\bcredit limit\b|\binstant (?:loan|credit)\b|\bloan of\b|\bapply now\b|\binvest now\b`,
].join('|'), 'i');

// ── Pieces ───────────────────────────────────────────────────────────────────

const MONEY_SRC = String.raw`(?:₹|\b(?:rs\.?|inr))\s*:?\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)`;
const MONEY = new RegExp(MONEY_SRC, 'gi');
/** A balance, limit or amount due just before an amount: not the payment. */
const NOT_PAYMENT_AMOUNT = /(?:bal(?:ance)?|avl|available|limit|due|worth)[^a-z0-9]{0,6}(?:is\s*|of\s*)?$/i;
const BARE_AMOUNT = /\b(?:debited|credited)\s+(?:by|with|for)\s+([0-9][0-9,]*(?:\.[0-9]{1,2})?)\b/i;

function rupees(s: string): number | null {
  const n = Number(s.replace(/,/g, ''));
  if (!Number.isFinite(n) || n <= 0 || n >= 1e9) return null;
  return Math.round(n * 100) / 100;
}

/** The amounts in the text that could be the payment (balances and limits left out), each once. */
function amountsIn(text: string): number[] {
  const found: number[] = [];
  for (const m of text.matchAll(MONEY)) {
    const before = text.slice(Math.max(0, (m.index ?? 0) - 20), m.index);
    if (NOT_PAYMENT_AMOUNT.test(before)) continue;
    const n = rupees(m[1]);
    if (n !== null && !found.includes(n)) found.push(n);
  }
  if (found.length === 0) {
    const bare = BARE_AMOUNT.exec(text);
    const n = bare ? rupees(bare[1]) : null;
    if (n !== null) found.push(n);
  }
  return found;
}

// "A/c XX1234", "Acct XX789", "A/c no. XX6543", "Card 5678", "••1234", and SBI's "A/cX4321".
const ACCOUNT = /\b(?:a\/?c|acct|account|card)(?:\s*(?:no\.?|number|ending(?: with| in)?))?\s*[:\-]?\s*[x*•.]*\s?(\d{3,})|[x*•]{2,}\s?(\d{3,6})\b/i;

function accountOf(text: string): string | undefined {
  const m = ACCOUNT.exec(text);
  const digits = m ? m[1] ?? m[2] : undefined;
  return digits ? digits.slice(-4) : undefined;
}

const UPI_PATH_REF = /\bUPI\/(?:(?:P2[AMP]|MOB|IMPS)\/)?(\d{12})\//i;
const REFERENCE = /\b(?:UPI\s*Ref(?:erence)?(?:\s*(?:No|ID)\.?)?|UPI\s*(?:transaction|txn)\s*ID|UPI|Ref(?:erence)?(?:\s*No\.?)?|Refno|RRN|UTR(?:\s*No\.?)?)\s*[:\-#]?\s*([A-Z0-9]{8,22})\b/gi;

function referenceOf(text: string): string | undefined {
  const path = UPI_PATH_REF.exec(text);
  if (path) return path[1];
  for (const m of text.matchAll(REFERENCE)) {
    const ref = m[1].toUpperCase();
    if ((ref.match(/\d/g) ?? []).length >= 6) return ref;
  }
  return undefined;
}

const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const pad = (n: number) => String(n).padStart(2, '0');
const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function realDay(y: number, m: number, d: number): Date | null {
  if (y < 100) y += 2000;
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d ? dt : null;
}

/** The day the text names, if it's a real day near when it arrived; else the day it arrived. */
function dateOf(text: string, arrived: Date): string {
  const tries: (Date | null)[] = [];
  const iso = /\b(\d{4})-(\d{2})-(\d{2})\b/.exec(text);
  if (iso) tries.push(realDay(+iso[1], +iso[2], +iso[3]));
  const named = /\b(\d{1,2})[\s\-]?(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\s\-,]*(\d{4}|\d{2})\b/i.exec(text);
  if (named) tries.push(realDay(+named[3], MONTHS[named[2].toLowerCase()], +named[1]));
  const numeric = /\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4}|\d{2})\b/.exec(text);
  if (numeric) tries.push(realDay(+numeric[3], +numeric[2], +numeric[1])); // day first, as Indian banks write it

  const latest = new Date(arrived.getFullYear(), arrived.getMonth(), arrived.getDate() + 1);
  const earliest = new Date(arrived.getFullYear(), arrived.getMonth(), arrived.getDate() - 400);
  for (const d of tries) if (d && d <= latest && d >= earliest) return dayKey(d);
  return dayKey(arrived);
}

// IDFC FIRST's UPI alerts name neither UPI nor a UPI ID ("…; BLINKIT
// credited. RRN 432143210987"): a 12-digit RRN with no other rail named is UPI.
const RRN_LABEL = /\bRRN\s*(?:no\.?)?\s*[:\-#]?\s*\d{12}\b/i;

function railOf(text: string): Rail | undefined {
  const rail = /\b(NEFT|IMPS|RTGS)\b/i.exec(text);
  if (rail) return rail[1].toUpperCase() as Rail;
  if (/\bATM\b|\bwithdrawn\b/i.test(text)) return 'ATM';
  if (/\bcard\b|\bPOS\b/i.test(text)) return 'Card';
  if (/\bUPI\b|\bVPA\b|[a-z0-9.\-_]+@[a-z]{2,}\b/i.test(text) || RRN_LABEL.test(text)) return 'UPI';
  return undefined;
}

// ── Who it was with ──────────────────────────────────────────────────────────

// A name ends at a following word like "on" or "via", at , ; ! ? or a line
// break, or at a full stop that ends a sentence (not the dot in a UPI ID).
const STOP = String.raw`(?=\s+(?:on|via|using|with|through|in|into|to|from|for|ref|refno|rrn|upi|utr|txn|transaction|at|is|was|has|successfully|avl|bal|not|info|dated)\b|\s*[,;!?\n(]|\s+-\s|\.(?:\s|$)|\s*$)`;
// Letters, digits and the marks names and UPI IDs use; a full stop only
// inside a word (rahul.s@okaxis), never one that ends a sentence.
const NAME = String.raw`([A-Za-z0-9](?:[A-Za-z0-9 &@'_\-]|\.(?!\s)){0,59}?)`;
const NOT_A_NAME = /^(?:rs\.?|inr|₹|\d|your\b|you\b|a\/?c\b|acct\b|account\b|card\b|mob\b|the\b|neft\b|imps\b|rtgs\b|upi\b|bank\b|hdfc bank\b|icici bank\b|axis bank\b|sbi\b|kotak\b|idfc\b|net ?banking\b|date\b|money\b|payment\b|wallet\b|self\b)/i;

function tidyPayee(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const name = raw.replace(/\s+/g, ' ').trim().replace(/[.\-_,]+$/, '').replace(/\//g, ' ');
  return name.length >= 2 && !NOT_A_NAME.test(name) && !/^\d+$/.test(name) ? name : undefined;
}

// ── Payment apps' wording ────────────────────────────────────────────────────

interface Phrase {
  direction: 'debit' | 'credit';
  re: RegExp;
  /** Which group holds the amount and which the name (0: the title). */
  amount: number;
  name: number;
}

const YOU = String.raw`(?:you(?:'ve| have)?\s+)?(?:successfully\s+)?`;
const PHRASES: Phrase[] = [
  // "Paid ₹249 to Swiggy", "You sent ₹500 to Rahul", "You've successfully paid ₹249 to Swiggy"
  { direction: 'debit', re: new RegExp(String.raw`(?:^|\b)${YOU}(?:paid|sent)\s+${MONEY_SRC}\s+to\s+${NAME}${STOP}`, 'i'), amount: 1, name: 2 },
  // "₹249 paid to Swiggy", "₹500 sent successfully to Rahul"
  { direction: 'debit', re: new RegExp(String.raw`${MONEY_SRC}\s+(?:has been\s+|was\s+)?(?:paid|sent)\s+(?:successfully\s+)?to\s+${NAME}${STOP}`, 'i'), amount: 1, name: 2 },
  // "Payment of ₹249 to Swiggy successful", "Payment of ₹249 to Swiggy was completed"
  { direction: 'debit', re: new RegExp(String.raw`\bpayment of\s+${MONEY_SRC}\s+(?:to|towards)\s+${NAME}\s+(?:is\s+|was\s+|has been\s+)?(?:successful|completed|done)\b`, 'i'), amount: 1, name: 2 },
  // "₹1,200 paid for Mumbai Metro recharge", "You paid ₹99 towards Airtel"
  { direction: 'debit', re: new RegExp(String.raw`${MONEY_SRC}\s+(?:has been\s+|was\s+)?paid\s+(?:successfully\s+)?(?:for|towards)\s+${NAME}${STOP}`, 'i'), amount: 1, name: 2 },
  { direction: 'debit', re: new RegExp(String.raw`(?:^|\b)${YOU}paid\s+${MONEY_SRC}\s+(?:for|towards)\s+${NAME}${STOP}`, 'i'), amount: 1, name: 2 },
  // "₹500 paid to you by Rahul", "₹500 sent by Rahul"
  { direction: 'credit', re: new RegExp(String.raw`${MONEY_SRC}\s+(?:has been\s+|was\s+)?(?:paid|sent)\s+(?:to you\s+)?by\s+${NAME}${STOP}`, 'i'), amount: 1, name: 2 },
  // "Received ₹500 from Rahul", "You have received ₹500 from rahul@okaxis", "Money received ₹500 from …"
  { direction: 'credit', re: new RegExp(String.raw`(?:^|\b)${YOU}received\s+${MONEY_SRC}\s+from\s+${NAME}${STOP}`, 'i'), amount: 1, name: 2 },
  // "₹500 received from Rahul"
  { direction: 'credit', re: new RegExp(String.raw`${MONEY_SRC}\s+(?:has been\s+|was\s+)?received\s+from\s+${NAME}${STOP}`, 'i'), amount: 1, name: 2 },
  // "Rahul Sharma paid you ₹500", "Rahul has sent you ₹500"
  { direction: 'credit', re: new RegExp(String.raw`^${NAME}\s+(?:has\s+)?(?:paid|sent)\s+you\s+${MONEY_SRC}`, 'i'), amount: 2, name: 1 },
  // Title "Rahul Sharma", text "Paid you ₹500"
  { direction: 'credit', re: new RegExp(String.raw`^(?:has\s+)?(?:paid|sent)\s+you\s+${MONEY_SRC}`, 'i'), amount: 1, name: 0 },
];

/** What a payment app's phrase says, tried on the title and text together and apart. */
function appPhrase(title: string, body: string): { direction: 'debit' | 'credit'; amount: number; payee?: string } | null {
  const joined = title && body && /^(?:from|to|by|via|[a-z])/.test(body) ? `${title} ${body}` : '';
  const tries: [string, string][] = [[body, title], [title, ''], [joined, ''], [title && body ? `${title}. ${body}` : '', '']];
  for (const [s, titleAsName] of tries) {
    if (!s) continue;
    for (const p of PHRASES) {
      if (p.name === 0 && !titleAsName) continue;
      const m = p.re.exec(s);
      if (!m) continue;
      const amount = rupees(m[p.amount]);
      const payee = tidyPayee(p.name === 0 ? titleAsName : m[p.name]);
      if (amount === null || !payee) continue;
      return { direction: p.direction, amount, payee };
    }
  }
  return null;
}

// ── Bank alerts' wording ─────────────────────────────────────────────────────

const DEBIT = /\b(?:debited|spent|sent|paid|withdrawn|withdrawal|purchase|transferred|deducted)\b/i;
const CREDIT = /\b(?:credited|received|deposited|refund(?:ed)?|reversed|reversal|cashback)\b/i;
const REFUND = /\brefund(?:ed)?\b|\breversed\b|\breversal\b|\bcashback\b/i;
/**
 * A bank's way of saying money moved, with the amount in the same phrase:
 * "debited by Rs. 560.00", "INR 2,000.00 debited", "Rs.499.00 refund
 * credited", "Refund of ₹249 credited", "debited for 250.0".
 */
const STRONG_ALERT = new RegExp([
  String.raw`(?:debited|credited|spent|sent|withdrawn|received|deposited)\s+(?:by|with|for|of)?\s*${MONEY_SRC}`,
  String.raw`${MONEY_SRC}\s+(?:refund\s+|cashback\s+|interest\s+|salary\s+)?(?:has been\s+|is\s+|was\s+)?(?:debited|credited|spent|withdrawn|deposited|refunded|received|paid|sent)`,
  String.raw`(?:refund|cashback)\s+of\s+${MONEY_SRC}[^.]{0,40}?\b(?:credited|received|refunded|processed)`,
  String.raw`\b(?:debited|credited)\s+(?:by|with|for)\s+([0-9][0-9,]*(?:\.[0-9]{1,2})?)\b`,
].join('|'), 'i');

const UPI_PATH_NAME = /\bUPI\/(?:(?:P2[AMP]|MOB|IMPS)\/)?\d{6,}\/([^\/\n.]{2,40}?)(?:\/|\.|\s|$)/i;
const SEMI_CREDITED = /;\s*([A-Za-z][A-Za-z0-9 &.'@_\-]{1,60}?)\s+credited\b/i;
const FOR_VIA = /\bfor\s+([A-Z][A-Z0-9 &.'\-]{1,40}?)\s+via\b/;
const TO_PAYEE = new RegExp(String.raw`\b(?:trf to|transferred to|paid to|to VPA|to|at|towards)\s+${NAME}${STOP}`, 'gi');
const FROM_PAYER = new RegExp(String.raw`\b(?:from VPA|by VPA|transfer from|from|by)\s+${NAME}${STOP}`, 'gi');

function nameFrom(re: RegExp, text: string): string | undefined {
  re.lastIndex = 0;
  for (const m of text.matchAll(re)) {
    const name = tidyPayee(m[1]);
    if (name) return name;
  }
  return undefined;
}

function alertPayee(text: string, direction: 'debit' | 'credit'): string | undefined {
  const path = UPI_PATH_NAME.exec(text);
  if (path && !/^\d+$/.test(path[1].trim())) return tidyPayee(path[1]);
  if (direction === 'debit') {
    const semi = SEMI_CREDITED.exec(text);
    if (semi) return tidyPayee(semi[1]);
    const autopay = FOR_VIA.exec(text);
    if (autopay) return tidyPayee(autopay[1]);
    return nameFrom(TO_PAYEE, text);
  }
  return nameFrom(FROM_PAYER, text);
}

/** A bank alert's direction and how sure it is, or null if it doesn't say money moved. */
function alertDirection(text: string): { direction: 'debit' | 'credit'; clear: boolean } | null {
  const debitAt = text.search(DEBIT);
  const creditAt = text.search(CREDIT);
  if (debitAt < 0 && creditAt < 0) return null;
  if (REFUND.test(text)) return { direction: 'credit', clear: !/\bcashback\b/i.test(text) };
  if (creditAt < 0) return { direction: 'debit', clear: true };
  if (debitAt < 0) return { direction: 'credit', clear: true };
  // Both words. "…debited…; BLINKIT credited" (the payee was credited) is a debit.
  if (debitAt < creditAt) return { direction: 'debit', clear: SEMI_CREDITED.test(text) };
  return { direction: 'credit', clear: false };
}

// ── Reading one ──────────────────────────────────────────────────────────────

const tidyText = (s: string | undefined): string => (s ?? '').replace(/\s+/g, ' ').trim();

/** The title and the fullest text a notification gives. */
function noticeText(n: Pick<Notice, 'title' | 'text' | 'big'>): { title: string; body: string } {
  const title = tidyText(n.title);
  const text = tidyText(n.text);
  const big = tidyText(n.big);
  return { title, body: big.length > text.length ? big : text };
}

/**
 * A payment from text, or null when it isn't one. Only the payment's fields
 * come out. A payment app's text must use one of its phrases or a bank's
 * (amount and verb together), so chat in the app ("thanks for the ₹500")
 * is never a payment; a bank app's may say less and then waits for a tap.
 */
function readText(app: string, title: string, body: string, arrived: Date, bankApp: boolean): AppPayment | null {
  const all = [title, body].filter(Boolean).join('. ');
  const back = MONEY_BACK.test(all) && !STILL_TO_WIN.test(all);
  if (!all || OTP.test(all) || FAILED.test(all) || NOT_YET.test(all) || REQUEST.test(all) || (!back && OFFER.test(all))) return null;
  const amounts = amountsIn(all);
  if (amounts.length === 0) return null;

  const at = arrived.getTime();
  const base = { app, at, date: dateOf(all, arrived) };
  const extras = (p: AppPayment): AppPayment => {
    const account = accountOf(all);
    if (account) p.account = account;
    const reference = referenceOf(all);
    if (reference) p.reference = reference;
    const rail = railOf(all);
    if (rail) p.rail = rail;
    return p;
  };

  // Money in that isn't from a person, and how sure it is.
  const moneyIn = (p: AppPayment): AppPayment => {
    if (p.direction !== 'credit') return p;
    if (back || /\bcashback\b/i.test(all)) { p.kind = 'cashback'; p.sure = false; }
    else if (REFUND.test(all)) p.kind = 'refund';
    else if (/\binterest\b/i.test(all) && !p.payee) p.kind = 'interest';
    return p;
  };

  const phrase = appPhrase(title, body);
  if (phrase) return moneyIn(extras({ ...base, direction: phrase.direction, amount: phrase.amount, payee: phrase.payee, sure: true }));

  const dir = alertDirection(all);
  if (!dir) return null;
  const strong = STRONG_ALERT.exec(all);
  if (!strong && !bankApp) return null;
  const said = strong ? strong.slice(1).find(g => g !== undefined) : undefined;
  const amount = (said !== undefined ? rupees(said) : null) ?? amounts[0];
  const p: AppPayment = extras({ ...base, direction: dir.direction, amount, sure: dir.clear && !!strong && amounts.length === 1 });
  const payee = alertPayee(all, dir.direction);
  if (payee) p.payee = payee;
  return moneyIn(p);
}

/** A notification read as a payment, or null when it isn't one (or its app may not be read). */
export function readNotice(n: Notice): AppPayment | null {
  const app = appOfPackage(n.pkg);
  if (!app || !Number.isFinite(n.posted)) return null;
  const { title, body } = noticeText(n);
  return readText(app.id, title, body, new Date(n.posted), !!app.bank);
}

/** Text shared to Wall-ette read as a payment, or null. Never sure: it always waits for a tap. */
export function readShared(text: string, at: Date): AppPayment | null {
  const clean = tidyText(text).slice(0, 2000);
  const lines = clean.replace(/([.!?])\s+/g, '$1\n').split('\n');
  // Shared text is often a whole bank SMS, so it reads like a bank app's.
  const p = readText(SHARED, '', clean, at, true) ?? (lines.length > 1 ? readText(SHARED, lines[0], lines.slice(1).join(' '), at, true) : null);
  return p ? { ...p, sure: false } : null;
}

// ── The entry it becomes ─────────────────────────────────────────────────────

// Two 32-bit hashes of a string, as 16 hex digits: enough that two
// different notifications never share an id.
function hash(text: string): string {
  let a = 0x811c9dc5, b = 0x01000193 ^ text.length;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193);
    b = Math.imul(b ^ c, 0x5bd1e995);
    b ^= b >>> 15;
  }
  return (a >>> 0).toString(16).padStart(8, '0') + (b >>> 0).toString(16).padStart(8, '0');
}

const paise = (n: number) => Math.round(n * 100);

/**
 * The entry id for a payment read from a notification: the same notification
 * read twice (after the reader reconnects, say) gives the same id, so it's
 * added once.
 */
export const noticeEntryId = (n: Pick<Notice, 'pkg' | 'key' | 'when' | 'posted'>, p: Pick<AppPayment, 'direction' | 'amount'>): string =>
  `app-${hash([n.pkg, n.key ?? '', n.when ?? n.posted, p.direction, paise(p.amount)].join('|'))}`;

/** The entry id for shared text: sharing the same message again finds the same entry. */
export const sharedEntryId = (text: string): string => `share-${hash(tidyText(text).toLowerCase())}`;

const RAIL_WORD: Record<Rail, string> = { UPI: 'UPI', Card: 'POS', ATM: 'ATM', NEFT: 'NEFT', IMPS: 'IMPS', RTGS: 'RTGS' };

/**
 * The entry's narration, written the way statements write theirs
 * (rail/reference/payee), so the screens show the payee, money moved rules
 * match it, and a statement imported later finds the payment by its
 * reference (services/statementImport.ts bankReference).
 */
export function paymentNarration(p: Pick<AppPayment, 'app' | 'rail' | 'reference' | 'payee'>): string | undefined {
  const app = BY_ID.get(p.app);
  // A payment app's payments are UPI unless it says otherwise.
  const rail = p.rail ?? (app && !app.bank ? 'UPI' : undefined);
  const word = rail ? RAIL_WORD[rail] : undefined;
  const reference = word && p.reference && /^[A-Z0-9]{8,22}$/i.test(p.reference) ? p.reference : undefined;
  // A payee that only repeats the rail ("withdrawn at ATM") names nothing more.
  const payee = p.payee && p.payee.toUpperCase() !== word ? p.payee.replace(/\//g, ' ') : undefined;
  // A rail alone names nothing (except a cash withdrawal).
  if (!payee && !reference) return rail === 'ATM' ? 'ATM' : undefined;
  return [word, reference, payee].filter(Boolean).join('/');
}

/** The entry a payment becomes. */
export function paymentEntry(p: AppPayment, id: string): Transaction {
  const type = p.direction === 'debit' ? TransactionType.EXPENSE : TransactionType.INCOME;
  const merchant = paymentNarration(p);
  const category = p.kind === 'refund' ? 'Refunds' : p.kind === 'cashback' ? 'Bonus' : p.kind === 'interest' ? 'Interest Income'
    : categorizeNarration(merchant ?? '', p.direction === 'debit' ? 'expense' : 'income');
  const entry: Transaction = {
    id,
    amount: p.amount,
    type,
    category,
    date: p.date,
    createdAt: new Date(p.at).toISOString(),
    via: p.app,
  };
  if (merchant) entry.merchant = merchant;
  return entry;
}
