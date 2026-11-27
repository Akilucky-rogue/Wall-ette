#!/usr/bin/env node
/**
 * Bank accounts (services/accounts.ts accountSummaries, entryAccount).
 *
 * Checks, on made-up wallets, that:
 *   - each account's balance is its opening balance plus its own entries,
 *     and the accounts and other entries add up to the wallet's balance,
 *     to the paisa, on 300 random wallets
 *   - rows imported before 1.5.9 count in the account that took over the
 *     opening balance from then, from that balance's day on; entries typed
 *     in count as other entries
 *   - every entry is in exactly one place, so Vault's account filter shows
 *     each entry under one account
 *   - accounts come busiest first, named as the statement named them, and an
 *     account the settings don't know is still named from its key
 *
 * Usage (after `npm ci`):
 *   node scripts/check-accounts.mjs
 *
 * Exits with code 1 if any check fails.
 */
import { build } from 'esbuild'; // installed with Vite
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tmp = mkdtempSync(join(tmpdir(), 'wallette-accounts-'));
const entry = join(tmp, 'entry.ts');
writeFileSync(entry, `export * from ${JSON.stringify(join(root, 'services', 'accounts.ts'))};\n`);
const bundle = join(tmp, 'accounts.mjs');
await build({ entryPoints: [entry], outfile: bundle, bundle: true, platform: 'node', format: 'esm', logLevel: 'error' });
const A = await import(pathToFileURL(bundle).href);
rmSync(tmp, { recursive: true, force: true });

let failures = 0, checks = 0;
const eq = (label, actual, expected) => {
  checks++;
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a !== e) { failures++; if (failures <= 30) console.log(`  FAIL ${label}: got ${a}, expected ${e}`); }
};
const ok = (label, cond) => { checks++; if (!cond) { failures++; if (failures <= 30) console.log(`  FAIL ${label}`); } };

const hdfc = A.accountKey('HDFC Bank', '1234');
const equitas = A.accountKey('Equitas Small Finance Bank', '5678');
const e = (id, amount, type, date, extra = {}) => ({ id, amount, type, category: 'Dining', date, ...extra });

// ── A hand-worked wallet ─────────────────────────────────────────────────────
{
  const anchors = {
    [hdfc]: { bank: 'HDFC Bank', last4: '1234', opening: 10000, asOf: '2026-01-01', legacy: true },
    [equitas]: { bank: 'Equitas Small Finance Bank', last4: '5678', opening: 2500.5, asOf: '2026-03-01' },
  };
  const list = [
    e('a', 50000, 'INCOME', '2026-01-01', { account: hdfc }),
    e('b', 1200.25, 'EXPENSE', '2026-01-05', { account: hdfc }),
    e('c', 300, 'EXPENSE', '2026-02-10'),                                  // imported before 1.5.9: HDFC's
    e('d', 99.99, 'EXPENSE', '2025-12-20'),                                // before HDFC's opening day: other
    e('f', 750, 'EXPENSE', '2026-03-04', { account: equitas }),
    e('g', 40, 'EXPENSE', '2026-03-05', { createdAt: '2026-03-05T10:00:00.000Z' }), // typed in
    e('h', 5, 'INCOME', '2026-04-01', { account: 'sbi:9999' }),            // an account the settings don't name
  ];
  const s = A.accountSummaries(list, anchors, 150);
  eq('accounts, busiest first', s.accounts.map(a => [a.label, a.balance, a.entries, a.latest]), [
    ['HDFC Bank ••1234', 10000 + 50000 - 1200.25 - 300, 3, '2026-02-10'],
    ['Equitas Small Finance Bank ••5678', 2500.5 - 750, 1, '2026-03-04'],
    ['Sbi ••9999', 5, 1, '2026-04-01'],
  ]);
  eq('other entries', [s.other.label, s.other.balance, s.other.entries], ['Other entries', Math.round((150 - 99.99 - 40) * 100) / 100, 2]);
  const wallet = 150 + 10000 + 2500.5 + list.reduce((x, t) => x + (t.type === 'INCOME' ? t.amount : -t.amount), 0);
  eq('together, the wallet balance', Math.round(s.total * 100), Math.round(wallet * 100));
  const legacy = A.legacyAccount(anchors);
  eq('the account that took over', legacy, { key: hdfc, asOf: '2026-01-01' });
  eq('each entry in one place', list.map(t => A.entryAccount(t, legacy)), [hdfc, hdfc, hdfc, A.OTHER_ENTRIES, equitas, A.OTHER_ENTRIES, 'sbi:9999']);
  eq('no other entries when there are none', A.accountSummaries([list[0]], { [hdfc]: anchors[hdfc] }, 0).other, null);
  eq('an empty wallet', A.accountSummaries([], {}, 0), { accounts: [], other: null, total: 0 });
}

// ── 300 random wallets ───────────────────────────────────────────────────────
let seed = 11;
const rand = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const pad = n => String(n).padStart(2, '0');
for (let w = 0; w < 300; w++) {
  const keys = [hdfc, equitas, A.accountKey('Kotak Mahindra Bank', String(1000 + w).slice(-4))].slice(0, 1 + Math.floor(rand() * 3));
  const anchors = {};
  keys.forEach((k, i) => {
    const [bank, last4] = [['HDFC Bank', '1234'], ['Equitas Small Finance Bank', '5678'], ['Kotak Mahindra Bank', String(1000 + w).slice(-4)]][i];
    anchors[k] = { bank, last4, opening: Math.round(rand() * 10_000_000) / 100, asOf: `2026-0${1 + i}-01`, ...(i === 0 && rand() < 0.5 ? { legacy: true } : {}) };
  });
  const unassigned = rand() < 0.3 ? Math.round(rand() * 500000) / 100 : 0;
  const list = Array.from({ length: 50 + Math.floor(rand() * 400) }, (_, i) => {
    const r = rand();
    const extra = r < 0.6 ? { account: keys[Math.floor(rand() * keys.length)] } : r < 0.8 ? { createdAt: '2026-05-01T09:00:00.000Z' } : {};
    return e(`w${w}-${i}`, Math.round(rand() * 2_000_000) / 100, rand() < 0.2 ? 'INCOME' : 'EXPENSE', `2026-${pad(1 + Math.floor(rand() * 9))}-${pad(1 + Math.floor(rand() * 28))}`, extra);
  });
  const s = A.accountSummaries(list, anchors, unassigned);
  const wallet = Math.round(A.totalOpening(unassigned, anchors) * 100) + list.reduce((x, t) => x + (t.type === 'INCOME' ? 1 : -1) * Math.round(t.amount * 100), 0);
  ok(`wallet ${w}: accounts and other entries add up to the balance`, Math.round(s.total * 100) === wallet);
  const counted = s.accounts.reduce((n, a) => n + a.entries, 0) + (s.other?.entries ?? 0);
  ok(`wallet ${w}: every entry counted once`, counted === list.length);
  const legacy = A.legacyAccount(anchors);
  const byFilter = new Map();
  for (const t of list) { const k = A.entryAccount(t, legacy); byFilter.set(k, (byFilter.get(k) ?? 0) + 1); }
  ok(`wallet ${w}: Vault's filter agrees with the counts`, [...s.accounts, ...(s.other ? [s.other] : [])].every(a => (byFilter.get(a.key) ?? 0) === a.entries));
  ok(`wallet ${w}: busiest first`, s.accounts.every((a, i) => i === 0 || s.accounts[i - 1].entries >= a.entries));
}

console.log(`accounts: ${checks - failures}/${checks} checks passed`);
process.exit(failures ? 1 : 0);
