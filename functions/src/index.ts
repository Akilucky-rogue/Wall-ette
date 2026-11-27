/**
 * Wall-ette's paid plans on the server (docs/PLAN_1.6.0.md): Essential and
 * Plus, and Spread (referrals, gifts, student access).
 *
 * A member's plan can come from several places, each a grant in
 * entitlements/{uid}/grants/{source}: Google Play, a gift, student access,
 * a referral reward, an early-member grant. entitlements/{uid} is their
 * summary (grants.ts), the one document the app reads. Only these functions
 * and scripts/plans-admin.mjs write them; the Firestore rules let a member
 * read their own and nothing else.
 *
 * - verifyPlayPurchase, refreshPlan, playNotifications: Google Play
 *   subscriptions, checked with Play, acknowledged, recorded.
 * - myInviteCode, redeemCode: a member's invite code; redeeming a friend's
 *   invite code, a gift code or an institution's student code.
 * - studentEmailStart, studentEmailConfirm, studentReview: student access
 *   by an institution email address (sent through the Trigger Email
 *   extension's `mail` collection once config/students.emailChecks is on),
 *   or by asking for a review.
 * - referralRewards (daily): a month for both people once the friend's
 *   first paid month is done.
 * - forgetPlan: deleting the account (users/{uid}) removes all of it.
 *
 * Nothing here runs for members until config/app.plansLive is true.
 * Play is reached as the functions' service account, which needs access in
 * Play Console (Users and permissions).
 */
import { createHash, randomInt } from 'node:crypto';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore, type DocumentReference, type Transaction } from 'firebase-admin/firestore';
import { onDocumentDeleted } from 'firebase-functions/firestore';
import { HttpsError, onCall } from 'firebase-functions/https';
import * as logger from 'firebase-functions/logger';
import { setGlobalOptions } from 'firebase-functions/options';
import { onMessagePublished } from 'firebase-functions/pubsub';
import { onSchedule } from 'firebase-functions/scheduler';
import { androidpublisher, auth as googleAuth } from '@googleapis/androidpublisher';
import {
  needsAcknowledging, ownership, playGrantOf, productOf, tokenKey,
  type Grant, type PlaySubscription,
} from './entitlement.js';
import { everPaid, extendedGrant, firstPaidMonthDone, rewardRoute, summarize, type Summary } from './grants.js';
import {
  checkRedeem, courseEndsAt, institutionEmail, newCode, normalizeCode, REFUSALS, validCourseEnd,
  REFERRAL_CODE_LENGTH, type CodeDoc,
} from './codes.js';
import {
  addMonths, DAY_MS, FIRST_PAID_MONTH_DAYS, isPlayProduct, REFERRAL_REWARD_MONTHS, STUDENT_RECHECK_MONTHS,
} from './plans.js';

const PACKAGE = 'com.wallette.app';

setGlobalOptions({ region: 'asia-south1', maxInstances: 5 });
initializeApp();
const db = getFirestore();

const play = androidpublisher({
  version: 'v3',
  auth: new googleAuth.GoogleAuth({ scopes: ['https://www.googleapis.com/auth/androidpublisher'] }),
});

const now = (): Date => new Date();
const sha256 = (s: string): string => createHash('sha256').update(s, 'utf8').digest('hex');
const summaryRef = (uid: string): DocumentReference => db.doc(`entitlements/${uid}`);
const grantRef = (uid: string, source: Grant['source']): DocumentReference => db.doc(`entitlements/${uid}/grants/${source}`);
const grantsCol = (uid: string) => db.collection(`entitlements/${uid}/grants`);

function signedIn(request: { auth?: { uid: string } }): string {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in first.');
  return uid;
}

/** config/app.plansLive: paid plans and Spread are switched on. */
async function plansLive(): Promise<boolean> {
  return (await db.doc('config/app').get()).get('plansLive') === true;
}
async function requireLive(): Promise<void> {
  if (!(await plansLive())) throw new HttpsError('failed-precondition', 'Paid plans open soon. Everything stays free until then.');
}

/** Reads every grant in a transaction and writes their summary with `changed` applied. */
async function saveGrants(tx: Transaction, uid: string, others: Grant[], changed: Grant | null): Promise<Summary> {
  const grants = changed ? [...others.filter(g => g.source !== changed.source), changed] : others;
  const summary = summarize(grants, now());
  tx.set(summaryRef(uid), { ...summary, updatedAt: FieldValue.serverTimestamp() });
  return summary;
}

// ── Google Play ──────────────────────────────────────────────────────────────

async function readSubscription(token: string): Promise<PlaySubscription & { etag?: string | null }> {
  const res = await play.purchases.subscriptionsv2.get({ packageName: PACKAGE, token });
  return res.data as PlaySubscription;
}

async function acknowledge(token: string, sub: PlaySubscription): Promise<void> {
  const product = productOf(sub);
  if (!product) return;
  await play.purchases.subscriptions.acknowledge({ packageName: PACKAGE, subscriptionId: product, token, requestBody: {} });
}

type Source = 'claim' | 'refresh' | 'notification';

/**
 * Records what Play says about `token` as its owner's `play` grant, in one
 * transaction with the ownership check. A notification about an older
 * subscription never takes the plan away from a newer one.
 */
async function recordPlay(uid: string, token: string, sub: PlaySubscription, source: Source): Promise<Summary> {
  const key = tokenKey(token);
  const tokenRef = db.doc(`playTokens/${key}`);
  return db.runTransaction(async tx => {
    const [claimed, grantsSnap] = await Promise.all([tx.get(tokenRef), tx.get(grantsCol(uid))]);
    if (ownership(sub, uid, (claimed.get('uid') as string | undefined) ?? null) !== 'ok') {
      throw new HttpsError('permission-denied', 'This purchase belongs to another Wall-ette account.');
    }
    const grants = grantsSnap.docs.map(d => d.data() as Grant & { tokenKey?: string });
    const before = grants.find(g => g.source === 'play') ?? null;
    const linked = sub.linkedPurchaseToken ? tokenKey(sub.linkedPurchaseToken) : null;
    const sameMembership = before && (before.tokenKey === key || (linked !== null && before.tokenKey === linked)) ? before : null;
    const grant = playGrantOf(sub, now(), sameMembership);
    const others = grants.filter(g => g.source !== 'play');
    if (source === 'notification' && before && !sameMembership && before.open && !grant?.open) {
      return summarize(grants, now());
    }
    tx.set(tokenRef, { uid, token, productId: productOf(sub), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    if (linked) tx.set(db.doc(`playTokens/${linked}`), { supersededBy: key }, { merge: true });
    if (!grant) return saveGrants(tx, uid, others, null);
    tx.set(grantRef(uid, 'play'), { ...grant, tokenKey: key, updatedAt: FieldValue.serverTimestamp() });
    return saveGrants(tx, uid, others, grant);
  });
}

export const verifyPlayPurchase = onCall(async request => {
  const uid = signedIn(request);
  const { purchaseToken, productId } = (request.data ?? {}) as { purchaseToken?: unknown; productId?: unknown };
  if (typeof purchaseToken !== 'string' || purchaseToken.length < 10 || purchaseToken.length > 4096) {
    throw new HttpsError('invalid-argument', 'There is no purchase to check.');
  }
  if (!isPlayProduct(productId)) throw new HttpsError('invalid-argument', 'That is not a Wall-ette subscription.');

  let sub: PlaySubscription;
  try {
    sub = await readSubscription(purchaseToken);
  } catch (e) {
    logger.warn('Play could not find a purchase token', { uid, error: String(e) });
    throw new HttpsError('not-found', "Google Play doesn't know this purchase.");
  }
  // Fail before acknowledging: a purchase that isn't this user's is never kept.
  const claimed = await db.doc(`playTokens/${tokenKey(purchaseToken)}`).get();
  if (ownership(sub, uid, (claimed.get('uid') as string | undefined) ?? null) !== 'ok') {
    throw new HttpsError('permission-denied', 'This purchase belongs to another Wall-ette account.');
  }
  if (needsAcknowledging(sub)) await acknowledge(purchaseToken, sub);
  return recordPlay(uid, purchaseToken, sub, 'claim');
});

/** Asks Play again about the member's subscription (the app found its end date passed). */
export const refreshPlan = onCall(async request => {
  const uid = signedIn(request);
  const grant = await grantRef(uid, 'play').get();
  const key = grant.get('tokenKey') as string | undefined;
  if (!key) return null;
  const saved = await db.doc(`playTokens/${key}`).get();
  const token = saved.get('token') as string | undefined;
  if (!token || saved.get('uid') !== uid) return null;
  const sub = await readSubscription(token);
  if (needsAcknowledging(sub)) await acknowledge(token, sub);
  return recordPlay(uid, token, sub, 'refresh');
});

interface PlayNotification {
  packageName?: string;
  subscriptionNotification?: { purchaseToken?: string; subscriptionId?: string; notificationType?: number };
  voidedPurchaseNotification?: { purchaseToken?: string };
  testNotification?: unknown;
}

export const playNotifications = onMessagePublished('play-billing', async event => {
  let msg: PlayNotification;
  try {
    msg = event.data.message.json as PlayNotification;
  } catch {
    logger.warn('A Play notification that is not JSON');
    return;
  }
  if (msg.testNotification) {
    logger.info('Play test notification received');
    return;
  }
  if (msg.packageName !== PACKAGE) return;
  const token = msg.subscriptionNotification?.purchaseToken ?? msg.voidedPurchaseNotification?.purchaseToken;
  if (!token) return;
  const owner = await db.doc(`playTokens/${tokenKey(token)}`).get();
  const uid = owner.get('uid') as string | undefined;
  // Not claimed yet: the app sends it to verifyPlayPurchase right after buying.
  if (!uid) return;
  const sub = await readSubscription(token);
  if (needsAcknowledging(sub)) await acknowledge(token, sub);
  await recordPlay(uid, token, sub, 'notification');
});

// ── Invite codes and redeeming codes ─────────────────────────────────────────

/** The member's own invite code, made the first time they ask. */
export const myInviteCode = onCall(async request => {
  const uid = signedIn(request);
  await requireLive();
  const ref = db.doc(`referrals/${uid}`);
  const existing = (await ref.get()).get('code') as string | undefined;
  if (existing) return { code: existing };
  for (let attempt = 0; attempt < 6; attempt++) {
    const code = newCode(REFERRAL_CODE_LENGTH, n => randomInt(n));
    const made = await db.runTransaction(async tx => {
      const [taken, mine] = await Promise.all([tx.get(db.doc(`codes/${code}`)), tx.get(ref)]);
      const already = mine.get('code') as string | undefined;
      if (already) return already;
      if (taken.exists) return null;
      tx.set(db.doc(`codes/${code}`), { kind: 'referral', owner: uid, createdAt: FieldValue.serverTimestamp() });
      tx.set(ref, { code }, { merge: true });
      return code;
    });
    if (made) return { code: made };
  }
  throw new HttpsError('unavailable', "Couldn't make your code just now. Try again.");
});

export const redeemCode = onCall(async request => {
  const uid = signedIn(request);
  await requireLive();
  const { code: raw, adult } = (request.data ?? {}) as { code?: unknown; adult?: unknown };
  const code = typeof raw === 'string' ? normalizeCode(raw) : '';
  if (code.length < 6 || code.length > 16) return { ok: false, message: REFUSALS['not-found'] };
  const user = await getAuth().getUser(uid);
  const joinedAt = new Date(user.metadata.creationTime);

  return db.runTransaction(async tx => {
    const codeRef = db.doc(`codes/${code}`);
    const referralRef = db.doc(`referrals/${uid}`);
    const [codeSnap, referralSnap, grantsSnap] = await Promise.all([tx.get(codeRef), tx.get(referralRef), tx.get(grantsCol(uid))]);
    const doc = codeSnap.exists ? (codeSnap.data() as CodeDoc) : null;
    const grants = grantsSnap.docs.map(d => d.data() as Grant);
    const at = now();
    const check = checkRedeem(doc, {
      uid, now: at, joinedAt, referred: referralSnap.get('joinedWith') !== undefined, everPaid: everPaid(grants), adult: adult === true,
    });
    if (!check.ok || !doc) return { ok: false, message: REFUSALS[check.ok ? 'not-found' : check.reason] };

    if (doc.kind === 'referral') {
      tx.set(referralRef, { joinedWith: { by: doc.owner, code, at: at.toISOString(), state: 'waiting' } }, { merge: true });
      return {
        ok: true, kind: 'referral',
        message: "Invite code saved. You and your friend each get a month of your plan once your first paid month is done.",
      };
    }
    const grant = doc.kind === 'gift'
      ? extendedGrant('gift', doc.plan!, doc.months!, grants.find(g => g.source === 'gift') ?? null, at)
      : extendedGrant('student', 'essential', STUDENT_RECHECK_MONTHS, null, at, courseEndsAt(doc.courseEnd!));
    tx.set(grantRef(uid, grant.source), { ...grant, code, ...(doc.institution ? { institution: doc.institution } : {}), updatedAt: FieldValue.serverTimestamp() });
    tx.update(codeRef, { usedBy: uid, usedAt: at.toISOString() });
    const summary = await saveGrants(tx, uid, grants, grant);
    return { ok: true, kind: doc.kind, plan: grant.plan, until: grant.expiresAt, summary };
  });
});

// ── Student access by email or review ────────────────────────────────────────

const STUDENT_CODE_MINUTES = 15;
const STUDENT_CODE_TRIES = 5;

export const studentEmailStart = onCall(async request => {
  const uid = signedIn(request);
  await requireLive();
  const { email, courseEnd, adult } = (request.data ?? {}) as { email?: unknown; courseEnd?: unknown; adult?: unknown };
  const settings = (await db.doc('config/students').get()).data() ?? {};
  if (settings.emailChecks !== true) {
    throw new HttpsError('failed-precondition', 'Checking by institution email opens soon. Use a code from your institution, or ask for a review.');
  }
  if (adult !== true) throw new HttpsError('invalid-argument', 'Student access is for people aged 18 or older.');
  const domains = Array.isArray(settings.domains) ? settings.domains.filter((d: unknown): d is string => typeof d === 'string') : [];
  if (!institutionEmail(email, domains)) throw new HttpsError('invalid-argument', "Use the email address your institution gave you (ending .ac.in, .edu.in or .edu).");
  const at = now();
  if (!validCourseEnd(courseEnd, at)) throw new HttpsError('invalid-argument', "Enter your course's last day, in the future.");

  const ref = db.doc(`studentChecks/${uid}`);
  const last = await ref.get();
  const sentAt = Date.parse((last.get('sentAt') as string | undefined) ?? '');
  if (Number.isFinite(sentAt) && at.getTime() - sentAt < 60_000) throw new HttpsError('resource-exhausted', 'A code was sent a moment ago. Wait a minute before asking again.');
  const sentToday = last.get('day') === at.toISOString().slice(0, 10) ? Number(last.get('sentToday') ?? 0) : 0;
  if (sentToday >= 5) throw new HttpsError('resource-exhausted', 'That is enough codes for today. Try again tomorrow.');

  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  const address = (email as string).trim().toLowerCase();
  await ref.set({
    emailHash: sha256(address), codeHash: sha256(`${uid}:${code}`), courseEnd,
    expiresAt: new Date(at.getTime() + STUDENT_CODE_MINUTES * 60_000).toISOString(),
    tries: 0, sentAt: at.toISOString(), day: at.toISOString().slice(0, 10), sentToday: sentToday + 1,
  });
  // The Trigger Email extension sends what lands in `mail`.
  await db.collection('mail').add({
    to: address,
    message: {
      subject: 'Your Wall·ette student code',
      text: `Your code is ${code}. It works for ${STUDENT_CODE_MINUTES} minutes.\n\nIf you didn't ask for it, ignore this email.\n\nWall·ette`,
    },
  });
  return { sent: true, minutes: STUDENT_CODE_MINUTES };
});

export const studentEmailConfirm = onCall(async request => {
  const uid = signedIn(request);
  await requireLive();
  const { code } = (request.data ?? {}) as { code?: unknown };
  if (typeof code !== 'string' || !/^\d{6}$/.test(code.trim())) throw new HttpsError('invalid-argument', 'Enter the 6-digit code from the email.');
  const ref = db.doc(`studentChecks/${uid}`);
  return db.runTransaction(async tx => {
    const check = await tx.get(ref);
    if (!check.exists) throw new HttpsError('not-found', 'Ask for a new code first.');
    const at = now();
    const tries = Number(check.get('tries') ?? 0);
    if (tries >= STUDENT_CODE_TRIES || Date.parse(check.get('expiresAt') as string) <= at.getTime()) {
      tx.delete(ref);
      throw new HttpsError('deadline-exceeded', 'That code has expired. Ask for a new one.');
    }
    if (check.get('codeHash') !== sha256(`${uid}:${code.trim()}`)) {
      tx.update(ref, { tries: tries + 1 });
      return { ok: false, message: "That code doesn't match. Check the email and try again." };
    }
    const emailRef = db.doc(`studentEmails/${check.get('emailHash') as string}`);
    const [usedBy, grantsSnap] = await Promise.all([tx.get(emailRef), tx.get(grantsCol(uid))]);
    if (usedBy.exists && usedBy.get('uid') !== uid) {
      tx.delete(ref);
      return { ok: false, message: 'That institution email is already used by another Wall-ette account.' };
    }
    const grant = extendedGrant('student', 'essential', STUDENT_RECHECK_MONTHS, null, at, courseEndsAt(check.get('courseEnd') as string));
    tx.set(emailRef, { uid, at: at.toISOString() });
    tx.set(grantRef(uid, 'student'), { ...grant, via: 'email', courseEnd: check.get('courseEnd'), updatedAt: FieldValue.serverTimestamp() });
    tx.delete(ref);
    const summary = await saveGrants(tx, uid, grantsSnap.docs.map(d => d.data() as Grant), grant);
    return { ok: true, plan: grant.plan, until: grant.expiresAt, summary };
  });
});

/** Asks for student access to be checked by a person (scripts/plans-admin.mjs approves). */
export const studentReview = onCall(async request => {
  const uid = signedIn(request);
  await requireLive();
  const { institution, course, courseEnd, adult } = (request.data ?? {}) as Record<string, unknown>;
  const text = (v: unknown, max: number) => (typeof v === 'string' && v.trim().length >= 2 && v.trim().length <= max ? v.trim() : null);
  const inst = text(institution, 120);
  const name = text(course, 120);
  if (!inst || !name) throw new HttpsError('invalid-argument', 'Name your institution and your course.');
  if (adult !== true) throw new HttpsError('invalid-argument', 'Student access is for people aged 18 or older.');
  if (!validCourseEnd(courseEnd, now())) throw new HttpsError('invalid-argument', "Enter your course's last day, in the future.");
  await db.doc(`studentRequests/${uid}`).set({ institution: inst, course: name, courseEnd, state: 'waiting', at: now().toISOString() });
  return { ok: true };
});

// ── Referral rewards ─────────────────────────────────────────────────────────

/** Adds a month to the member's plan: to their Play subscription, or as a reward grant. */
async function rewardMember(uid: string): Promise<void> {
  const grants = (await grantsCol(uid).get()).docs.map(d => d.data() as Grant & { tokenKey?: string });
  const route = rewardRoute(grants, now());
  if (route.kind === 'play') {
    const key = grants.find(g => g.source === 'play')?.tokenKey;
    const token = key ? ((await db.doc(`playTokens/${key}`).get()).get('token') as string | undefined) : undefined;
    if (token) {
      try {
        const sub = await readSubscription(token);
        const product = productOf(sub);
        const expiry = Date.parse((sub.lineItems ?? []).find(i => i.productId === product)?.expiryTime ?? '');
        if (product && Number.isFinite(expiry)) {
          // Play moves the next charge a month later.
          await play.purchases.subscriptions.defer({
            packageName: PACKAGE, subscriptionId: product, token,
            requestBody: { deferralInfo: {
              expectedExpiryTimeMillis: String(expiry),
              desiredExpiryTimeMillis: String(addMonths(new Date(expiry), REFERRAL_REWARD_MONTHS).getTime()),
            } },
          });
          await recordPlay(uid, token, await readSubscription(token), 'refresh');
          return;
        }
      } catch (e) {
        logger.warn('Play deferral failed; rewarding with a grant instead', { uid, error: String(e) });
      }
    }
  }
  const plan = route.kind === 'grant' ? route.plan : (grants.find(g => g.source === 'play')?.plan ?? 'essential');
  await db.runTransaction(async tx => {
    const fresh = (await tx.get(grantsCol(uid))).docs.map(d => d.data() as Grant);
    const grant = extendedGrant('reward', plan, REFERRAL_REWARD_MONTHS, fresh.find(g => g.source === 'reward') ?? null, now());
    tx.set(grantRef(uid, 'reward'), { ...grant, updatedAt: FieldValue.serverTimestamp() });
    await saveGrants(tx, uid, fresh, grant);
  });
}

/** Daily: both people get a month once the friend's first paid month is done. */
export const referralRewards = onSchedule({ schedule: 'every day 06:30', timeZone: 'Asia/Kolkata' }, async () => {
  if (!(await plansLive())) return;
  const waiting = await db.collection('referrals').where('joinedWith.state', '==', 'waiting').limit(200).get();
  for (const doc of waiting.docs) {
    const friend = doc.id;
    const by = doc.get('joinedWith.by') as string | undefined;
    const joined = Date.parse((doc.get('joinedWith.at') as string | undefined) ?? '');
    const grants = (await grantsCol(friend).get()).docs.map(d => d.data() as Grant);
    if (!by || !firstPaidMonthDone(grants, now(), FIRST_PAID_MONTH_DAYS)) {
      // Never became a paying member: the invite lapses after a year and a bit.
      if (!by || (Number.isFinite(joined) && now().getTime() - joined > 400 * DAY_MS)) await doc.ref.update({ 'joinedWith.state': 'lapsed' });
      continue;
    }
    try {
      await rewardMember(friend);
      await rewardMember(by);
      await doc.ref.update({ 'joinedWith.state': 'rewarded', 'joinedWith.rewardedAt': now().toISOString() });
      await db.doc(`referrals/${by}`).set({ rewarded: FieldValue.increment(1) }, { merge: true });
    } catch (e) {
      logger.error('Referral reward failed; tried again tomorrow', { friend, error: String(e) });
    }
  }
});

// ── Deleting the account ─────────────────────────────────────────────────────

export const forgetPlan = onDocumentDeleted('users/{uid}', async event => {
  const uid = event.params.uid;
  const [tokens, grants, ownCodes, studentEmails, usedCodes] = await Promise.all([
    db.collection('playTokens').where('uid', '==', uid).get(),
    grantsCol(uid).get(),
    db.collection('codes').where('owner', '==', uid).get(),
    db.collection('studentEmails').where('uid', '==', uid).get(),
    db.collection('codes').where('usedBy', '==', uid).get(),
  ]);
  const batch = db.batch();
  for (const d of [...tokens.docs, ...grants.docs, ...ownCodes.docs, ...studentEmails.docs]) batch.delete(d.ref);
  // A used gift or student code stays used, without saying by whom.
  for (const d of usedCodes.docs) batch.update(d.ref, { usedBy: 'deleted-account' });
  for (const path of [`entitlements/${uid}`, `referrals/${uid}`, `studentChecks/${uid}`, `studentRequests/${uid}`]) batch.delete(db.doc(path));
  await batch.commit();
});

