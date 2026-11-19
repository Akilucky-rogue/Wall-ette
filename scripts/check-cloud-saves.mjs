#!/usr/bin/env node
/**
 * Refused cloud writes check (audit M4).
 *
 * Runs services/cloudSaves.ts with stand-in writes and checks that:
 *   - a refused write is kept, with its count and Firestore's error code, and
 *     a later write to the same thing clears it
 *   - writes start the moment they're sent, so an import hands Firestore all
 *     its batches at once
 *   - a write that throws before sending counts as refused
 *   - Try again sends each refused write again and keeps the ones refused again
 *   - Dismiss forgets them, and a new sign-in drops another user's
 *   - the state only changes when something does (React reads it every render)
 *
 * Usage (after `npm ci`):
 *   node scripts/check-cloud-saves.mjs
 *
 * Exits with code 1 if any check fails.
 */
import { build } from 'esbuild'; // installed with Vite
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tmp = mkdtempSync(join(tmpdir(), 'wallette-saves-'));
const bundle = join(tmp, 'saves.mjs');
await build({
  entryPoints: [join(root, 'services', 'cloudSaves.ts')],
  outfile: bundle,
  bundle: true,
  platform: 'node',
  format: 'esm',
  logLevel: 'error',
  define: { 'import.meta.env.PROD': 'true' },
});
const saves = await import(pathToFileURL(bundle).href);
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
const state = () => ({ ...saves.getUnsaved() });
const ok = () => Promise.resolve();
const refuse = (code) => () => Promise.reject(Object.assign(new Error(code), { code }));
// A write that waits until the test lets it finish.
const held = () => {
  let finish;
  const promise = new Promise((res, rej) => { finish = (fail) => (fail ? rej({ code: fail }) : res()); });
  return { send: () => promise, finish };
};

saves.setCloudOwner('user-a');
eq('nothing refused at first', state(), { count: 0, code: null, retrying: false });

eq('a saved write', await saves.sendToCloud('tx:1', 1, ok), true);
eq('nothing kept for it', state().count, 0);

eq('a refused write', await saves.sendToCloud('tx:2', 1, refuse('permission-denied')), false);
eq('it is kept', state(), { count: 1, code: 'permission-denied', retrying: false });

await saves.sendToCloud('import:a', 500, refuse('permission-denied'));
eq('an import batch counts its rows', state().count, 501);

await saves.sendToCloud('tx:2', 1, ok);
eq('a later write to the same thing clears it', state().count, 500);

await saves.sendToCloud('settings:currency', 1, refuse('resource-exhausted'));
await saves.sendToCloud('tx:3', 1, refuse('permission-denied'));
eq('the quota is named when it is the cause', state().code, 'resource-exhausted');

eq('a write that throws before sending', await saves.sendToCloud('tx:4', 1, () => { throw Object.assign(new Error('bad'), { code: 'invalid-argument' }); }), false);
eq('counts as refused', state().count, 503);

{
  const started = [];
  for (const n of [1, 2, 3]) void saves.sendToCloud(`import:batch${n}`, 1, () => { started.push(n); return Promise.resolve(); });
  eq('batches start the moment they are sent', started, [1, 2, 3]);
  await new Promise(r => setTimeout(r, 0));
}

{
  const before = saves.getUnsaved();
  eq('state is the same object until something changes', saves.getUnsaved() === before, true);
  let calls = 0;
  const stop = saves.subscribeUnsaved(() => { calls++; });
  await saves.sendToCloud('tx:5', 1, refuse('permission-denied'));
  eq('listeners hear about a refusal', calls, 1);
  eq('and the state is a new object', saves.getUnsaved() === before, false);
  stop();
}

saves.dismissUnsaved();
eq('dismiss forgets them', state().count, 0);

// Try again re-runs each kept write: one goes through, one is refused again.
{
  let attempt = 0;
  const flaky = () => (++attempt === 1 ? Promise.reject({ code: 'unavailable' }) : Promise.resolve());
  const stubborn = () => Promise.reject({ code: 'permission-denied' });
  await saves.sendToCloud('tx:8', 1, flaky);
  await saves.sendToCloud('tx:9', 1, stubborn);
  eq('before trying again', state(), { count: 2, code: 'permission-denied', retrying: false });
  saves.retryUnsaved();
  eq('while sending again', state().retrying, true);
  eq('still listed while sending', state().count, 2);
  await new Promise(r => setTimeout(r, 10));
  eq('after trying again', state(), { count: 1, code: 'permission-denied', retrying: false });
}

// Another user signs in: what was refused for the last one goes.
{
  const late = held();
  const pending = saves.sendToCloud('tx:10', 1, late.send);
  saves.setCloudOwner('user-b');
  eq('a new owner drops the old refusals', state().count, 0);
  late.finish('permission-denied');
  await pending;
  eq('and a refusal for the old owner arriving late is ignored', state().count, 0);
  saves.setCloudOwner('user-b');
  await saves.sendToCloud('tx:11', 1, refuse('permission-denied'));
  saves.setCloudOwner('user-b');
  eq('the same owner again keeps them', state().count, 1);
  saves.setCloudOwner(null);
  eq('signing out drops them', state().count, 0);
}

console.log(`${checks - failures}/${checks} checks pass`);
if (failures) process.exit(1);
