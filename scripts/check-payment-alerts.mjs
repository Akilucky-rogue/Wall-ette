#!/usr/bin/env node
/**
 * Payments from payment and bank apps' notifications, and from shared text
 * (services/paymentAlerts.ts), on made-up notifications.
 *
 * Checks that:
 *   - only the listed apps are read, never a messaging app, and the Android
 *     reader's list (PaymentAlertListener.java) and the manifest's are the
 *     same as the app's
 *   - each payment app's usual phrases give the right direction, amount to
 *     the paisa, day, payee, reference and rail, and are sure; bank apps'
 *     alerts (their SMS wording) too, with a balance never taken for the
 *     amount
 *   - cashback and rewards that arrived are money in that waits for a tap;
 *     wording that leaves doubt waits for a tap; chat in a payment app is
 *     never a payment
 *   - OTPs, failed and pending payments, money requests, bills due, AutoPay
 *     mandates, payments still to come, offers, rewards still to win and
 *     balance alerts give nothing
 *   - a whole account or card number never comes out, only its last four
 *     digits, and only payment fields come out
 *   - an unreadable or far-off date falls back to the day it arrived
 *   - the entry a payment becomes: its narration reads like a statement's,
 *     so a statement imported later finds it by reference; its category,
 *     time and app; the same notification always gives the same id
 *   - shared text is read like a bank alert and always waits for a tap
 *   - 10,000 notifications are read in well under a second
 *
 * IDFC FIRST's alerts follow the shape of the owner's real ones (with
 * made-up amounts, digits and payees). The payment apps' wording is made up
 * in each app's style and must be confirmed against real notifications.
 *
 * Usage (after `npm ci`): node scripts/check-payment-alerts.mjs
 * Exits with code 1 if any check fails.
 */
import { build } from 'esbuild'; // installed with Vite
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

process.env.TZ = 'Asia/Kolkata';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tmp = mkdtempSync(join(tmpdir(), 'wallette-alerts-'));
const entry = join(tmp, 'entry.ts');
writeFileSync(entry, `export * from ${JSON.stringify(join(root, 'services', 'paymentAlerts.ts'))};\nexport { bankReference } from ${JSON.stringify(join(root, 'services', 'statementImport.ts'))};\n`);
const bundle = join(tmp, 'alerts.mjs');
await build({ entryPoints: [entry], outfile: bundle, bundle: true, platform: 'node', format: 'esm', logLevel: 'error' });
const A = await import(pathToFileURL(bundle).href);
rmSync(tmp, { recursive: true, force: true });

let failures = 0;
let checks = 0;
const eq = (label, actual, expected) => {
  checks++;
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a !== e) { failures++; if (failures <= 40) console.log(`  FAIL ${label}:\n    got      ${a}\n    expected ${e}`); }
};
const ok = (label, cond) => {
  checks++;
  if (!cond) { failures++; if (failures <= 40) console.log(`  FAIL ${label}`); }
};

const PKG = {
  gpay: 'com.google.android.apps.nbu.paisa.user', phonepe: 'com.phonepe.app', paytm: 'net.one97.paytm', bhim: 'in.org.npci.upiapp',
  hdfc: 'com.snapwork.hdfc', sbi: 'com.sbi.lotusintouch', icici: 'com.csam.icici.bank.imobile', axis: 'com.axis.mobile',
  kotak: 'com.kotak.bank.mobile', idfc: 'com.idfcfirstbank.optimus', union: 'com.infrasoft.uboi', saraswat: 'com.saraswatbank.retailbanking',
};
const arrived = new Date(2026, 10, 24, 20, 15).getTime(); // 24 Nov 2026, 8:15 pm IST
let seq = 0;
const notice = (app, title, text, at = arrived) => {
  seq++;
  return { id: `0|${PKG[app] ?? app}|${seq}|null|10123|${at}`, pkg: PKG[app] ?? app, key: `0|${PKG[app] ?? app}|${seq}|null|10123`, when: at, posted: at, title, text };
};
const read = (app, title, text, at) => A.readNotice(notice(app, title, text, at));
// Fields in a fixed order, so comparisons don't depend on how the object was built.
const KEYS = ['app', 'direction', 'amount', 'date', 'payee', 'account', 'reference', 'rail', 'kind', 'sure'];
const tidy = p => (p ? Object.fromEntries(KEYS.filter(k => p[k] !== undefined).map(k => [k, p[k]])) : null);

// ── Which apps ───────────────────────────────────────────────────────────────
console.log('Apps');
for (const [id, pkg] of Object.entries(PKG)) eq(`${id} is read`, A.appOfPackage(pkg)?.id ?? null, id);
for (const pkg of [
  'com.google.android.apps.messaging', 'com.samsung.android.messaging', 'com.android.mms', 'com.whatsapp', 'com.whatsapp.w4b',
  'com.truecaller', 'org.telegram.messenger', 'com.android.shell', 'com.android.systemui', 'com.dreamplug.androidapp', '',
]) eq(`${pkg || '(none)'} is never read`, A.appOfPackage(pkg), null);
eq('a bank SMS shown by the Messages app gives nothing',
  A.readNotice(notice('com.google.android.apps.messaging', 'VM-IDFCFB-T', 'Your A/c XX4821 debited by Rs. 560.00 on 24/11/26; BLINKIT credited. RRN 432143210987. Team IDFC FIRST Bank')), null);
{
  const listed = A.PAYMENT_APPS.flatMap(a => a.packages).sort();
  const java = readFileSync(join(root, 'android/app/src/main/java/com/wallette/app/PaymentAlertListener.java'), 'utf8');
  const javaSet = java.slice(java.indexOf('PACKAGES'), java.indexOf(')));')).match(/"([a-z0-9_.]+)"/gi).map(s => s.slice(1, -1)).sort();
  eq('the Android reader reads the same apps', javaSet, listed);
  const manifest = readFileSync(join(root, 'android/app/src/main/AndroidManifest.xml'), 'utf8');
  const queries = [...manifest.slice(manifest.indexOf('<queries>'), manifest.indexOf('</queries>')).matchAll(/android:name="([^"]+)"/g)].map(m => m[1]).sort();
  eq('… and the manifest lists the same apps', queries, listed);
  eq('each app has its own id', new Set(A.PAYMENT_APPS.map(a => a.id)).size, A.PAYMENT_APPS.length);
  eq('what an entry shows it came from', [A.viaName('gpay'), A.viaName('idfc'), A.viaName('share'), A.viaName(undefined), A.viaName('nope')],
    ['Google Pay', 'IDFC FIRST Bank', 'Shared text', null, null]);
}

// ── Payment apps ─────────────────────────────────────────────────────────────
console.log('Payment apps');
const D = '2026-11-24';
const appCases = [
  ['Google Pay, paid (title), balance and app in the text', 'gpay', '₹1,250 paid to Rohan Mehta', 'via UPI · Balance ₹18,430.50',
    { app: 'gpay', direction: 'debit', amount: 1250, date: D, payee: 'Rohan Mehta', rail: 'UPI', sure: true }],
  ['Google Pay, paid, all in the text', 'gpay', '', '₹1,250 paid to Rohan Mehta via UPI. Paid to rohan.mehta@okaxis. Balance: ₹18,430.50. Today, 7:42 PM',
    { app: 'gpay', direction: 'debit', amount: 1250, date: D, payee: 'Rohan Mehta', rail: 'UPI', sure: true }],
  ['Google Pay, paid, with a reference', 'gpay', 'Payment successful', '₹299 paid to Blue Tokai Coffee. UPI transaction successful. Ref no: 628391045721.',
    { app: 'gpay', direction: 'debit', amount: 299, date: D, payee: 'Blue Tokai Coffee', reference: '628391045721', rail: 'UPI', sure: true }],
  ['Google Pay, paid you (the payer is the title)', 'gpay', 'Priya Sharma', 'Paid you ₹2,500',
    { app: 'gpay', direction: 'credit', amount: 2500, date: D, payee: 'Priya Sharma', sure: true }],
  ['Google Pay, paid you, in one line', 'gpay', 'Priya Sharma paid you ₹2,500.50', 'To your SBI account ••4321',
    { app: 'gpay', direction: 'credit', amount: 2500.5, date: D, payee: 'Priya Sharma', account: '4321', sure: true }],
  ['Google Pay, received', 'gpay', '', '₹2,500 received from Priya Sharma via UPI. From priya.sharma@ybl. Added to HDFC Bank - - 4821.',
    { app: 'gpay', direction: 'credit', amount: 2500, date: D, payee: 'Priya Sharma', rail: 'UPI', sure: true }],
  ['Google Pay, cashback received: money in, asked about', 'gpay', '', '₹150 cashback received. Reward for paying with Google Pay at More Supermarket.',
    { app: 'gpay', direction: 'credit', amount: 150, date: D, kind: 'cashback', sure: false }],
  ['PhonePe, money received', 'phonepe', 'Money received', 'Received ₹750 from VIKRAM RAO in your HDFC Bank account',
    { app: 'phonepe', direction: 'credit', amount: 750, date: D, payee: 'VIKRAM RAO', sure: true }],
  ['PhonePe, sent, with a UPI ID and balance', 'phonepe', '', '₹480 sent to Ananya Iyer. UPI payment to ananya.iyer@ybl successful. Balance: ₹12,975.00.',
    { app: 'phonepe', direction: 'debit', amount: 480, date: D, payee: 'Ananya Iyer', rail: 'UPI', sure: true }],
  ['PhonePe, payment of … completed', 'phonepe', 'Payment successful', 'Payment of ₹1,499 to Airtel was completed',
    { app: 'phonepe', direction: 'debit', amount: 1499, date: D, payee: 'Airtel', sure: true }],
  ['PhonePe, a reward credited: money in, asked about', 'phonepe', '', '₹50 received. PhonePe reward credited for a successful recharge.',
    { app: 'phonepe', direction: 'credit', amount: 50, date: D, kind: 'cashback', sure: false }],
  ['Paytm, received (the payer in the text)', 'paytm', 'Received ₹200', 'from Priya S',
    { app: 'paytm', direction: 'credit', amount: 200, date: D, payee: 'Priya S', sure: true }],
  ['Paytm, paid, with an available balance', 'paytm', '', '₹2,300 paid to Meera Iyer. UPI transfer to meera.iyer@paytm completed. Available balance: ₹9,640.25.',
    { app: 'paytm', direction: 'debit', amount: 2300, date: D, payee: 'Meera Iyer', rail: 'UPI', sure: true }],
  ['Paytm, paid for something', 'paytm', '', '₹1,200 paid for Mumbai Metro recharge. Payment successful. Order ID: PAY784512396.',
    { app: 'paytm', direction: 'debit', amount: 1200, date: D, payee: 'Mumbai Metro recharge', sure: true }],
  ['Paytm, received into a bank account', 'paytm', '', '₹3,000 received from Neha Kapoor. UPI money received in Paytm Payments Bank account.',
    { app: 'paytm', direction: 'credit', amount: 3000, date: D, payee: 'Neha Kapoor', rail: 'UPI', sure: true }],
  ['Paytm, cashback received', 'paytm', '', '₹75 cashback received. Paytm cashback for mobile recharge.',
    { app: 'paytm', direction: 'credit', amount: 75, date: D, kind: 'cashback', sure: false }],
  ['BHIM, sent to a UPI ID with a dot in it', 'bhim', 'Transaction successful', '₹100 sent to tea.stall@ybl. UPI Ref 432199990000',
    { app: 'bhim', direction: 'debit', amount: 100, date: D, payee: 'tea.stall@ybl', reference: '432199990000', rail: 'UPI', sure: true }],
  ['you have paid … to …', 'phonepe', '', "You've successfully paid ₹60 to Chai Point",
    { app: 'phonepe', direction: 'debit', amount: 60, date: D, payee: 'Chai Point', sure: true }],
  ['sent by someone', 'paytm', '', '₹500 sent to you by Rahul Kumar',
    { app: 'paytm', direction: 'credit', amount: 500, date: D, payee: 'Rahul Kumar', sure: true }],
];
for (const [label, app, title, text, expected] of appCases) eq(label, tidy(read(app, title, text)), expected);

// ── Bank apps (their SMS wording) ────────────────────────────────────────────
console.log('Bank apps');
const bankCases = [
  ['HDFC Bank, UPI payment', 'hdfc', 'HDFC Bank',
    'Sent Rs.450.00\nFrom HDFC Bank A/C *1234\nTo SWIGGY\nOn 24/11/26\nRef 432112345678\nNot You?\nCall 18002586161/SMS BLOCK UPI to 7308080808',
    { app: 'hdfc', direction: 'debit', amount: 450, date: '2026-11-24', payee: 'SWIGGY', account: '1234', reference: '432112345678', rail: 'UPI', sure: true }],
  ['HDFC Bank, card spend (the balance is not the amount)', 'hdfc', 'Transaction alert',
    'Spent Rs.1,299.00 On HDFC Bank Card 5678 At AMAZON PAY On 2026-11-23:18:42:10 Bal Rs.45,000.00 Not You? Call 18002586161 or SMS BLOCK DC 5678 to 7308080808',
    { app: 'hdfc', direction: 'debit', amount: 1299, date: '2026-11-23', payee: 'AMAZON PAY', account: '5678', rail: 'Card', sure: true }],
  ['HDFC Bank, pay credited by UPI', 'hdfc', 'Credit Alert!',
    'Rs.85,000.00 credited to HDFC Bank A/c XX1234 on 01-11-26 from VPA acme.payroll@hdfcbank (UPI 430598765432)',
    { app: 'hdfc', direction: 'credit', amount: 85000, date: '2026-11-01', payee: 'acme.payroll@hdfcbank', account: '1234', reference: '430598765432', rail: 'UPI', sure: true }],
  ['HDFC Bank, debited, UPI payment to a UPI ID', 'hdfc', '',
    '₹5,000 debited from A/c XX4821. UPI payment to arjun.patel@okhdfcbank. Available balance: ₹41,270.80.',
    { app: 'hdfc', direction: 'debit', amount: 5000, date: D, payee: 'arjun.patel@okhdfcbank', account: '4821', rail: 'UPI', sure: true }],
  ['HDFC Bank, IMPS transfer (the IFSC is not the reference)', 'hdfc', '',
    '₹12,450 debited. IMPS transfer to Kavya Nair, IFSC HDFC0001234. Ref: HDFCIMPS882736.',
    { app: 'hdfc', direction: 'debit', amount: 12450, date: D, payee: 'Kavya Nair', reference: 'HDFCIMPS882736', rail: 'IMPS', sure: true }],
  ['HDFC Bank, NEFT money in', 'hdfc', '',
    '₹15,000 credited to A/c XX4821. NEFT from Acme Solutions Pvt Ltd. Available balance: ₹56,270.80.',
    { app: 'hdfc', direction: 'credit', amount: 15000, date: D, payee: 'Acme Solutions Pvt Ltd', account: '4821', rail: 'NEFT', sure: true }],
  ['HDFC Bank, interest credited', 'hdfc', '', '₹250 interest credited. Savings account interest for November.',
    { app: 'hdfc', direction: 'credit', amount: 250, date: D, kind: 'interest', sure: true }],
  ['SBI, UPI payment', 'sbi', 'YONO SBI',
    'Dear UPI user A/C X4321 debited by 250.0 on date 24Nov26 trf to RAHUL KUMAR Refno 432198765432. If not u? call 1800111109. -SBI',
    { app: 'sbi', direction: 'debit', amount: 250, date: '2026-11-24', payee: 'RAHUL KUMAR', account: '4321', reference: '432198765432', rail: 'UPI', sure: true }],
  ['SBI, UPI money received', 'sbi', '',
    'Dear SBI UPI User, ur A/cX4321 credited by Rs1500 on 22Nov26 transfer from PRIYA S (Ref no 432187654321)',
    { app: 'sbi', direction: 'credit', amount: 1500, date: '2026-11-22', payee: 'PRIYA S', account: '4321', reference: '432187654321', rail: 'UPI', sure: true }],
  ['ICICI Bank, UPI payment', 'icici', '',
    'ICICI Bank Acct XX789 debited for Rs 349.00 on 23-Nov-26; ZOMATO credited. UPI:432176543210. Call 18002662 for dispute. SMS BLOCK 789 to 9215676766.',
    { app: 'icici', direction: 'debit', amount: 349, date: '2026-11-23', payee: 'ZOMATO', account: '789', reference: '432176543210', rail: 'UPI', sure: true }],
  ['Axis Bank, UPI payment', 'axis', '',
    'INR 2,000.00 debited\nA/c no. XX6543\n24-11-26, 14:05:33\nUPI/P2M/432165432109/BIGBASKET\nNot you? SMS BLOCKUPI Cust ID to 919951860002\nAxis Bank',
    { app: 'axis', direction: 'debit', amount: 2000, date: '2026-11-24', payee: 'BIGBASKET', account: '6543', reference: '432165432109', rail: 'UPI', sure: true }],
  ['Kotak, UPI payment', 'kotak', '',
    'Sent Rs.120.00 from Kotak Bank AC X2468 to uber@axisbank on 24-11-26.UPI Ref 432154321098. Not you, https://kotak.com/KBANKT/Fraud',
    { app: 'kotak', direction: 'debit', amount: 120, date: '2026-11-24', payee: 'uber@axisbank', account: '2468', reference: '432154321098', rail: 'UPI', sure: true }],
  // IDFC FIRST: the shapes of real alerts (made-up amounts, digits and payees).
  ['IDFC FIRST, UPI payment: "; payee credited", an RRN and no word UPI', 'idfc', '',
    'Your A/c XX4821 debited by Rs. 560.00 on 24/11/26; BLINKIT credited. RRN 432143210987. Available balance Rs. 12,340.55. Team IDFC FIRST Bank',
    { app: 'idfc', direction: 'debit', amount: 560, date: '2026-11-24', payee: 'BLINKIT', account: '4821', reference: '432143210987', rail: 'UPI', sure: true }],
  ['IDFC FIRST, UPI payment to a cut-off name, balance in lakhs', 'idfc', '',
    'Your A/c XX4821 debited by Rs. 240.00 on 22/11/26; SHREE GANESH TEA AND S credited. RRN 432143210990. Available balance Rs. 1,12,340.55. Team IDFC FIRST Bank',
    { app: 'idfc', direction: 'debit', amount: 240, date: '2026-11-22', payee: 'SHREE GANESH TEA AND S', account: '4821', reference: '432143210990', rail: 'UPI', sure: true }],
  ['IDFC FIRST, money in (the new balance is not the amount)', 'idfc', '',
    'Your A/C XXXXX135792 is credited with INR 5,000.00 on 22/11/26 14:05. Your new balance is INR 1,17,340.55. Team IDFC FIRST Bank',
    { app: 'idfc', direction: 'credit', amount: 5000, date: '2026-11-22', account: '5792', sure: true }],
  ['IDFC FIRST, debit card spend (the helpline digits are not an amount)', 'idfc', '',
    'Spent Rs.1,299.50 from A/C XX4821 at ACME CLOUD on 23/11/26. Not you? Call 180010888/SMS BLOCK (last 4 digit of card) to 5676732. IDFC FIRST Bank',
    { app: 'idfc', direction: 'debit', amount: 1299.5, date: '2026-11-23', payee: 'ACME CLOUD', account: '4821', rail: 'Card', sure: true }],
  ['IDFC FIRST, IMPS money in from a sender known only by a masked mobile', 'idfc', '',
    'Your a/c no. XXXXXXXX482 is credited by Rs. 2,500.00 on 21-Nov-26 by a/c linked to mobile XXXXXXXXX123 (IMPS Ref no 532211004477 ). Team IDFC FIRST Bank',
    { app: 'idfc', direction: 'credit', amount: 2500, date: '2026-11-21', account: '482', reference: '532211004477', rail: 'IMPS', sure: true }],
  ['Union Bank, mobile banking payment (no payee named)', 'union', '',
    'A/c *9753 Debited for Rs:300.00 on 23-11-2026 15:10:22 by Mob Bk ref no 432132109876 Avl Bal Rs:5,000.00.If not you, Call 1800222243 -Union Bank of India',
    { app: 'union', direction: 'debit', amount: 300, date: '2026-11-23', account: '9753', reference: '432132109876', sure: true }],
  ['Saraswat Bank, UPI payment', 'saraswat', '',
    'Your A/c No. XX8642 is debited with INR 750.00 on 24-11-2026 towards UPI/432121098765/DMART. Avl Bal INR 9,876.00 - Saraswat Bank',
    { app: 'saraswat', direction: 'debit', amount: 750, date: '2026-11-24', payee: 'DMART', account: '8642', reference: '432121098765', rail: 'UPI', sure: true }],
  ['a refund is money in', 'hdfc', '',
    'Rs.499.00 refund credited to your HDFC Bank A/c XX1234 from AMAZON on 20-11-26. Ref 432110987654',
    { app: 'hdfc', direction: 'credit', amount: 499, date: '2026-11-20', payee: 'AMAZON', account: '1234', reference: '432110987654', kind: 'refund', sure: true }],
  ['an ATM withdrawal', 'sbi', '',
    'Rs.2000.00 withdrawn at ATM from A/c XX4321 on 21Nov26. Avl Bal Rs.3,456.00 -SBI',
    { app: 'sbi', direction: 'debit', amount: 2000, date: '2026-11-21', payee: 'ATM', account: '4321', rail: 'ATM', sure: true }],
  ['NEFT money received, with a letters-and-digits UTR', 'axis', '',
    'INR 25,000.00 credited to A/c XX6543 on 20-11-26 by NEFT from ACME CORP PVT LTD. UTR NO: HDFCN52026112012345678. Axis Bank',
    { app: 'axis', direction: 'credit', amount: 25000, date: '2026-11-20', payee: 'ACME CORP PVT LTD', account: '6543', reference: 'HDFCN52026112012345678', rail: 'NEFT', sure: true }],
  ['an AutoPay payment that went through (no day named: the day it arrived)', 'hdfc', '',
    'Rs 199.00 debited from A/c XX1234 for NETFLIX via UPI AutoPay. Ref 432199887766',
    { app: 'hdfc', direction: 'debit', amount: 199, date: '2026-11-24', payee: 'NETFLIX', account: '1234', reference: '432199887766', rail: 'UPI', sure: true }],
  ['paise kept', 'hdfc', '',
    'Sent Rs.1,234.56 From HDFC Bank A/C *1234 To SWIGGY On 24/11/26 Ref 432112349999',
    { app: 'hdfc', direction: 'debit', amount: 1234.56, date: '2026-11-24', payee: 'SWIGGY', account: '1234', reference: '432112349999', sure: true }],
  ['a bank app\'s wording that leaves doubt waits for a tap', 'idfc', 'Account update',
    'Rs. 400.00 debited and Rs. 400.00 credited back for txn 432100004444',
    { app: 'idfc', direction: 'debit', amount: 400, date: D, sure: false }],
];
for (const [label, app, title, text, expected] of bankCases) eq(label, tidy(read(app, title, text)), expected);

// ── Not payments ─────────────────────────────────────────────────────────────
console.log('Not payments');
for (const [label, app, title, text] of [
  ['an OTP', 'hdfc', 'OTP', '123456 is your OTP for txn of Rs.1,299.00 at AMAZON on HDFC Bank card 5678. Valid till 18:45. Do not share OTP with anyone.'],
  ['a failed payment', 'phonepe', 'Payment failed', 'Payment of ₹249 to Swiggy failed. Money, if debited, will be refunded in 3-5 days'],
  ['a pending payment', 'phonepe', '', 'Payment of ₹249 to Swiggy is pending'],
  ['a payment being processed', 'gpay', '', 'Your payment of ₹249 to Swiggy is being processed'],
  ['a declined card', 'hdfc', '', 'Txn of Rs 2,499.00 on HDFC Bank Card 5678 at MYNTRA was declined due to insufficient balance.'],
  ['a bill due', 'hdfc', '', 'Payment of Rs 4,523.00 for your HDFC Bank Credit Card XX5678 is due on 05-12-26. Minimum amount due Rs 230.00'],
  ['a money request', 'gpay', 'Kabir Naidu requested ₹200', 'Tap to pay'],
  ['a collect request', 'phonepe', '', 'RAHUL has requested money of Rs 500 from you. On approving, Rs 500 will be debited from your A/c XX1234'],
  ['an AutoPay mandate being set up', 'hdfc', '', 'UPI AutoPay mandate of Rs 199 for NETFLIX created successfully on A/c XX1234'],
  ['a payment still to come', 'hdfc', '', 'Rs 199 will be debited from your A/c XX1234 on 26-11-26 for NETFLIX AutoPay'],
  ['a refund still to come', 'paytm', '', 'Refund of ₹249 initiated for your order. It will be credited in 5-7 days'],
  ['a balance alert', 'hdfc', '', 'Available balance in A/c XX1234 is Rs 12,345.67 as on 24-11-26'],
  ['an offer from a bank', 'hdfc', '', 'Get a pre-approved personal loan up to Rs 5,00,000 at 10.5% p.a. Apply now on the HDFC Bank app'],
  ['an offer from a payment app', 'gpay', 'Get ₹50 cashback', 'on your next electricity bill payment'],
  ['a reward still to win', 'gpay', 'You won ₹10 cashback!', 'Scratch your card to claim it'],
  ['a reminder', 'phonepe', 'Reminder', 'You paid ₹500 to Rahul Sharma last month. Pay again?'],
  ['chat in a payment app', 'gpay', 'Rahul', 'Thanks for the ₹500 you sent'],
  ['chat that names a payment', 'gpay', 'Rahul', 'I sent you ₹500 yesterday'],
  ['no amount', 'gpay', 'Rahul Sharma', 'sent you a message'],
  ['an amount with nothing moved', 'paytm', 'Paytm', 'Your Paytm wallet holds ₹500'],
  ['an empty notification', 'gpay', '', '   '],
]) eq(label, read(app, title, text), null);

// ── Privacy ──────────────────────────────────────────────────────────────────
console.log('Privacy');
{
  const p = read('hdfc', '', 'Rs.500.00 debited from A/c 123456781234 on 24-11-26 to rent@okaxis. UPI Ref 432112340000');
  eq('only the last four digits of an account', p?.account, '1234');
  ok('the whole number never comes out', !JSON.stringify(p).includes('12345678'));
  ok('only payment fields come out', p && Object.keys(p).every(k => [...KEYS, 'at'].includes(k)));
  const card = read('hdfc', '', 'Spent Rs.99.00 On HDFC Bank Card 4111111111111111 At CAFE On 2026-11-24');
  eq('a card number keeps only its last four', card?.account, '1111');
  ok('… and never comes out whole', !JSON.stringify(card).includes('411111111111'));
  const imps = read('idfc', '', bankCases.find(c => c[0].startsWith('IDFC FIRST, IMPS'))[3]);
  ok("the sender's mobile is never kept", !JSON.stringify(imps).includes('123') && !/mobile/i.test(JSON.stringify(imps)));
  eq('a notification\'s time comes out as when it arrived', read('gpay', 'Priya Sharma', 'Paid you ₹10')?.at, arrived);
}

// ── Dates ────────────────────────────────────────────────────────────────────
console.log('Dates');
{
  const at = new Date(2026, 0, 2, 9, 0).getTime(); // 2 Jan 2026
  eq('a December alert arriving in January keeps December', read('hdfc', '', 'Sent Rs.10.00 From HDFC Bank A/C *1234 To TEA On 31/12/25 Ref 432100000001', at)?.date, '2025-12-31');
  eq('not a real day: the day it arrived', read('hdfc', '', 'Sent Rs.10.00 From HDFC Bank A/C *1234 To TEA On 31/02/26 Ref 432100000002')?.date, '2026-11-24');
  eq('a day in the future: the day it arrived', read('hdfc', '', 'Sent Rs.10.00 From HDFC Bank A/C *1234 To TEA On 24/11/27 Ref 432100000003')?.date, '2026-11-24');
  eq('more than 400 days old: the day it arrived', read('hdfc', '', 'Sent Rs.10.00 From HDFC Bank A/C *1234 To TEA On 01/01/24 Ref 432100000004')?.date, '2026-11-24');
  const late = new Date(2026, 10, 24, 23, 58).getTime();
  eq('late at night, the day is still the local one', read('gpay', '', '₹50 paid to Tea Stall', late)?.date, '2026-11-24');
  const early = new Date(2026, 10, 25, 0, 2).getTime();
  eq('just after midnight, the new day', read('gpay', '', '₹50 paid to Tea Stall', early)?.date, '2026-11-25');
}

// ── Entries ──────────────────────────────────────────────────────────────────
console.log('Entries');
{
  const p = read('gpay', '', '₹249 paid to Swiggy');
  const e = A.paymentEntry(p, 'app-1');
  eq('a payment app\'s payment becomes an expense marked with its app', e,
    { id: 'app-1', amount: 249, type: 'EXPENSE', category: 'Food Delivery', date: '2026-11-24', createdAt: new Date(arrived).toISOString(), via: 'gpay', merchant: 'UPI/Swiggy' });
  const person = A.paymentEntry(read('phonepe', '', '₹480 sent to Ananya Iyer'), 'app-2');
  eq('to a person: a transfer, shown as To review until sorted', [person.category, person.merchant], ['Transfer Out', 'UPI/Ananya Iyer']);
  const metro = A.paymentEntry(read('paytm', '', '₹1,200 paid for Mumbai Metro recharge. Payment successful.'), 'app-3');
  eq('paid for something its category knows', metro.category, 'Metro');
  const withRef = A.paymentEntry(read('gpay', 'Payment successful', '₹299 paid to Blue Tokai Coffee. UPI transaction successful. Ref no: 628391045721.'), 'app-4');
  eq('a reference goes in the narration, as statements write it', withRef.merchant, 'UPI/628391045721/Blue Tokai Coffee');
  eq('… so a statement finds the payment by it', A.bankReference(withRef.merchant), 'rrn:628391045721');
  const idfc = A.paymentEntry(read('idfc', '', bankCases.find(c => c[0].startsWith('IDFC FIRST, UPI payment:'))[3]), 'app-5');
  eq('IDFC FIRST UPI: the narration reads like the statement\'s', idfc.merchant, 'UPI/432143210987/BLINKIT');
  eq('… and has the same reference as the statement row for the payment',
    A.bankReference(idfc.merchant), A.bankReference('UPI/DR/432143210987/BLINKIT/YESB/blinkit.payu@ybl/UPI'));
  const neft = A.paymentEntry(read('axis', '', bankCases.find(c => c[0].startsWith('NEFT money received'))[3]), 'app-6');
  eq('money received becomes income', neft.type, 'INCOME');
  eq('… and a NEFT UTR is found the same way', A.bankReference(neft.merchant), 'utr:HDFCN52026112012345678');
  const imps = A.paymentEntry(read('idfc', '', bankCases.find(c => c[0].startsWith('IDFC FIRST, IMPS'))[3]), 'app-7');
  eq('IMPS money in: found by its IMPS reference', A.bankReference(imps.merchant), 'rrn:532211004477');
  const union = A.paymentEntry(read('union', '', bankCases.find(c => c[0].startsWith('Union Bank'))[3]), 'app-8');
  eq('no payee and no rail: no name', union.merchant, undefined);
  const atm = A.paymentEntry(read('sbi', '', bankCases.find(c => c[0].startsWith('an ATM'))[3]), 'app-9');
  eq('a cash withdrawal', [atm.merchant, atm.category], ['ATM', 'Cash Withdrawal']);
  eq('cashback is a bonus', A.paymentEntry(read('paytm', '', '₹75 cashback received. Paytm cashback for mobile recharge.'), 'a').category, 'Bonus');
  eq('a refund is a refund', A.paymentEntry(read('hdfc', '', bankCases.find(c => c[0] === 'a refund is money in')[3]), 'b').category, 'Refunds');
  eq('interest is interest', A.paymentEntry(read('hdfc', '', '₹250 interest credited. Savings account interest for November.'), 'c').category, 'Interest Income');
  // Money in that names no payer is named after the app or bank it came through (Vault showed "Unknown payee").
  eq('cashback names the app that paid it', A.paymentEntry(read('gpay', '', '₹150 cashback received. Reward for paying with Google Pay at More Supermarket.'), 'e').merchant, 'UPI/Google Pay cashback');
  eq('interest names the bank', A.paymentEntry(read('hdfc', '', '₹250 interest credited. Savings account interest for November.'), 'f').merchant, 'HDFC Bank interest');
  eq('shared cashback is named by its kind', A.moneyInPayer({ app: 'shared', kind: 'cashback' }), 'Cashback');
  eq('a payer the text names is kept', A.moneyInPayer({ app: 'gpay', kind: 'refund', payee: 'Myntra' }), undefined);
  eq('a card spend reads as a card payment', A.paymentEntry(read('idfc', '', bankCases.find(c => c[0].startsWith('IDFC FIRST, debit card'))[3]), 'd').merchant, 'POS/ACME CLOUD');
  eq('a name with a slash keeps the narration\'s fields', A.paymentNarration({ app: 'gpay', payee: 'A/B Traders' }), 'UPI/A B Traders');

  // Ids.
  const n = notice('gpay', '', '₹249 paid to Swiggy');
  const again = { ...n, title: '', text: '₹249 paid to Swiggy ' };
  const p1 = A.readNotice(n), p2 = A.readNotice(again);
  eq('the same notification read twice gives the same id', A.noticeEntryId(again, p2), A.noticeEntryId(n, p1));
  ok('ids start app-', /^app-[0-9a-f]{16}$/.test(A.noticeEntryId(n, p1)));
  ok('another notification of the same payment gets another id', A.noticeEntryId({ ...n, key: n.key + 'x' }, p1) !== A.noticeEntryId(n, p1));
  ok('… as does the same notification at another time', A.noticeEntryId({ ...n, when: n.when + 60000 }, p1) !== A.noticeEntryId(n, p1));
  ok('… or another amount', A.noticeEntryId(n, { ...p1, amount: 250 }) !== A.noticeEntryId(n, p1));
  eq('shared text: the same message gives the same id', A.sharedEntryId('Sent Rs.10  to TEA'), A.sharedEntryId(' sent rs.10 to tea '));
  ok('… and starts share-', /^share-[0-9a-f]{16}$/.test(A.sharedEntryId('x')));
}

// ── Shared text ──────────────────────────────────────────────────────────────
console.log('Shared text');
{
  const at = new Date(arrived);
  const sms = 'Your A/c XX4821 debited by Rs. 560.00 on 24/11/26; BLINKIT credited. RRN 432143210987. Available balance Rs. 12,340.55. Team IDFC FIRST Bank';
  eq('a shared bank SMS is read, and waits for a tap', tidy(A.readShared(sms, at)),
    { app: 'share', direction: 'debit', amount: 560, date: '2026-11-24', payee: 'BLINKIT', account: '4821', reference: '432143210987', rail: 'UPI', sure: false });
  eq('a shared payment app receipt', tidy(A.readShared('I paid ₹249 to Swiggy using Google Pay. UPI transaction ID: 432100001111', at)),
    { app: 'share', direction: 'debit', amount: 249, date: '2026-11-24', payee: 'Swiggy', reference: '432100001111', rail: 'UPI', sure: false });
  eq('shared text that is no payment', A.readShared('See you at 6, bring ₹500 for the tickets?', at), null);
  eq('shared OTP', A.readShared('123456 is your OTP for Rs.1,299.00 at AMAZON', at), null);
  eq('shared nothing', A.readShared('', at), null);
}

// ── Speed ────────────────────────────────────────────────────────────────────
console.log('Speed');
{
  const all = [...appCases, ...bankCases].map(c => notice(c[1], c[2], c[3]));
  const many = Array.from({ length: 10000 }, (_, i) => all[i % all.length]);
  const t0 = performance.now();
  let found = 0;
  for (const n of many) if (A.readNotice(n)) found++;
  const ms = performance.now() - t0;
  console.log(`  10,000 notifications read in ${ms.toFixed(0)} ms`);
  ok('10,000 notifications are read in under a second', ms < 1000);
  eq('… every payment among them found', found, 10000);
}

console.log(failures ? `\n${failures} of ${checks} checks failed` : `\nAll ${checks} checks passed`);
process.exit(failures ? 1 : 0);
