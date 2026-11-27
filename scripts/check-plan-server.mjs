#!/usr/bin/env node
/**
 * The paid plans' server logic, without Google or Firestore
 * (functions/src/entitlement.ts, grants.ts, codes.ts):
 *   - a Play subscription becomes a `play` grant: which plan, open or not,
 *     the free month, a move down waiting for renewal, and the membership's
 *     start through renewals and upgrades but not restarts
 *   - grants combine into the one plan the app reads: Plus over Essential,
 *     the longer one, the start from what's paid for
 *   - gifts and student access run from now or from when the last one ends,
 *     never past the course
 *   - codes: invite codes for new members only, gifts and student codes
 *     used once, student codes for adults on a running course
 *   - referral rewards: after the friend's first paid month, to Play or as a grant
 *
 * Usage: node scripts/check-plan-server.mjs
 */
import { build } from 'esbuild'; // installed with Vite
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tmp = mkdtempSync(join(tmpdir(), 'wallette-plan-server-'));
const entry = join(tmp, 'entry.ts');
const src = f => JSON.stringify(join(root, 'functions', 'src', f));
writeFileSync(entry, [
  `export * from ${src('entitlement.ts')};`,
  `export * from ${src('grants.ts')};`,
  `export * from ${src('codes.ts')};`,
  `export { addMonths } from ${src('plans.ts')};`,
].join('\n'));
const bundle = join(tmp, 'server.mjs');
// The functions' sources import './x.js'; esbuild finds the .ts beside it.
await build({ entryPoints: [entry], outfile: bundle, bundle: true, platform: 'node', format: 'esm', logLevel: 'error', resolveExtensions: ['.ts', '.js'],
  plugins: [{ name: 'js-to-ts', setup(b) { b.onResolve({ filter: /^\.\/.*\.js$/ }, a => ({ path: join(a.resolveDir, a.path.replace(/\.js$/, '.ts')) })); } }] });
const S = await import(pathToFileURL(bundle).href);
rmSync(tmp, { recursive: true, force: true });

let failures = 0;
let checks = 0;
const eq = (label, actual, expected) => {
  checks++;
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a !== e) { failures++; console.log(`  FAIL ${label}: got ${a}, expected ${e}`); }
};
const at = s => new Date(`${s}T12:00:00Z`);
const iso = s => new Date(`${s}T12:00:00Z`).toISOString();

// ── Play → grant ──
const sub = (over = {}) => ({
  subscriptionState: 'SUBSCRIPTION_STATE_ACTIVE',
  acknowledgementState: 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED',
  startTime: iso('2026-01-10'),
  lineItems: [{ productId: 'plus', expiryTime: iso('2026-12-10'), autoRenewingPlan: { autoRenewEnabled: true }, offerDetails: { basePlanId: 'plus-monthly' } }],
  ...over,
});
{
  const now = at('2026-11-28');
  const g = S.playGrantOf(sub(), now);
  eq('an active Plus subscription', [g.plan, g.cycle, g.open, g.state, g.trial, g.autoRenewing, g.startedAt], ['plus', 'monthly', true, 'active', false, true, iso('2026-01-10')]);
  eq('first paid day: when first seen paid', g.firstPaidAt, now.toISOString());
  const trial = S.playGrantOf(sub({ lineItems: [{ productId: 'essential', expiryTime: iso('2026-12-20'), offerDetails: { basePlanId: 'essential-yearly', offerId: 'free-month' }, offerPhase: { freeTrial: {} } }] }), now);
  eq('in the free month: open, not paid yet', [trial.plan, trial.cycle, trial.trial, trial.open, trial.firstPaidAt], ['essential', 'yearly', true, true, null]);
  eq('in grace: still open', S.playGrantOf(sub({ subscriptionState: 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD' }), now).open, true);
  eq('cancelled with paid time left: open until it ends', S.playGrantOf(sub({ subscriptionState: 'SUBSCRIPTION_STATE_CANCELED' }), now).open, true);
  eq('cancelled and past its end: closed', S.playGrantOf(sub({ subscriptionState: 'SUBSCRIPTION_STATE_CANCELED' }), at('2026-12-11')).open, false);
  eq('on hold, paused, pending, expired: closed', ['ON_HOLD', 'PAUSED', 'PENDING', 'EXPIRED'].map(s => S.playGrantOf(sub({ subscriptionState: `SUBSCRIPTION_STATE_${s}` }), now).open), [false, false, false, false]);
  eq('a purchase of neither plan', S.playGrantOf(sub({ lineItems: [{ productId: 'premium', expiryTime: iso('2026-12-10') }] }), now), null);
  const moving = S.playGrantOf(sub({ lineItems: [{ productId: 'plus', expiryTime: iso('2026-12-10'), offerDetails: { basePlanId: 'plus-yearly' }, deferredItemReplacement: { productId: 'essential' } }] }), now);
  eq('a move down waiting for the renewal', moving.pendingChange, { plan: 'essential', cycle: null });
  const before = { ...g, startedAt: iso('2025-03-01'), firstPaidAt: iso('2025-04-01') };
  const upgraded = S.playGrantOf(sub({ startTime: iso('2026-11-28'), linkedPurchaseToken: 'old' }), now, before);
  eq('an upgrade keeps the membership\'s start and first paid day', [upgraded.startedAt, upgraded.firstPaidAt], [iso('2025-03-01'), iso('2025-04-01')]);
  const restarted = S.playGrantOf(sub({ startTime: iso('2026-11-28') }), now, null);
  eq('a restart is month one again', restarted.startedAt, iso('2026-11-28'));
  eq('a licence tester\'s purchase', S.playGrantOf(sub({ testPurchase: {} }), now).test, true);
  eq('the latest line item wins', S.playGrantOf(sub({ lineItems: [
    { productId: 'essential', expiryTime: iso('2026-11-30'), offerDetails: { basePlanId: 'essential-monthly' } },
    { productId: 'plus', expiryTime: iso('2026-12-30'), offerDetails: { basePlanId: 'plus-monthly' } },
  ] }), now).plan, 'plus');
  eq('acknowledging: only an active or grace purchase still pending', [
    S.needsAcknowledging(sub({ acknowledgementState: 'ACKNOWLEDGEMENT_STATE_PENDING' })),
    S.needsAcknowledging(sub({ acknowledgementState: 'ACKNOWLEDGEMENT_STATE_PENDING', subscriptionState: 'SUBSCRIPTION_STATE_PENDING' })),
    S.needsAcknowledging(sub()),
  ], [true, false, false]);
  eq('the product to acknowledge or defer', S.productOf(sub()), 'plus');
  eq('a purchase made for this member', S.ownership(sub({ externalAccountIdentifiers: { obfuscatedExternalAccountId: S.accountIdOf('u1') } }), 'u1', null), 'ok');
  eq('…for another account', S.ownership(sub({ externalAccountIdentifiers: { obfuscatedExternalAccountId: S.accountIdOf('u2') } }), 'u1', null), 'other-account');
  eq('…claimed by someone else', S.ownership(sub(), 'u1', 'u2'), 'other-user');
  eq('account id: 64 hex characters, never the uid', [S.accountIdOf('u1').length, /^[0-9a-f]+$/.test(S.accountIdOf('u1')), S.accountIdOf('u1').includes('u1')], [64, true, false]);
}

// ── Grants → one plan ──
const grant = (source, plan, over = {}) => ({
  source, plan, cycle: null, open: true, state: 'active', expiresAt: iso('2026-12-31'), trial: false, autoRenewing: false,
  startedAt: iso('2026-06-01'), pendingChange: null, test: false, ...over,
});
{
  const now = at('2026-11-28');
  eq('nothing: no plan', S.summarize([], now).plan, null);
  eq('Plus wins over Essential', S.summarize([grant('play', 'essential'), grant('gift', 'plus')], now).plan, 'plus');
  eq('the same plan: the longer one', S.summarize([grant('gift', 'essential', { expiresAt: iso('2027-01-31') }), grant('student', 'essential', { expiresAt: iso('2027-06-30') })], now).source, 'student');
  eq('membership start comes from what\'s paid for', S.summarize([grant('play', 'essential', { startedAt: iso('2025-01-05') }), grant('gift', 'plus', { startedAt: iso('2026-11-01') })], now).memberSince, iso('2025-01-05'));
  eq('a gift that ended doesn\'t count', S.summarize([grant('gift', 'plus', { expiresAt: iso('2026-11-01') })], now), {
    plan: null, cycle: null, source: null, state: 'expired', expiresAt: iso('2026-11-01'), trial: false, autoRenewing: false, memberSince: null, pendingChange: null, test: false,
  });
  eq('Play counts by its state, not the clock', S.summarize([grant('play', 'plus', { open: false, state: 'on-hold', expiresAt: iso('2027-01-01') })], now).plan, null);
  eq('a payment still pending says so', S.summarize([grant('play', 'plus', { open: false, state: 'pending' })], now).state, 'pending');

  const gift = S.extendedGrant('gift', 'plus', 12, null, now);
  eq('a gift runs 12 months from now', [gift.expiresAt, gift.startedAt], [at('2027-11-28').toISOString(), now.toISOString()]);
  const second = S.extendedGrant('gift', 'plus', 12, gift, at('2027-01-15'));
  eq('a second gift adds on after the first ends', second.expiresAt, at('2028-11-28').toISOString());
  const student = S.extendedGrant('student', 'essential', 12, null, now, new Date('2027-05-31T23:59:59Z'));
  eq('student access never runs past the course', student.expiresAt, new Date('2027-05-31T23:59:59Z').toISOString());
  const longCourse = S.extendedGrant('student', 'essential', 12, null, now, new Date('2029-05-31T23:59:59Z'));
  eq('…and is checked again after 12 months', longCourse.expiresAt, at('2027-11-28').toISOString());

  const paid = [grant('play', 'essential', { firstPaidAt: iso('2026-10-20') })];
  eq('ever paid: a Play membership past its free month', [S.everPaid(paid), S.everPaid([grant('play', 'essential', { firstPaidAt: null })]), S.everPaid([grant('gift', 'plus')])], [true, false, false]);
  eq('first paid month done after 30 days', [S.firstPaidMonthDone(paid, at('2026-11-18'), 30), S.firstPaidMonthDone(paid, at('2026-11-20'), 30)], [false, true]);
  eq('…but not if the membership has ended', S.firstPaidMonthDone([grant('play', 'essential', { firstPaidAt: iso('2026-09-01'), open: false, state: 'expired' })], now, 30), false);
  eq('a reward goes to a renewing Play subscription', S.rewardRoute([grant('play', 'plus', { autoRenewing: true })], now), { kind: 'play' });
  eq('…otherwise a month of the current plan', S.rewardRoute([grant('gift', 'plus')], now), { kind: 'grant', plan: 'plus' });
  eq('…or of Essential with none', S.rewardRoute([], now), { kind: 'grant', plan: 'essential' });
}

// ── Codes ──
{
  const now = at('2026-11-28');
  const ctx = (over = {}) => ({ uid: 'friend', now, joinedAt: at('2026-11-20'), referred: false, everPaid: false, adult: true, ...over });
  const referral = { kind: 'referral', owner: 'member' };
  eq('a new member uses a friend\'s invite code', S.checkRedeem(referral, ctx()), { ok: true });
  eq('…not their own', S.checkRedeem(referral, ctx({ uid: 'member' })), { ok: false, reason: 'own-code' });
  eq('…not a second one', S.checkRedeem(referral, ctx({ referred: true })), { ok: false, reason: 'already-referred' });
  eq('…not after 30 days', S.checkRedeem(referral, ctx({ joinedAt: at('2026-10-20') })), { ok: false, reason: 'not-new' });
  eq('…not after paying', S.checkRedeem(referral, ctx({ everPaid: true })), { ok: false, reason: 'not-new' });
  const gift = { kind: 'gift', plan: 'plus', months: 12 };
  eq('a gift code once', [S.checkRedeem(gift, ctx()), S.checkRedeem({ ...gift, usedBy: 'x' }, ctx())], [{ ok: true }, { ok: false, reason: 'used' }]);
  eq('an expired code', S.checkRedeem({ ...gift, expiresAt: iso('2026-11-01') }, ctx()), { ok: false, reason: 'expired' });
  const inst = { kind: 'institution', institution: 'Made-up College', courseEnd: '2027-05-31' };
  eq('a student code: adults on a running course', [S.checkRedeem(inst, ctx()), S.checkRedeem(inst, ctx({ adult: false })), S.checkRedeem({ ...inst, courseEnd: '2026-05-31' }, ctx())], [{ ok: true }, { ok: false, reason: 'not-adult' }, { ok: false, reason: 'course-ended' }]);
  eq('an unknown code', S.checkRedeem(null, ctx()), { ok: false, reason: 'not-found' });
  eq('every refusal has words', Object.keys(S.REFUSALS).sort(), ['already-referred', 'course-ended', 'expired', 'malformed', 'not-adult', 'not-found', 'not-new', 'own-code', 'used']);
  let i = 0;
  const code = S.newCode(8, n => (i++ * 7) % n);
  eq('codes use only the clear alphabet', [code.length, /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]+$/.test(code)], [8, true]);
  eq('codes typed loosely', S.normalizeCode(' w7kq-2m9p '), 'W7KQ2M9P');
  eq('a course end: a real day, ahead, within six years', ['2027-05-31', '2027-02-30', '2026-01-01', '2035-01-01', 'soon'].map(d => S.validCourseEnd(d, now)), [true, false, false, false, false]);
  eq('institution email addresses', ['a@iitb.ac.in', 'b@du.edu.in', 'c@mit.edu', 'd@gmail.com', 'e@college.org', 'not an email'].map(e => S.institutionEmail(e)), [true, true, true, false, false, false]);
  eq('…and domains added in config/students', S.institutionEmail('e@student.college.org', ['college.org']), true);
}

console.log(failures ? `\n${failures} of ${checks} plan server checks failed` : `\nAll ${checks} plan server checks passed`);
process.exit(failures ? 1 : 0);
