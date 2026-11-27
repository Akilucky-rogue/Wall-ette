#!/usr/bin/env node
/**
 * The test build (app/build.gradle, qa) has its own application id,
 * com.wallette.app.test, and the Google services plugin wants a client for
 * it. This copies android/app/google-services.json to
 * android/app/src/qa/google-services.json with the client's package set to
 * the test id. Both files are gitignored. Nothing changes in Firebase: the
 * test build only uses native Firebase for Crashlytics, which debug-like
 * builds keep off, and the app's own Firebase runs on the web config.
 *
 * Usage: node scripts/qa-google-services.mjs
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const from = join(root, 'android', 'app', 'google-services.json');
const to = join(root, 'android', 'app', 'src', 'qa', 'google-services.json');
const APP = 'com.wallette.app';
const TEST = 'com.wallette.app.test';

let config;
try {
  config = JSON.parse(readFileSync(from, 'utf8'));
} catch {
  console.error('android/app/google-services.json is missing or unreadable (docs/PLAY_SUBMISSION.md, step 1).');
  process.exit(1);
}
const client = (config.client ?? []).find(c => c.client_info?.android_client_info?.package_name === APP);
if (!client) {
  console.error(`android/app/google-services.json has no client for ${APP}.`);
  process.exit(1);
}
const test = structuredClone(client);
test.client_info.android_client_info.package_name = TEST;
// OAuth clients are tied to the real app's id and signing key: not the test build's.
test.oauth_client = (test.oauth_client ?? []).filter(o => o.client_type !== 1);
mkdirSync(dirname(to), { recursive: true });
writeFileSync(to, JSON.stringify({ ...config, client: [test] }, null, 2) + '\n');
console.log(`Wrote ${to.slice(root.length + 1)} for ${TEST}.`);
