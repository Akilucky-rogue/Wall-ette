#!/usr/bin/env node
/**
 * Password-reset check.
 *
 * Runs utils/emailHints.ts and services/passwordReset.ts in Node, with
 * stand-ins for Firebase and crash reports, and checks that:
 *   - typos of common mail domains get a suggestion, and real domains
 *     (including ones close to a bigger one, like mail.com) don't
 *   - a sent email, "no account uses this email" and each failure Firebase
 *     can give come back as the right result and message
 *   - only failures with no cause the person can fix are reported
 *
 * Usage (after `npm ci`):
 *   node scripts/check-password-reset.mjs
 *
 * Exits with code 1 if any check fails.
 */
import { build } from 'esbuild'; // installed with Vite
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tmp = mkdtempSync(join(tmpdir(), 'wallette-reset-'));

// Stand-ins: Firebase answers with globalThis.__answer, reports are recorded.
const stubs = {
  'firebase/auth': `
    export const sendPasswordResetEmail = (auth, email) => {
      globalThis.__sent.push(email);
      const code = globalThis.__answer;
      return code ? Promise.reject(Object.assign(new Error(code), { code })) : Promise.resolve();
    };`,
  firebase: 'export const auth = {};',
  crashReports: 'export const reportProblem = (what, keys) => globalThis.__reports.push([what, keys]);',
};
async function load(entry, name) {
  const outfile = join(tmp, `${name}.mjs`);
  await build({
    entryPoints: [join(root, entry)],
    outfile, bundle: true, platform: 'node', format: 'esm', logLevel: 'error',
    plugins: [{
      name: 'stubs',
      setup(b) {
        b.onResolve({ filter: /^(firebase\/auth|\.\/firebase|\.\/crashReports)$/ }, a => ({ path: a.path.replace('./', ''), namespace: 'stub' }));
        b.onLoad({ filter: /.*/, namespace: 'stub' }, a => ({ contents: stubs[a.path], loader: 'js' }));
      },
    }],
  });
  return import(pathToFileURL(outfile).href);
}

let failures = 0;
let checks = 0;
const eq = (label, actual, expected) => {
  checks++;
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a !== e) {
    failures++;
    console.log(`  FAIL ${label}: got ${a}, expected ${e}`);
  }
};

// ── Email hints ─────────────────────────────────────────────────────────────
const { isEmailLike, suggestEmail } = await load('utils/emailHints.ts', 'hints');

eq('an address', isEmailLike('asha.k@example.co.in'), true);
eq('spaces around are fine', isEmailLike('  asha@example.com '), true);
for (const bad of ['asha', 'asha@', 'asha@example', '@example.com', 'asha@example.c', 'as ha@example.com']) {
  eq(`not an address: ${bad}`, isEmailLike(bad), false);
}

const typos = {
  'asha@gmial.com': 'asha@gmail.com',
  'asha@gamil.com': 'asha@gmail.com',
  'asha@gmal.com': 'asha@gmail.com',
  'asha@gnail.com': 'asha@gmail.com',
  'asha@gmail.con': 'asha@gmail.com',
  'asha@gmail.co': 'asha@gmail.com',
  'asha@gmail.cm': 'asha@gmail.com',
  'asha@gmailcom': 'asha@gmail.com',
  'Asha.K@GMIAL.COM': 'Asha.K@gmail.com',
  'asha@hotmial.com': 'asha@hotmail.com',
  'asha@yaho.com': 'asha@yahoo.com',
  'asha@yahoo.co.on': 'asha@yahoo.co.in',
  'asha@outlok.com': 'asha@outlook.com',
  'asha@iclod.com': 'asha@icloud.com',
  'asha@rediffmal.com': 'asha@rediffmail.com',
};
for (const [typed, fix] of Object.entries(typos)) eq(`suggests for ${typed}`, suggestEmail(typed), fix);

for (const fine of [
  'asha@gmail.com', 'asha@GMAIL.com', 'asha@yahoo.co.in', 'asha@outlook.in', 'asha@live.in',
  'asha@mail.com', 'asha@gmx.com', 'asha@icloud.com', 'asha@me.com',
  'asha@example.com', 'asha@company.co.in', 'asha@iitb.ac.in', 'asha@x.io', 'asha', 'asha@', '',
]) eq(`no suggestion for ${fine || '(empty)'}`, suggestEmail(fine), null);

// ── Sending ─────────────────────────────────────────────────────────────────
globalThis.__sent = [];
globalThis.__reports = [];
const { sendResetLink, resetFailureMessage } = await load('services/passwordReset.ts', 'reset');

globalThis.__answer = null;
eq('sent', await sendResetLink('  asha@example.com '), { status: 'sent' });
eq('to the trimmed address', globalThis.__sent.at(-1), 'asha@example.com');

globalThis.__answer = 'auth/user-not-found';
eq('no account', await sendResetLink('asha@exmaple.com'), { status: 'no-account' });

const expected = {
  'auth/invalid-email': "That doesn't look like an email address. Check it and try again.",
  'auth/missing-email': "That doesn't look like an email address. Check it and try again.",
  'auth/too-many-requests': 'Too many reset emails in a short time. Wait a few minutes, then try again.',
  'auth/network-request-failed': "You're offline. Connect to the internet and try again.",
  'auth/user-disabled': 'This account has been turned off, so no reset email was sent.',
};
for (const [code, message] of Object.entries(expected)) {
  globalThis.__answer = code;
  eq(code, await sendResetLink('asha@example.com'), { status: 'failed', message });
}
eq('failures people can fix are not reported', globalThis.__reports.length, 0);

globalThis.__answer = 'auth/quota-exceeded';
eq('quota', (await sendResetLink('asha@example.com')).message, "Wall-ette can't send more emails right now. Try again in a few hours.");
globalThis.__answer = 'auth/internal-error';
eq('anything else', (await sendResetLink('asha@example.com')).message, "The reset email couldn't be sent. Try again in a minute.");
eq('unexpected failures are reported by code', globalThis.__reports, [
  ['Password reset email failed', { code: 'auth/quota-exceeded' }],
  ['Password reset email failed', { code: 'auth/internal-error' }],
]);
eq('a message for an empty code', resetFailureMessage(''), "The reset email couldn't be sent. Try again in a minute.");

rmSync(tmp, { recursive: true, force: true });
console.log(`${checks - failures}/${checks} checks pass`);
if (failures) process.exit(1);
