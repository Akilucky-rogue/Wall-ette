#!/usr/bin/env node
/**
 * Essential and Plus (services/planRules.ts):
 *   - who can do what: paid plans switched off open everything; no plan
 *     keeps records readable but adds nothing; Plus-only features
 *   - Essential's limits: its 12 months, its one bank account, read-only
 *     entries outside them
 *   - moving between plans: up now, down at renewal and after year one,
 *     and Google Play's replacement mode for each
 *   - the same prices, trial and Spread terms as the website
 *     (site/src/lib/plans.ts, programs.ts) and the server
 *     (functions/src/plans.ts)
 *   - codes: typed loosely, shown in groups of four
 *
 * Usage: node scripts/check-plans.mjs
 */
import { build } from 'esbuild'; // installed with Vite
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tmp = mkdtempSync(join(tmpdir(), 'wallette-plans-'));
const entry = join(tmp, 'entry.ts');
writeFileSync(entry, [
  `export * from ${JSON.stringify(join(root, 'services', 'planRules.ts'))};`,
  `export { PLANS as SITE_PLANS, PLAN_RULES as SITE_RULES } from ${JSON.stringify(join(root, 'site', 'src', 'lib', 'plans.ts'))};`,
  `export { REFERRAL_REWARD as SITE_REFERRAL, STUDENT_OFFER as SITE_STUDENT } from ${JSON.stringify(join(root, 'site', 'src', 'lib', 'programs.ts'))};`,
].join('\n'));
const bundle = join(tmp, 'plans.mjs');
await build({ entryPoints: [entry], outfile: bundle, bundle: true, platform: 'node', format: 'esm', logLevel: 'error' });
const P = await import(pathToFileURL(bundle).href);
rmSync(tmp, { recursive: true, force: true });

let failures = 0;
let checks = 0;
const eq = (label, actual, expected) => {
  checks++;
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a !== e) { failures++; console.log(`  FAIL ${label}: got ${a}, expected ${e}`); }
};

const day = s => Date.parse(`${s}T12:00:00Z`);
const ent = (plan, extra = {}) => ({
  plan, cycle: plan ? 'monthly' : null, source: plan ? 'play' : null, state: plan ? 'active' : 'expired',
  expiresAt: null, trial: false, autoRenewing: true, memberSince: '2026-01-10', pendingChange: null, test: false, ...extra,
});

// ── Access ──
{
  const now = day('2026-11-28');
  eq('switched off: everything open, whatever the entitlement', [P.accessOf({ live: false, entitlement: null, now }), P.accessOf({ live: false, entitlement: ent(null), now })], ['open', 'open']);
  eq('switched on with no plan: none', P.accessOf({ live: true, entitlement: null, now }), 'none');
  eq('a plan the server says is open', [P.accessOf({ live: true, entitlement: ent('plus'), now }), P.accessOf({ live: true, entitlement: ent('essential'), now })], ['plus', 'essential']);
  const ended = ent('plus', { expiresAt: '2026-11-20T00:00:00Z' });
  eq('past its end by more than the renewal slack: none', P.accessOf({ live: true, entitlement: ended, now }), 'none');
  const justEnded = ent('plus', { expiresAt: '2026-11-27T00:00:00Z' });
  eq('a day past its end: still open while Play\'s notice may be late', P.accessOf({ live: true, entitlement: justEnded, now }), 'plus');
  eq('…and the app asks again', P.needsRefresh({ live: true, entitlement: justEnded, now }), true);
  eq('nothing to ask while it runs or when switched off', [P.needsRefresh({ live: true, entitlement: ent('plus', { expiresAt: '2026-12-28T00:00:00Z' }), now }), P.needsRefresh({ live: false, entitlement: justEnded, now })], [false, false]);
  eq('Plus features: open and Plus only', ['open', 'plus', 'essential', 'none'].map(a => P.opens(a, 'rewind')), [true, true, false, false]);
  eq('adding: every plan, not without one', ['open', 'plus', 'essential', 'none'].map(P.canAdd), [true, true, true, false]);
}

// ── Essential's limits ──
{
  eq('12 months: this month and the 11 before', [P.historyStart('2026-11-28'), P.historyStart('2026-01-15'), P.historyStart('2026-12-01')], ['2025-12-01', '2025-02-01', '2026-01-01']);
  eq('one month is this month', P.historyStart('2026-11-28', 1), '2026-11-01');
  eq('Essential keeps the account with the earliest statement', P.essentialAccount({ 'hdfc-bank:1234': { asOf: '2026-03-01' }, 'equitas:5678': { asOf: '2025-11-01' } }), 'equitas:5678');
  eq('an account with no known day comes last', P.essentialAccount({ 'a:1111': { asOf: null }, 'b:2222': { asOf: '2026-01-01' } }), 'b:2222');
  eq('no accounts yet', P.essentialAccount({}), null);
  const L = { access: 'essential', from: '2025-12-01', account: 'hdfc-bank:1234' };
  const other = 'other';
  eq('Essential: its account inside its 12 months can be changed', P.editable(L, { date: '2026-05-02', account: 'hdfc-bank:1234' }, other), true);
  eq('Essential: older than 12 months is read-only', P.editable(L, { date: '2025-11-30', account: 'hdfc-bank:1234' }, other), false);
  eq('Essential: a second account is read-only', P.editable(L, { date: '2026-05-02', account: 'equitas:5678' }, other), false);
  eq('Essential: typed-in and app entries count in its account', P.editable(L, { date: '2026-05-02', account: other }, other), true);
  eq('no plan: nothing changes', P.editable({ ...L, access: 'none' }, { date: '2026-05-02', account: other }, other), false);
  eq('Plus and switched off: everything changes', [P.editable({ ...L, access: 'plus' }, { date: '2019-01-01', account: 'x:1' }, other), P.editable({ ...L, access: 'open' }, { date: '2019-01-01', account: 'x:1' }, other)], [true, true]);
  eq('Essential takes its own account, the first, or an unnamed one', [P.takesAccount(L, 'hdfc-bank:1234'), P.takesAccount(L, null), P.takesAccount({ ...L, account: null }, 'equitas:5678')], [true, true, true]);
  eq('…but not a second', P.takesAccount(L, 'equitas:5678'), false);
  eq('Plus takes any', P.takesAccount({ ...L, access: 'plus' }, 'equitas:5678'), true);
}

// ── Moving between plans ──
{
  const today = '2026-11-28';
  const cur = (plan, cycle, memberSince = '2025-06-01') => ({ plan, cycle, memberSince });
  const t = (plan, cycle) => ({ plan, cycle });
  eq('no plan: start one', P.changeOf(null, t('plus', 'yearly'), today), { kind: 'start' });
  eq('the same plan', P.changeOf(cur('plus', 'yearly'), t('plus', 'yearly'), today), { kind: 'same' });
  eq('Essential to Plus, same period: now, the difference charged', P.changeOf(cur('essential', 'monthly'), t('plus', 'monthly'), today), { kind: 'upgrade-now', replacement: 'CHARGE_PRORATED_PRICE' });
  eq('monthly to yearly: now at the yearly price, unused time added', P.changeOf(cur('essential', 'monthly'), t('essential', 'yearly'), today), { kind: 'switch-now', replacement: 'CHARGE_FULL_PRICE' });
  eq('Essential monthly to Plus yearly: now, full price', P.changeOf(cur('essential', 'monthly'), t('plus', 'yearly'), today), { kind: 'switch-now', replacement: 'CHARGE_FULL_PRICE' });
  eq('Essential yearly to Plus monthly: Plus now', P.changeOf(cur('essential', 'yearly'), t('plus', 'monthly'), today), { kind: 'switch-now', replacement: 'CHARGE_FULL_PRICE' });
  eq('yearly to monthly: at the renewal', P.changeOf(cur('plus', 'yearly'), t('plus', 'monthly'), today), { kind: 'at-renewal', replacement: 'DEFERRED' });
  eq('Plus to Essential after the first year: at the renewal', P.changeOf(cur('plus', 'monthly', '2025-06-01'), t('essential', 'monthly'), today), { kind: 'at-renewal', replacement: 'DEFERRED' });
  eq('Plus to Essential within the first year: not yet, and when', P.changeOf(cur('plus', 'monthly', '2026-03-31'), t('essential', 'yearly'), today), { kind: 'not-yet', opensOn: '2027-03-31' });
  eq('…on the anniversary itself it opens', P.changeOf(cur('plus', 'monthly', '2025-11-28'), t('essential', 'monthly'), today).kind, 'at-renewal');
  eq('months added keep the day where the month has it', [P.addMonths('2026-01-31', 1), P.addMonths('2024-01-31', 1), P.addMonths('2026-11-28', 12), P.addMonths('2026-03-15', -3)], ['2026-02-28', '2024-02-29', '2027-11-28', '2025-12-15']);
  eq('a year against twelve months: Essential 23%, Plus 24%', [P.yearlySaving('essential'), P.yearlySaving('plus')], [23, 24]);
}

// ── Play ids ──
{
  eq('base plans', ['essential', 'plus'].flatMap(p => ['monthly', 'yearly'].map(c => P.basePlanId(p, c))), ['essential-monthly', 'essential-yearly', 'plus-monthly', 'plus-yearly']);
  eq('base plan back to plan and period', [P.planOfBasePlan('plus-yearly'), P.planOfBasePlan('premium-monthly'), P.planOfBasePlan(null)], [{ plan: 'plus', cycle: 'yearly' }, null, null]);
  eq('products', P.PLAY_PRODUCTS, { essential: 'essential', plus: 'plus' });
  for (const id of ['essential-monthly', 'plus-yearly', P.FREE_MONTH_OFFER]) {
    eq(`Play accepts the id ${id}`, /^[a-z0-9][a-z0-9-]{0,62}$/.test(id), true);
  }
}

// ── The same terms as the website ──
{
  const site = Object.fromEntries(P.SITE_PLANS.map(p => [p.id, p]));
  eq('prices as on wall-ette.com', P.PRICES, { essential: { monthly: site.essential.monthly, yearly: site.essential.yearly }, plus: { monthly: site.plus.monthly, yearly: site.plus.yearly } });
  eq('the free month', [P.TRIAL_DAYS, P.TRIAL_DAYS], [site.essential.trialDays, site.plus.trialDays]);
  eq('moving down opens after the same months', P.MOVE_DOWN_AFTER_MONTHS, P.SITE_RULES.downgradeAfterMonths);
  eq('referral reward', P.REFERRAL_REWARD_MONTHS, P.SITE_REFERRAL.freeMonths);
  eq('student age and recheck', [P.STUDENT_MIN_AGE, P.STUDENT_RECHECK_MONTHS], [P.SITE_STUDENT.minimumAge, P.SITE_STUDENT.verificationIntervalMonths]);
}

// ── …and the server's copy ──
{
  const server = join(root, 'functions', 'src', 'plans.ts');
  if (existsSync(server)) {
    const text = readFileSync(server, 'utf8');
    const grab = re => (re.exec(text) ?? [])[1];
    eq('server: products', [grab(/essential:\s*'([^']+)'/), grab(/plus:\s*'([^']+)'/)], [P.PLAY_PRODUCTS.essential, P.PLAY_PRODUCTS.plus]);
    eq('server: free-month offer', grab(/FREE_MONTH_OFFER\s*=\s*'([^']+)'/), P.FREE_MONTH_OFFER);
    eq('server: referral reward, gift and recheck months', [Number(grab(/REFERRAL_REWARD_MONTHS\s*=\s*(\d+)/)), Number(grab(/GIFT_MONTHS\s*=\s*(\d+)/)), Number(grab(/STUDENT_RECHECK_MONTHS\s*=\s*(\d+)/))], [P.REFERRAL_REWARD_MONTHS, P.GIFT_MONTHS, P.STUDENT_RECHECK_MONTHS]);
    eq('server: referral window and code alphabet', [Number(grab(/REFERRAL_WINDOW_DAYS\s*=\s*(\d+)/)), grab(/CODE_ALPHABET\s*=\s*'([^']+)'/)], [P.REFERRAL_WINDOW_DAYS, P.CODE_ALPHABET]);
  } else {
    eq('the server keeps a copy of the plan constants (functions/src/plans.ts)', false, true);
  }
}

// ── Codes ──
{
  eq('typed loosely, read strictly', P.normalizeCode(' w7kq-2m9p '), 'W7KQ2M9P');
  eq('shown in fours', [P.showCode('W7KQ2M9P'), P.showCode('w7kq2m9pxz')], ['W7KQ-2M9P', 'W7KQ-2M9P-XZ']);
  eq('looks like a code', [P.looksLikeCode('W7KQ-2M9P'), P.looksLikeCode('ABC'), P.looksLikeCode('W0KQ-2M9P'), P.looksLikeCode('hello world!')], [true, false, false, false]);
}

console.log(failures ? `\n${failures} of ${checks} plan checks failed` : `\nAll ${checks} plan checks passed`);
process.exit(failures ? 1 : 0);
