#!/usr/bin/env node
/**
 * Entries Wall-ette adds from payment apps' notifications and shared text
 * (services/captured.ts), on made-up wallets and notifications.
 *
 * Checks that nothing counts twice:
 *   - a sure payment is added; one with doubt, or with "Ask me first" on,
 *     waits for a tap; a notification that isn't a payment is only read
 *   - the same notification read twice, or posted again by its app, is
 *     added once; one payment notified by two apps is added once
 *   - the same app notifying the same amount again moments later, an entry
 *     typed in New Entry within the hour, or a statement row the same day
 *     makes it wait for a tap; a statement row with its reference means
 *     it's in the wallet already
 *   - every notification handed over is reported read
 *   - a statement's rows take the place of the entries they stand for: by
 *     reference, or by amount, a day either side and the payee's name
 *     (cut short as banks do); different payees or references never pair,
 *     and each entry pairs once
 *   - the row keeps the category and note the entry was given, unless they
 *     only say money moved
 *   - an import that replaces them leaves the balance and the number of
 *     entries as they should be, and the balance check agrees
 *   - lists kept on the phone stay small and fresh
 *
 * Usage (after `npm ci`): node scripts/check-captured.mjs
 * Exits with code 1 if any check fails.
 */
import { build } from 'esbuild'; // installed with Vite
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

process.env.TZ = 'Asia/Kolkata';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tmp = mkdtempSync(join(tmpdir(), 'wallette-captured-'));
const entry = join(tmp, 'entry.ts');
writeFileSync(entry, [
  `export * from ${JSON.stringify(join(root, 'services', 'captured.ts'))};`,
  `export { readNotice, noticeEntryId, paymentEntry } from ${JSON.stringify(join(root, 'services', 'paymentAlerts.ts'))};`,
  `export { mergeImport, afterMerge, ledgerBalance, importTally } from ${JSON.stringify(join(root, 'services', 'statementImport.ts'))};`,
  `export { showAdded, getInbox } from ${JSON.stringify(join(root, 'services', 'paymentInbox.ts'))};`,
].join('\n'));
const bundle = join(tmp, 'captured.mjs');
await build({ entryPoints: [entry], outfile: bundle, bundle: true, platform: 'node', format: 'esm', logLevel: 'error' });
const C = await import(pathToFileURL(bundle).href);
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

const PKG = { gpay: 'com.google.android.apps.nbu.paisa.user', phonepe: 'com.phonepe.app', paytm: 'net.one97.paytm', hdfc: 'com.snapwork.hdfc', idfc: 'com.idfcfirstbank.optimus' };
const at = (h, m, d = 24) => new Date(2026, 10, d, h, m).getTime();
let seq = 0;
const notice = (app, title, text, posted, key) => {
  seq++;
  const k = key ?? `0|${PKG[app]}|${seq}|null|10123`;
  return { id: `${k}|${posted}`, pkg: PKG[app], key: k, when: posted, posted, title, text };
};
const E = (id, amount, type, date, merchant, extra = {}) => ({ id, amount, type, category: extra.category ?? 'Other', date, ...(merchant ? { merchant } : {}), ...extra });

// ── Names ────────────────────────────────────────────────────────────────────
console.log('Names');
eq('a name the bank cut short', C.namesAgree({ merchant: 'UPI/Sai Prasad Bar And Restaurant' }, { merchant: 'UPI/DR/432143210990/SAI PRASAD BAR AND R/YESB/x@ybl/UPI' }), 'yes');
eq('the same shop', C.namesAgree({ merchant: 'UPI/Swiggy' }, { merchant: 'UPI/DR/432112345678/SWIGGY/YESB/swiggy@ybl/UPI' }), 'yes');
eq('another shop', C.namesAgree({ merchant: 'UPI/Swiggy' }, { merchant: 'UPI/DR/432112345679/ZOMATO/YESB/zomato@ybl/UPI' }), 'no');
eq('a UPI ID against the name and ID in a narration', C.namesAgree({ merchant: 'UPI/rahul.s@okaxis' }, { merchant: 'UPI/DR/432100000001/RAHUL S/UTIB/rahul.s@okaxis/UPI' }), 'yes');
eq('no payee: nothing to tell by', C.namesAgree({}, { merchant: 'UPI/DR/1/SWIGGY' }), 'unknown');
eq('only a reference: nothing to tell by', C.namesAgree({ merchant: 'UPI/432112345678' }, { merchant: 'UPI/DR/432112345678/SWIGGY' }), 'unknown');
eq('a row with no letters: nothing to tell by', C.namesAgree({ merchant: 'UPI/Swiggy' }, { merchant: '12345' }), 'unknown');

// ── A statement arrives ──────────────────────────────────────────────────────
console.log('Statement rows');
{
  const wallet = [
    E('app-1', 249, 'EXPENSE', '2026-11-24', 'UPI/Swiggy', { via: 'gpay', category: 'Food Delivery', note: 'office lunch' }),
    E('app-2', 560, 'EXPENSE', '2026-11-24', 'UPI/432143210987/BLINKIT', { via: 'idfc', category: 'Groceries' }),
    E('app-3', 500, 'INCOME', '2026-11-23', 'UPI/Rahul Sharma', { via: 'phonepe', category: 'Transfer In' }),
    E('app-4', 50, 'EXPENSE', '2026-11-24', 'UPI/Tea Stall', { via: 'gpay', category: 'Transfer Out' }),
    E('app-5', 120, 'EXPENSE', '2026-11-20', 'UPI/432100009999/Uber', { via: 'gpay' }),
    E('app-6', 75, 'EXPENSE', '2026-11-10', 'UPI/Chai', { via: 'gpay' }),
    E('txn-1', 300, 'EXPENSE', '2026-11-24', 'Lunch', { createdAt: '2026-11-24T07:00:00.000Z' }),
  ];
  const rows = [
    E('r1', 249, 'EXPENSE', '2026-11-24', 'UPI/DR/432112345678/SWIGGY/YESB/swiggy@ybl/UPI'),
    E('r2', 560, 'EXPENSE', '2026-11-25', 'UPI/DR/432143210987/BLINKIT/YESB/blinkit@ybl/UPI'),
    E('r3', 500, 'INCOME', '2026-11-23', 'UPI/CR/432100000003/RAHUL SHARMA/HDFC/rahul@okhdfcbank/UPI'),
    E('r4', 50, 'EXPENSE', '2026-11-25', 'UPI/DR/432100000004/TEA STALL/PYTM/tea@paytm/UPI'),
    E('r5', 249, 'EXPENSE', '2026-11-24', 'UPI/DR/432100000005/ZOMATO/YESB/zomato@ybl/UPI'),
    E('r6', 300, 'EXPENSE', '2026-11-24', 'NEFT/N1234/ACME'),
    E('r7', 120, 'EXPENSE', '2026-11-20', 'UPI/DR/432100001111/UBER/UTIB/uber@axisbank/UPI'),
    E('r8', 75, 'EXPENSE', '2026-11-14', 'UPI/DR/432100002222/CHAI/UTIB/chai@axisbank/UPI'),
  ];
  const map = C.capturedRows(rows, wallet);
  eq('each row stands for the entry it is', [...map].sort(), [['r1', 'app-1'], ['r2', 'app-2'], ['r3', 'app-3'], ['r4', 'app-4']]);
  ok('another payee the same day never pairs', !map.has('r5'));
  ok('an entry typed in New Entry is never replaced', ![...map.values()].includes('txn-1'));
  ok('different references never pair, even with the same amount and day', !map.has('r7'));
  ok('days apart without a reference never pair', !map.has('r8'));
  eq('a reference pairs across a day', map.get('r2'), 'app-2');
  eq('no entries read from apps: nothing pairs', C.capturedRows(rows, wallet.filter(t => !t.via)).size, 0);
  // Two of the same amount and day: names decide, closest first.
  const twins = C.capturedRows(
    [E('ra', 100, 'EXPENSE', '2026-11-24', 'UPI/DR/1/BOOK SHOP/x'), E('rb', 100, 'EXPENSE', '2026-11-24', 'UPI/DR/2/FRUIT STALL/x')],
    [E('app-a', 100, 'EXPENSE', '2026-11-24', 'UPI/Fruit Stall', { via: 'gpay' }), E('app-b', 100, 'EXPENSE', '2026-11-24', 'UPI/Book Shop', { via: 'gpay' })],
  );
  eq('two payments of one amount on one day pair by name', [...twins].sort(), [['ra', 'app-b'], ['rb', 'app-a']]);
  const one = C.capturedRows([E('rc', 100, 'EXPENSE', '2026-11-24', 'UPI/DR/3/X'), E('rd', 100, 'EXPENSE', '2026-11-24', 'UPI/DR/4/Y')],
    [E('app-c', 100, 'EXPENSE', '2026-11-24', undefined, { via: 'idfc' })]);
  eq('one entry pairs with one row at most', one.size, 1);

  // Carrying over.
  const r1 = C.carryOver(rows[0], wallet[0]);
  eq('the row keeps the category and note the entry was given', [r1.category, r1.note, r1.merchant, r1.id], ['Food Delivery', 'office lunch', rows[0].merchant, 'r1']);
  eq('a category that only says money moved isn\'t carried', C.carryOver({ ...rows[3], category: 'Tea' }, wallet[3]).category, 'Tea');
  eq('the row\'s own note stays', C.carryOver({ ...rows[0], note: 'bank note' }, wallet[0]).note, 'bank note');
  ok('no time of day is carried (statement rows have none)', !('createdAt' in C.carryOver(rows[0], { ...wallet[0], createdAt: '2026-11-24T14:45:00.000Z' })));

  // The import: rows in, the entries they stand for out, in one step.
  const ledger = { transactions: wallet, openingBalance: 10000, openingBalanceAsOf: '2026-11-01' };
  const replaces = [...map.values()];
  const incoming = rows.filter(r => map.has(r.id) || r.id === 'r5').map(r => (map.has(r.id) ? C.carryOver(r, wallet.find(t => t.id === map.get(r.id))) : r));
  const merged = C.mergeImport(ledger, incoming, { removeIds: replaces });
  const after = C.afterMerge(ledger, merged);
  const net = list => list.reduce((s, t) => s + (t.type === 'INCOME' ? 1 : -1) * Math.round(t.amount * 100), 0);
  eq('the balance moves only by the new payment', Math.round(C.ledgerBalance(after) * 100), Math.round(C.ledgerBalance(ledger) * 100) - 24900);
  eq('… and the wallet has one entry per payment', after.transactions.length, wallet.length + 1);
  ok('the entries replaced are gone', replaces.every(id => !after.transactions.some(t => t.id === id)));
  eq('the rows came in with the entries\' categories', after.transactions.filter(t => ['r1', 'r2'].includes(t.id)).map(t => t.category).sort(), ['Food Delivery', 'Groceries']);
  eq('the money in and out is the same, but from the statement', net(after.transactions.filter(t => !['r5'].includes(t.id))), net(wallet));
  const tally = C.importTally({ wallet: ledger, selected: incoming, rows, minDate: '2026-11-23', maxDate: '2026-11-25', closing: 0, bridge: false, replaces });
  eq('the balance check counts each payment once', Math.round(tally.projectedFinal * 100), Math.round(C.ledgerBalance(after) * 100));
  const without = C.importTally({ wallet: ledger, selected: incoming, rows, minDate: '2026-11-23', maxDate: '2026-11-25', closing: 0, bridge: false });
  ok('… which it wouldn\'t without them', Math.round(without.projectedFinal * 100) !== Math.round(tally.projectedFinal * 100));
}

// ── Reading new ones ─────────────────────────────────────────────────────────
console.log('Intake');
{
  const n1 = notice('gpay', '', '₹249 paid to Swiggy', at(20, 15));
  const n1again = { ...n1 };
  const chat = notice('gpay', 'Rahul', 'Thanks for the ₹500 you sent', at(20, 16));
  const n4 = notice('hdfc', '', 'Rs.249.00 debited from A/c XX1234 on 24-11-26 to VPA swiggy@ybl. UPI Ref 432112345678', at(20, 17));
  const n5 = notice('gpay', '', '₹100 paid to Tea Stall', at(21, 0));
  const n6 = notice('gpay', '', '₹100 paid to Tea Stall', at(21, 2));
  const n7 = notice('paytm', '', '₹75 cashback received. Paytm cashback for mobile recharge.', at(21, 10));
  const n9 = notice('gpay', '', '₹100 paid to Tea Stall', at(21, 5), n5.key); // the app posting n5 again
  const n10 = notice('gpay', '', '₹300 paid to Cafe Mocha', at(20, 10));
  const n11 = notice('hdfc', '', 'Rs 199.00 debited from A/c XX1234 for NETFLIX via UPI AutoPay. Ref 432199887766', at(9, 0));
  const n12 = notice('phonepe', '', 'Received ₹750 from VIKRAM RAO', at(22, 0));
  const n13 = notice('gpay', '', '₹60 paid to Bakery', at(22, 30));
  const done13 = C.noticeEntryId(n13, C.readNotice(n13));
  const wallet = [
    E('txn-9', 300, 'EXPENSE', '2026-11-24', 'Coffee', { createdAt: new Date(at(19, 50)).toISOString() }),
    E('import-n', 199, 'EXPENSE', '2026-11-24', 'UPI/DR/432199887766/NETFLIX/HDFC/netflix@hdfc/UPI'),
    E(done13, 60, 'EXPENSE', '2026-11-24', 'UPI/Bakery', { via: 'gpay' }),
  ];
  const all = [n1, n1again, chat, n4, n5, n6, n7, n9, n10, n11, n12, n13];
  const plan = C.planIntake(all, wallet, [], [], { askFirst: false });
  const idOf = n => C.noticeEntryId(n, C.readNotice(n));
  eq('sure ones are added', plan.add.map(t => t.id), [idOf(n1), idOf(n5), idOf(n12)]);
  eq('… marked with their app', plan.add.map(t => t.via), ['gpay', 'gpay', 'phonepe']);
  eq('the rest wait for a tap, with why', plan.check.map(w => [w.entry.amount, w.reason]),
    [[300, 'in-wallet'], [100, 'maybe-twice'], [75, 'unsure']]);
  ok('the same notification twice is added once', plan.add.filter(t => t.id === idOf(n1)).length === 1);
  ok('the bank app\'s notice of the Google Pay payment adds nothing', ![...plan.add, ...plan.check.map(w => w.entry)].some(t => t.id === idOf(n4)));
  ok('an app posting a notification again adds nothing', ![...plan.add, ...plan.check.map(w => w.entry)].some(t => t.id === idOf(n9)));
  ok('a statement row with the reference: nothing added', ![...plan.add, ...plan.check.map(w => w.entry)].some(t => t.id === idOf(n11)));
  ok('already in the wallet: nothing added', ![...plan.add, ...plan.check.map(w => w.entry)].some(t => t.id === done13));
  eq('every notification handed over is reported read', plan.read.slice().sort(), all.map(n => n.id).sort());
  ok('the text shown with one to check is the notification\'s', plan.check.find(w => w.reason === 'unsure').text.includes('cashback received'));
  ok('notifications read are remembered', plan.seen.length >= 5 && plan.seen.every(s => s.key && s.entryId.startsWith('app-')));

  const asked = C.planIntake([n1, n12], [], [], [], { askFirst: true });
  eq('Ask me first: sure ones wait too', [asked.add.length, asked.check.map(w => w.reason)], [0, ['ask-first', 'ask-first']]);
  const waiting = C.planIntake([n1], [], asked.check, [], { askFirst: false });
  eq('one already waiting isn\'t asked about twice', [waiting.add.length, waiting.check.length], [0, 0]);
  const later = C.planIntake([n9], [], [], plan.seen, { askFirst: false });
  eq('remembered from before: posted again later, still nothing', [later.add.length, later.check.length], [0, 0]);
  const muchLater = C.planIntake([notice('gpay', '', '₹100 paid to Tea Stall', at(23, 30), n5.key)], [], [], plan.seen, { askFirst: false });
  eq('the same notification key an hour later is a new payment', muchLater.add.length + muchLater.check.length, 1);
  const refs = C.planIntake([
    notice('hdfc', '', 'Rs.500.00 debited from A/c XX1234 on 24-11-26 to VPA a@ybl. UPI Ref 432100000001', at(20, 0)),
    notice('idfc', '', 'Your A/c XX4821 debited by Rs. 500.00 on 24/11/26; BOOKS credited. RRN 432100000002. Team IDFC FIRST Bank', at(20, 1)),
  ], [], [], [], { askFirst: false });
  eq('two banks\' alerts with different references: two payments', refs.add.length, 2);
  const nothing = C.planIntake([], wallet, [], [], { askFirst: false });
  eq('nothing to read: nothing done', [nothing.add.length, nothing.check.length, nothing.read.length], [0, 0, 0]);
}

// ── Shared text ──────────────────────────────────────────────────────────────
console.log('Shared text');
{
  const w = C.sharedToCheck('Sent Rs.450.00 From HDFC Bank A/C *1234 To SWIGGY On 24/11/26 Ref 432112345678', new Date(at(20, 0)));
  eq('a shared alert waits for a tap', [w.reason, w.entry.amount, w.entry.via, /^share-/.test(w.entry.id)], ['shared', 450, 'share', true]);
  eq('shared text that is no payment', C.sharedToCheck('hello there', new Date(at(20, 0))), null);
}

// ── Kept on the phone ────────────────────────────────────────────────────────
console.log('Lists');
{
  const now = at(12, 0, 27);
  const item = (id, t) => ({ entry: E(id, 1, 'EXPENSE', '2026-11-24', 'UPI/x', { via: 'gpay' }), text: 't', reason: 'unsure', at: t });
  const list = [item('a', now - 1000), item('b', now - 61 * 86_400_000), item('a', now - 5000), ...Array.from({ length: 150 }, (_, i) => item(`n${i}`, now - i * 60_000))];
  const kept = C.keepToCheck(list, now);
  ok('at most 100 wait', kept.length === 100);
  ok('none older than 60 days', kept.every(w => now - w.at <= 60 * 86_400_000));
  eq('one per entry, the newest first', [kept.filter(w => w.entry.id === 'a').length, kept[0].entry.id], [1, 'n0']);
  const seen = C.keepSeen([{ key: 'k', at: now - 8 * 86_400_000 }, ...Array.from({ length: 600 }, (_, i) => ({ key: `k${i}`, at: now - i }))], now);
  ok('notifications remembered a week, at most 500', seen.length === 500 && seen.every(s => now - s.at <= 7 * 86_400_000));
}

{
  // "Added N payments" with Undo: payments added while it shows join it.
  C.showAdded({ ids: ['p1'], apps: ['phonepe'], at: 1 });
  C.showAdded({ ids: ['g1'], apps: ['gpay'], at: 2 });
  eq('payments added while the message shows join it, so one Undo takes both back', C.getInbox().added, { ids: ['p1', 'g1'], apps: ['phonepe', 'gpay'], at: 2 });
  C.showAdded(null);
  C.showAdded({ ids: ['h1'], apps: ['hdfc'], at: 3 });
  eq('once it has gone, the next payments start a new one', C.getInbox().added, { ids: ['h1'], apps: ['hdfc'], at: 3 });
  C.showAdded(null);
}

console.log(failures ? `\n${failures} of ${checks} checks failed` : `\nAll ${checks} checks passed`);
process.exit(failures ? 1 : 0);
