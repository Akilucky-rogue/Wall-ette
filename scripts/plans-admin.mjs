#!/usr/bin/env node
/**
 * The owner's tool for the parts of Spread that a person confirms
 * (wall-ette.com/spread): gift codes once a gift order is paid, institution
 * code batches, approving a student review, an early-member grant at
 * launch, plan testers who see paid plans before config/app.plansLive is
 * on, and looking at a member's plan.
 *
 * Runs with a service account that can write Firestore:
 *   npm --prefix functions run build
 *   GOOGLE_APPLICATION_CREDENTIALS=<key.json> node scripts/plans-admin.mjs <command> [options]
 *
 *   gift-codes        --plan plus|essential --count N [--months 12] --batch <order id>
 *   institution-codes --institution "<name>" --course-end YYYY-MM-DD --count N --batch <id>
 *   approve-student   <uid> --course-end YYYY-MM-DD
 *   early             --plan plus|essential --until YYYY-MM-DD (--joined-before YYYY-MM-DD | --uids a,b,c) [--dry-run]
 *   tester            <email or uid> [--remove]
 *   show              <uid>
 *
 * Codes are printed once; the person delivers them. Nothing here charges anyone.
 */
import { createRequire } from 'node:module';
import { randomInt } from 'node:crypto';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const lib = join(root, 'functions', 'lib');
if (!existsSync(join(lib, 'grants.js'))) {
  console.error('Build the functions first: npm --prefix functions run build');
  process.exit(1);
}
const require = createRequire(join(root, 'functions', 'package.json'));
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
const { summarize, extendedGrant } = await import(pathToFileURL(join(lib, 'grants.js')).href);
const { newCode, courseEndsAt, validCourseEnd, GIFT_CODE_LENGTH } = await import(pathToFileURL(join(lib, 'codes.js')).href);
const { isPlanId, GIFT_MONTHS, STUDENT_RECHECK_MONTHS } = await import(pathToFileURL(join(lib, 'plans.js')).href);

const [command, ...rest] = process.argv.slice(2);
const opt = name => {
  const i = rest.indexOf(`--${name}`);
  return i >= 0 ? rest[i + 1] : undefined;
};
const flag = name => rest.includes(`--${name}`);
const positional = rest.find(a => !a.startsWith('--') && !rest.some((b, i) => b.startsWith('--') && rest[i + 1] === a));
const fail = msg => { console.error(msg); process.exit(1); };

initializeApp();
const db = getFirestore();
const now = new Date();

async function writeGrant(uid, grant, extra = {}) {
  await db.runTransaction(async tx => {
    const grantsCol = db.collection(`entitlements/${uid}/grants`);
    const others = (await tx.get(grantsCol)).docs.map(d => d.data()).filter(g => g.source !== grant.source);
    tx.set(grantsCol.doc(grant.source), { ...grant, ...extra, updatedAt: FieldValue.serverTimestamp() });
    tx.set(db.doc(`entitlements/${uid}`), { ...summarize([...others, grant], new Date()), updatedAt: FieldValue.serverTimestamp() });
  });
}

async function makeCodes(count, doc) {
  const made = [];
  while (made.length < count) {
    const code = newCode(GIFT_CODE_LENGTH, n => randomInt(n));
    const ref = db.doc(`codes/${code}`);
    const created = await db.runTransaction(async tx => {
      if ((await tx.get(ref)).exists) return false;
      tx.set(ref, { ...doc, createdAt: FieldValue.serverTimestamp() });
      return true;
    });
    if (created) made.push(code);
  }
  return made;
}
const shown = code => code.replace(/(.{4})(?=.)/g, '$1-');

switch (command) {
  case 'gift-codes': {
    const plan = opt('plan');
    const count = Number(opt('count'));
    const months = Number(opt('months') ?? GIFT_MONTHS);
    const batch = opt('batch');
    if (!isPlanId(plan) || !(count >= 1 && count <= 500) || !(months >= 1 && months <= 36) || !batch) fail('gift-codes --plan plus|essential --count N [--months 12] --batch <order id>');
    const codes = await makeCodes(count, { kind: 'gift', plan, months, batch });
    console.log(`${codes.length} ${plan} gift codes, ${months} months each (batch ${batch}):`);
    codes.forEach(c => console.log(`  ${shown(c)}`));
    break;
  }
  case 'institution-codes': {
    const institution = opt('institution');
    const courseEnd = opt('course-end');
    const count = Number(opt('count'));
    const batch = opt('batch');
    if (!institution || !validCourseEnd(courseEnd, now) || !(count >= 1 && count <= 2000) || !batch) fail('institution-codes --institution "<name>" --course-end YYYY-MM-DD --count N --batch <id>');
    const codes = await makeCodes(count, { kind: 'institution', institution, courseEnd, batch });
    console.log(`${codes.length} student codes for ${institution}, Essential until ${courseEnd} (checked again every ${STUDENT_RECHECK_MONTHS} months; batch ${batch}):`);
    codes.forEach(c => console.log(`  ${shown(c)}`));
    break;
  }
  case 'approve-student': {
    const uid = positional;
    const courseEnd = opt('course-end');
    if (!uid || !validCourseEnd(courseEnd, now)) fail('approve-student <uid> --course-end YYYY-MM-DD');
    const grant = extendedGrant('student', 'essential', STUDENT_RECHECK_MONTHS, null, now, courseEndsAt(courseEnd));
    await writeGrant(uid, grant, { via: 'review', courseEnd });
    await db.doc(`studentRequests/${uid}`).set({ state: 'approved', decidedAt: now.toISOString() }, { merge: true });
    console.log(`Student access for ${uid}: Essential until ${grant.expiresAt.slice(0, 10)}.`);
    break;
  }
  case 'early': {
    const plan = opt('plan');
    const until = opt('until');
    const joinedBefore = opt('joined-before');
    const uids = opt('uids')?.split(',').map(s => s.trim()).filter(Boolean);
    if (!isPlanId(plan) || !validCourseEnd(until, now) || (!joinedBefore && !uids?.length)) fail('early --plan plus|essential --until YYYY-MM-DD (--joined-before YYYY-MM-DD | --uids a,b,c) [--dry-run]');
    let list = uids ?? [];
    if (joinedBefore) {
      const cutoff = Date.parse(`${joinedBefore}T00:00:00Z`);
      let page;
      do {
        page = await getAuth().listUsers(1000, page?.pageToken);
        list.push(...page.users.filter(u => Date.parse(u.metadata.creationTime) < cutoff).map(u => u.uid));
      } while (page.pageToken);
    }
    const end = courseEndsAt(until);
    console.log(`${flag('dry-run') ? 'Would grant' : 'Granting'} ${plan} until ${until} to ${list.length} members.`);
    if (!flag('dry-run')) {
      for (const uid of list) {
        await writeGrant(uid, { ...extendedGrant('early', plan, 1, null, now), expiresAt: end.toISOString() });
      }
      console.log('Done.');
    }
    break;
  }
  case 'tester': {
    if (!positional) fail('tester <email or uid> [--remove]');
    const uid = positional.includes('@') ? (await getAuth().getUserByEmail(positional)).uid : positional;
    const ref = db.doc(`planTesters/${uid}`);
    if (flag('remove')) {
      await ref.delete();
      console.log(`${uid} no longer sees paid plans before launch.`);
    } else {
      await ref.set({ addedAt: now.toISOString() });
      console.log(`${uid} sees paid plans now (sign out and in, or restart the app).`);
    }
    break;
  }
  case 'show': {
    const uid = positional;
    if (!uid) fail('show <uid>');
    const grants = (await db.collection(`entitlements/${uid}/grants`).get()).docs.map(d => d.data());
    console.log(JSON.stringify({ summary: summarize(grants, now), grants }, null, 2));
    break;
  }
  default:
    fail('Commands: gift-codes, institution-codes, approve-student, early, tester, show (see the top of this file).');
}
