#!/usr/bin/env node
/**
 * Firestore rules for the paid plans (firestore.rules, PLANS): a member reads
 * their own plan, its grants and their invite record, and nobody else's;
 * nothing about a plan can be written from the app; codes, purchase tokens,
 * student checks and mail are server only.
 *
 * Needs the Firestore emulator:
 *   npx firebase emulators:exec --only firestore --project demo-wallette "node scripts/check-plan-rules.mjs"
 * Without FIRESTORE_EMULATOR_HOST it says so and passes nothing.
 */
const host = process.env.FIRESTORE_EMULATOR_HOST;
if (!host) {
  console.log('Firestore emulator not running: start this with firebase emulators:exec (see the top of the file).');
  process.exit(1);
}
const [hostname, port] = host.split(':');
const projectId = process.env.GCLOUD_PROJECT || 'demo-wallette';
const { initializeApp, deleteApp } = await import('firebase/app');
const F = await import('firebase/firestore');
F.setLogLevel('silent'); // the refusals below are on purpose

let failures = 0;
let checks = 0;
const eq = (label, actual, expected) => {
  checks++;
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a !== e) { failures++; console.log(`  FAIL ${label}: got ${a}, expected ${e}`); }
};
const allowed = async (label, p) => {
  try { await p; eq(label, 'allowed', 'allowed'); } catch (e) { eq(label, e?.code ?? e?.message, 'allowed'); }
};
const refused = async (label, p) => {
  try { await p; eq(`${label} (should be refused)`, 'allowed', 'permission-denied'); } catch (e) { eq(`${label} refused`, e?.code ?? e?.message, 'permission-denied'); }
};

// Seed as the emulator's owner, which the rules don't apply to.
const base = `http://${host}/v1/projects/${projectId}/databases/(default)/documents`;
const value = v => (typeof v === 'boolean' ? { booleanValue: v } : typeof v === 'number' ? { integerValue: String(v) } : v === null ? { nullValue: null } : { stringValue: String(v) });
const seed = async (path, fields) => {
  const res = await fetch(`${base}/${path}`, {
    method: 'PATCH', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, value(v)])) }),
  });
  if (!res.ok) throw new Error(`seed ${path}: ${res.status}`);
};
await fetch(`http://${host}/emulator/v1/projects/${projectId}/databases/(default)/documents`, { method: 'DELETE' });
await seed('config/app', { plansLive: false });
await seed('entitlements/u1', { plan: 'plus', source: 'gift' });
await seed('entitlements/u1/grants/gift', { plan: 'plus', open: true });
await seed('entitlements/u2', { plan: 'essential', source: 'play' });
await seed('referrals/u1', { code: 'W7KQ2M9P' });
await seed('codes/W7KQ2M9P', { kind: 'referral', owner: 'u1' });
await seed('playTokens/abc', { uid: 'u1' });
await seed('studentChecks/u1', { tries: 0 });

const client = (uid, name) => {
  const app = initializeApp({ projectId, apiKey: 'demo' }, name);
  const db = F.initializeFirestore(app, {});
  F.connectFirestoreEmulator(db, hostname, Number(port), { mockUserToken: { sub: uid, user_id: uid } });
  return { app, db };
};
const me = client('u1', 'me');
const doc = p => F.doc(me.db, p);
try {
  await allowed('a member reads config/app', F.getDoc(doc('config/app')));
  await allowed('a member reads their own plan', F.getDoc(doc('entitlements/u1')));
  await allowed('…and its grants', F.getDocs(F.collection(me.db, 'entitlements/u1/grants')));
  await allowed('…and their invite record', F.getDoc(doc('referrals/u1')));
  await refused('reading someone else\'s plan', F.getDoc(doc('entitlements/u2')));
  await refused('reading someone else\'s grants', F.getDocs(F.collection(me.db, 'entitlements/u2/grants')));
  await refused('reading someone else\'s invite record', F.getDoc(doc('referrals/u2')));
  await refused('listing every plan', F.getDocs(F.collection(me.db, 'entitlements')));
  await refused('giving yourself Plus', F.setDoc(doc('entitlements/u1'), { plan: 'plus', source: 'play' }));
  await refused('changing your own plan', F.updateDoc(doc('entitlements/u1'), { expiresAt: '2099-01-01T00:00:00Z' }));
  await refused('adding a grant', F.setDoc(doc('entitlements/u1/grants/early'), { plan: 'plus', open: true }));
  await refused('removing your plan', F.deleteDoc(doc('entitlements/u1')));
  await refused('writing your invite record', F.setDoc(doc('referrals/u1'), { joinedWith: { by: 'u3' } }, { merge: true }));
  await refused('reading a code', F.getDoc(doc('codes/W7KQ2M9P')));
  await refused('making a code', F.setDoc(doc('codes/FREEPLUS1'), { kind: 'gift', plan: 'plus', months: 120 }));
  await refused('reading purchase tokens', F.getDoc(doc('playTokens/abc')));
  await refused('reading your student check', F.getDoc(doc('studentChecks/u1')));
  await refused('sending mail', F.addDoc(F.collection(me.db, 'mail'), { to: 'anyone@example.com' }));
  await refused('switching paid plans on', F.updateDoc(doc('config/app'), { plansLive: true }));
} finally {
  await deleteApp(me.app);
}
console.log(failures ? `\n${failures} of ${checks} plan rules checks failed` : `\nAll ${checks} plan rules checks passed`);
process.exit(failures ? 1 : 0);
