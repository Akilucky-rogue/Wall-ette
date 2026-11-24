#!/usr/bin/env node
/**
 * App update check.
 *
 * Runs services/appUpdatePolicy.ts and services/releaseNotes.ts on made-up
 * answers from Google Play and checks that:
 *   - a finished download offers a restart, and blocks the app until then
 *     when the update is required
 *   - an update is required below the minimum versionCode, or at in-app update
 *     priority 4 and up, using Google's full-screen update when Play allows it
 *     and the store page when it doesn't
 *   - any other update gets Google's dialog, and "No thanks" keeps that
 *     version quiet for 3 days, but not a newer one
 *   - nothing happens with no update, while a normal one is running, or when
 *     Play allows neither kind
 *   - "What's new" shows nothing on a new install or after a downgrade, the
 *     current notes after an update from a build that didn't record them, and
 *     otherwise everything since the last version shown, newest first, at most 3
 *   - the release notes are well formed, fit Play's 500-character release notes,
 *     and are never for a versionCode above android/app/build.gradle
 *
 * Usage (after `npm ci`):
 *   node scripts/check-app-updates.mjs
 *
 * Exits with code 1 if any check fails.
 */
import { build } from 'esbuild'; // installed with Vite
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tmp = mkdtempSync(join(tmpdir(), 'wallette-updates-'));
const bundle = join(tmp, 'updates.mjs');
await build({
  stdin: {
    contents: [
      `export * from ${JSON.stringify(join(root, 'services', 'appUpdatePolicy.ts'))};`,
      `export * from ${JSON.stringify(join(root, 'services', 'releaseNotes.ts'))};`,
    ].join('\n'),
    resolveDir: root,
    loader: 'ts',
  },
  outfile: bundle,
  bundle: true,
  platform: 'node',
  format: 'esm',
  logLevel: 'error',
});
const {
  planUpdate, needsMinimum, UpdateAvailability: A, INSTALL_DOWNLOADED, ASK_AGAIN_AFTER_MS,
  findingOf, failureOf,
  RELEASE_NOTES, notesToShow, latestNotes,
} = await import(pathToFileURL(bundle).href);
rmSync(tmp, { recursive: true, force: true });

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
const ok = (label, condition) => eq(label, Boolean(condition), true);

// ── Update plans ───────────────────────────────────────────────────────────
const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 10, 19, 6, 0, 0);
const facts = (over = {}) => ({
  availability: A.AVAILABLE,
  installStatus: 0,
  currentVersionCode: 10,
  availableVersionCode: 11,
  immediateAllowed: true,
  flexibleAllowed: true,
  priority: 0,
  minVersionCode: 0,
  declined: null,
  now: NOW,
  ...over,
});

console.log('Update plans');
eq('normal update', planUpdate(facts()), 'flexible');
eq('no update', planUpdate(facts({ availability: A.NOT_AVAILABLE })), 'none');
eq('unknown availability', planUpdate(facts({ availability: A.UNKNOWN })), 'none');
eq('flexible not allowed', planUpdate(facts({ flexibleAllowed: false })), 'none');
eq('neither kind allowed', planUpdate(facts({ flexibleAllowed: false, immediateAllowed: false })), 'none');
eq('normal update already running', planUpdate(facts({ availability: A.IN_PROGRESS })), 'none');

eq('downloaded → restart', planUpdate(facts({ installStatus: INSTALL_DOWNLOADED })), 'ready');
eq('downloaded and required', planUpdate(facts({ installStatus: INSTALL_DOWNLOADED, minVersionCode: 11 })), 'ready-required');
eq('downloaded at priority 5', planUpdate(facts({ installStatus: INSTALL_DOWNLOADED, priority: 5 })), 'ready-required');
eq('downloaded, at the minimum', planUpdate(facts({ installStatus: INSTALL_DOWNLOADED, minVersionCode: 10 })), 'ready');
eq('downloaded with no update reported', planUpdate(facts({ installStatus: INSTALL_DOWNLOADED, availability: A.NOT_AVAILABLE })), 'ready');

eq('below the minimum', planUpdate(facts({ minVersionCode: 11 })), 'immediate');
eq('at the minimum', planUpdate(facts({ minVersionCode: 10 })), 'flexible');
eq('below the minimum, full-screen not allowed', planUpdate(facts({ minVersionCode: 11, immediateAllowed: false })), 'required-store');
eq('below the minimum, update already running', planUpdate(facts({ minVersionCode: 11, availability: A.IN_PROGRESS })), 'required-store');
eq('below the minimum, nothing on Play yet', planUpdate(facts({ minVersionCode: 12, availability: A.NOT_AVAILABLE })), 'none');
eq('minimum above what Play offers', planUpdate(facts({ minVersionCode: 12, availableVersionCode: 11 })), 'immediate');
eq('priority 4', planUpdate(facts({ priority: 4 })), 'immediate');
eq('priority 5', planUpdate(facts({ priority: 5 })), 'immediate');
eq('priority 3', planUpdate(facts({ priority: 3 })), 'flexible');

const declined = (code, daysAgo) => ({ code, at: NOW - daysAgo * DAY });
eq('declined this version 1 day ago', planUpdate(facts({ declined: declined(11, 1) })), 'none');
eq('declined this version just under 3 days ago', planUpdate(facts({ declined: { code: 11, at: NOW - ASK_AGAIN_AFTER_MS + 1000 } })), 'none');
eq('declined this version 3 days ago', planUpdate(facts({ declined: { code: 11, at: NOW - ASK_AGAIN_AFTER_MS } })), 'flexible');
eq('declined an older version', planUpdate(facts({ declined: declined(11, 1), availableVersionCode: 12 })), 'flexible');
eq('declined, then it became required', planUpdate(facts({ declined: declined(11, 1), minVersionCode: 11 })), 'immediate');

eq('minimum needed: update available', needsMinimum(A.AVAILABLE, 0), true);
eq('minimum needed: update running', needsMinimum(A.IN_PROGRESS, 2), true);
eq('minimum needed: downloaded', needsMinimum(A.AVAILABLE, INSTALL_DOWNLOADED), true);
eq('minimum needed: downloaded, no update reported', needsMinimum(A.NOT_AVAILABLE, INSTALL_DOWNLOADED), true);
eq('minimum needed: no update', needsMinimum(A.NOT_AVAILABLE, 0), false);

// What a check found (Self → About, the bell).
eq('found: nothing newer', findingOf(A.NOT_AVAILABLE, 0), 'latest');
eq('found: an update', findingOf(A.AVAILABLE, 0), 'available');
eq('found: a download running', findingOf(A.IN_PROGRESS, 2), 'downloading');
eq('found: downloaded', findingOf(A.AVAILABLE, INSTALL_DOWNLOADED), 'ready');
eq('found: downloaded, no update reported', findingOf(A.NOT_AVAILABLE, INSTALL_DOWNLOADED), 'ready');
eq('found: Play unsure', findingOf(A.UNKNOWN, 0), 'unavailable');
// Play's own messages, as the plugin passes them on (InstallException.getMessage()).
const playError = (code, text, name) => `Install Error(${code}): ${text} (https://developer.android.com/reference/com/google/android/play/core/install/model/InstallErrorCode#${name})`;
eq('failed: not installed from Play',
  failureOf(playError(-10, 'The app is not owned by any user on this device. An app is "owned" if it has been acquired from Play.', 'ERROR_APP_NOT_OWNED')), 'not-from-play');
eq('failed: no Play Store',
  failureOf(playError(-9, 'The Play Store app is either not installed or not the official version.', 'ERROR_PLAY_STORE_NOT_FOUND')), 'unavailable');
eq('failed: API not available',
  failureOf(playError(-3, 'The API is not available on this device.', 'ERROR_API_NOT_AVAILABLE')), 'unavailable');
eq('failed: error -100 is not -10', failureOf(playError(-100, 'Internal error.', 'ERROR_INTERNAL_ERROR')), 'unavailable');
eq('failed: Play services missing', failureOf('GooglePlayServices are not available.'), 'unavailable');
eq('failed: offline', failureOf('Failed to bind to the service.'), 'unavailable');

// ── What's new ─────────────────────────────────────────────────────────────
const note = (versionCode) => ({ versionCode, version: `1.${versionCode}.0`, items: [`Change ${versionCode}.`] });
const notes = [note(13), note(12), note(11), note(10)];
const codes = (list) => list.map(n => n.versionCode);

console.log("What's new");
eq('new install', codes(notesToShow(null, 13, true, notes)), []);
eq('update from a build that recorded nothing', codes(notesToShow(null, 13, false, notes)), [13]);
eq('already shown', codes(notesToShow(13, 13, false, notes)), []);
eq('one version on', codes(notesToShow(12, 13, false, notes)), [13]);
eq('several versions on, newest first', codes(notesToShow(11, 13, false, notes)), [13, 12]);
eq('at most three', codes(notesToShow(9, 13, false, notes)), [13, 12, 11]);
eq('nothing above the running version', codes(notesToShow(10, 12, false, notes)), [12, 11]);
eq('after a downgrade', codes(notesToShow(13, 11, false, notes)), []);
eq('a release without notes', codes(notesToShow(13, 14, false, notes)), []);
eq('order of the list does not matter', codes(notesToShow(10, 13, false, [note(11), note(13), note(12)])), [13, 12, 11]);
eq('latest for Profile', codes(latestNotes(13, notes)), [13, 12, 11]);
eq('latest for Profile, older build', codes(latestNotes(11, notes)), [11, 10]);

// ── The real release notes ─────────────────────────────────────────────────
console.log('Release notes');
const gradle = readFileSync(join(root, 'android', 'app', 'build.gradle'), 'utf8');
const gradleCode = Number(/versionCode\s+(\d+)/.exec(gradle)?.[1]);
const gradleName = /versionName\s+"([^"]+)"/.exec(gradle)?.[1];
ok('build.gradle has a versionCode', Number.isInteger(gradleCode));

const seen = new Set();
RELEASE_NOTES.forEach((n, i) => {
  const at = `entry ${i} (versionCode ${n.versionCode})`;
  ok(`${at}: integer versionCode`, Number.isInteger(n.versionCode) && n.versionCode > 0);
  ok(`${at}: versionCode used once`, !seen.has(n.versionCode));
  seen.add(n.versionCode);
  ok(`${at}: newest first`, i === 0 || n.versionCode < RELEASE_NOTES[i - 1].versionCode);
  ok(`${at}: version name`, typeof n.version === 'string' && n.version.trim() !== '');
  ok(`${at}: has items`, Array.isArray(n.items) && n.items.length > 0);
  ok(`${at}: items are non-empty sentences`, n.items.every(t => typeof t === 'string' && t.trim() === t && t.length > 0));
  ok(`${at}: fits Play's 500-character release notes`, n.items.join('\n').length <= 500);
  ok(`${at}: not above build.gradle's versionCode ${gradleCode}`, n.versionCode <= gradleCode);
  if (n.versionCode === gradleCode) eq(`${at}: version name matches build.gradle`, n.version, gradleName);
});
if (!RELEASE_NOTES.some(n => n.versionCode === gradleCode)) {
  console.log(`  note: no "What's new" entry for versionCode ${gradleCode}; fine if this release has nothing to announce`);
}

console.log(failures ? `\n${failures} of ${checks} checks failed` : `\nAll ${checks} checks passed`);
process.exit(failures ? 1 : 0);
