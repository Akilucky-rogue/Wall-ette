#!/usr/bin/env node
/**
 * Crash report check (Crashlytics, Android).
 *
 * Runs services/crashFormat.ts and services/crashReports.ts in Node, with
 * stand-ins for Capacitor and the Crashlytics plugin, and checks that:
 *   - messages lose email addresses, user and document ids, and numbers that
 *     could be amounts, account or reference numbers, while short numbers and
 *     plain words stay
 *   - stack traces become frames with the page origin dropped
 *   - uncaught errors and unhandled rejections are reported, once each per
 *     session and at most 20 in all, and browser noise isn't
 *   - handled problems (a refused cloud write) get a frame of their own, so
 *     Crashlytics files each kind as its own issue
 *   - turning reports off stops them at once, tells the native SDK and drops
 *     unsent reports; nothing is sent on the web
 *
 * Usage (after `npm ci`):
 *   node scripts/check-crash-reports.mjs
 *
 * Exits with code 1 if any check fails.
 */
import { build } from 'esbuild'; // installed with Vite
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tmp = mkdtempSync(join(tmpdir(), 'wallette-crash-'));

// Stand-ins: Capacitor says whether this is the app, the plugin records calls.
const stubs = {
  '@capacitor/core': 'export const Capacitor = { isNativePlatform: () => globalThis.__native };',
  '@capacitor-firebase/crashlytics': `
    const call = (name) => (options) => { globalThis.__calls.push([name, options]); return Promise.resolve(); };
    export const FirebaseCrashlytics = {
      recordException: call('recordException'), log: call('log'),
      setEnabled: call('setEnabled'), deleteUnsentReports: call('deleteUnsentReports'),
    };`,
};
async function load(entry, name) {
  const outfile = join(tmp, `${name}.mjs`);
  await build({
    entryPoints: [join(root, 'services', entry)],
    outfile, bundle: true, platform: 'node', format: 'esm', logLevel: 'error',
    plugins: [{
      name: 'stubs',
      setup(b) {
        b.onResolve({ filter: /^@capacitor(-firebase)?\/(core|crashlytics)$/ }, a => ({ path: a.path, namespace: 'stub' }));
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

// ── Messages and stacks ─────────────────────────────────────────────────────
const { redact, stackFrames, describe } = await load('crashFormat.ts', 'format');

eq('email', redact('No account for akshat.v+test@example.co.in'), 'No account for <email>');
eq('Firestore path', redact('No document to update: projects/p/databases/(default)/documents/users/Xy3kP9qL2mN8rT5vW1zA7bC4dE6f/transactions/import-9f86d081884c7d659a2feaa0c55ad015'),
  'No document to update: projects/p/databases/(default)/documents/users/<uid>/transactions/<id>');
eq('a bare user id', redact('uid Xy3kP9qL2mN8rT5vW1zA7bC4dE6f signed out'), 'uid <id> signed out');
eq('uuid', redact('txn 3f2a8c1e-9b7d-4e6f-a5c3-1d2e3f4a5b6c failed'), 'txn <id> failed');
eq('amount with decimals', redact('Amount 1,23,456.78 is over the limit'), 'Amount <n> is over the limit');
eq('small amount with decimals', redact('Paid 486.00'), 'Paid <n>');
eq('large whole amount', redact('Balance 85000 does not match'), 'Balance <n> does not match');
eq('account number', redact('IFT/10001193553/transfer'), 'IFT/<n>/transfer');
eq('UPI reference', redact('UPI/DR/615230407557/x'), 'UPI/DR/<n>/x');
eq('date', redact('Bad date 2026-03-08'), 'Bad date <n>-03-08');
eq('short numbers stay', redact("Cannot read properties of undefined (reading '0'), status 404"), "Cannot read properties of undefined (reading '0'), status 404");
eq('plain words stay', redact('Unexpected token in JSON at position'), 'Unexpected token in JSON at position');
eq('long messages are cut', redact('x'.repeat(500)).length, 300);
eq('not a string', [redact(undefined), redact(null), redact(42)], ['', '', '42']);

const v8 = [
  'TypeError: Cannot read properties of undefined',
  '    at Ab (https://localhost/assets/index-D3ab12.js:1:2345)',
  '    at async Cd (https://localhost/assets/ImportStatement-x9.js?v=2:3:44)',
  '    at https://localhost/assets/index-D3ab12.js:1:999',
  '    at async Promise.all (index 0)',
].join('\n');
eq('V8 frames', stackFrames(v8), [
  { functionName: 'Ab', fileName: '/assets/index-D3ab12.js', lineNumber: 1 },
  { functionName: 'Cd', fileName: '/assets/ImportStatement-x9.js', lineNumber: 3 },
  { functionName: '(anonymous)', fileName: '/assets/index-D3ab12.js', lineNumber: 1 },
]);
eq('Firefox and Safari frames', stackFrames('Ab@https://localhost/assets/index.js:7:1\n@https://localhost/assets/index.js:8:2'), [
  { functionName: 'Ab', fileName: '/assets/index.js', lineNumber: 7 },
  { functionName: '(anonymous)', fileName: '/assets/index.js', lineNumber: 8 },
]);
eq('no stack', stackFrames(undefined), []);
eq('at most 25 frames', stackFrames(Array.from({ length: 40 }, (_, i) => `    at f${i} (https://localhost/a.js:${i + 1}:1)`).join('\n')).length, 25);
eq('describe an Error', describe(new RangeError('Index 12345 out of range')), 'RangeError: Index <n> out of range');
eq('describe a Firebase-style error', describe({ code: 'permission-denied', message: 'Missing or insufficient permissions.' }), 'Missing or insufficient permissions.');
eq('describe a string', describe('Failed for 98765'), 'Failed for <n>');

// ── Reporting ───────────────────────────────────────────────────────────────
const store = new Map();
globalThis.localStorage = {
  getItem: k => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: k => store.delete(k),
};
globalThis.window = new EventTarget();
globalThis.__native = true;
globalThis.__calls = [];
const crash = await load('crashReports.ts', 'reports');
const calls = (name) => globalThis.__calls.filter(([n]) => n === name).map(([, o]) => o);
const fire = (type, props) => window.dispatchEvent(Object.assign(new Event(type), props));
const settle = () => new Promise(r => setTimeout(r, 0));

crash.initCrashReports();
eq('on by default', crash.crashReportsOn(), true);
eq('nothing switched off at start', calls('setEnabled').length, 0);

const boom = new Error('Total 1,250.00 does not add up');
boom.stack = 'Error: Total 1,250.00 does not add up\n    at sum (https://localhost/assets/index-a.js:1:10)';
fire('error', { error: boom, message: boom.message });
let reports = calls('recordException');
eq('an uncaught error is reported', reports.length, 1);
eq('masked', reports[0]?.message, 'Error: Total <n> does not add up');
eq('with its frames', reports[0]?.stacktrace, [{ functionName: 'sum', fileName: '/assets/index-a.js', lineNumber: 1 }]);
eq('and where it surfaced', reports[0]?.keysAndValues, [{ key: 'source', value: 'error', type: 'string' }]);

fire('error', { error: boom, message: boom.message });
eq('the same error again is not', calls('recordException').length, 1);

fire('unhandledrejection', { reason: 'Sync failed for 4321' });
reports = calls('recordException');
eq('an unhandled rejection is reported', reports[1]?.message, 'Sync failed for <n>');
eq('frameless ones get their own frame', reports[1]?.stacktrace, [{ functionName: 'unhandledrejection', fileName: 'webview', lineNumber: 0 }]);

fire('error', { error: null, message: 'ResizeObserver loop completed with undelivered notifications.' });
eq('browser noise is not', calls('recordException').length, 2);

crash.reportProblem('Cloud write refused', { code: 'permission-denied', change: 'import' });
reports = calls('recordException');
eq('a handled problem', reports[2]?.message, 'Cloud write refused');
eq('filed by its kind', reports[2]?.stacktrace, [{ functionName: 'Cloud write refused.permission-denied.import', fileName: 'app', lineNumber: 0 }]);
eq('with its keys', reports[2]?.keysAndValues.map(k => `${k.key}=${k.value}`), ['code=permission-denied', 'change=import']);

crash.breadcrumb('screen IMPORT for a@b.com');
eq('breadcrumbs are masked too', calls('log').at(-1)?.message, 'screen IMPORT for <email>');

for (let i = 0; i < 30; i++) crash.reportError(new Error(`distinct ${i}`), 'test');
eq('at most 20 a session', calls('recordException').length, 20);

await crash.setCrashReports(false);
eq('turned off', crash.crashReportsOn(), false);
eq('the SDK is told', calls('setEnabled').at(-1), { enabled: false });
eq('and unsent reports deleted', calls('deleteUnsentReports').length, 1);
const before = globalThis.__calls.length;
crash.reportProblem('Cloud write refused', { code: 'unavailable', change: 'tx' });
crash.breadcrumb('screen HISTORY');
eq('nothing is sent while off', globalThis.__calls.length, before);

await crash.setCrashReports(true);
eq('turned back on', [crash.crashReportsOn(), calls('setEnabled').at(-1)], [true, { enabled: true }]);
await settle();

// The web build sends nothing.
globalThis.__native = false;
globalThis.__calls = [];
const web = await load('crashReports.ts', 'reports-web');
web.initCrashReports();
web.reportError(new Error('on the web'), 'error');
web.reportProblem('Cloud write refused', { code: 'x' });
await web.setCrashReports(false);
eq('nothing on the web', globalThis.__calls.length, 0);

rmSync(tmp, { recursive: true, force: true });
console.log(`${checks - failures}/${checks} checks pass`);
if (failures) process.exit(1);
