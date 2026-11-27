#!/usr/bin/env node
/**
 * Builds the test app, "Wall-ette Test" (com.wallette.app.test): the web
 * code with __QA_BUILD__ on (it opens without the app lock), synced into the
 * Android project, then Gradle's qa build type. It installs next to the Play
 * app, so a phone or emulator keeps its real wallet; sign it in with a
 * made-up account.
 *
 * Usage: node scripts/build-qa.mjs   (npm run android:qa)
 * The APK: android/app/build/outputs/apk/qa/app-qa.apk
 *
 * The same steps as `npm run android` and `npm run postandroid`, with
 * WALLETTE_QA=1 for the web build. It leaves a QA_BUILD file next to the web
 * code, and a release build refuses to start while that file is there
 * (android/app/build.gradle): `npm run android`, which every release script
 * runs first, builds the web code again without it.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const windows = process.platform === 'win32';
const run = (cmd, args, cwd = root, env = {}) => {
  console.log(`> ${cmd} ${args.join(' ')}`);
  const r = spawnSync(cmd, args, { cwd, stdio: 'inherit', shell: windows, env: { ...process.env, ...env } });
  if (r.status !== 0) process.exit(r.status ?? 1);
};

run('npx', ['vite', 'build'], root, { WALLETTE_QA: '1' });
// Copied into android/app/src/main/assets/public with the rest of dist.
writeFileSync(join(root, 'dist', 'QA_BUILD'), 'Web code of the test build (no app lock). Not for a release.\n');
run('npx', ['cap', 'sync', 'android']);

// What patch-capacitor-gradle.ps1 does after `npm run android`: Java 17.
for (const file of ['android/app/capacitor.build.gradle', 'node_modules/@capacitor/app/android/build.gradle']) {
  const path = join(root, file);
  if (!existsSync(path)) continue;
  const text = readFileSync(path, 'utf8');
  const patched = text.replace(/JavaVersion\.VERSION_21/g, 'JavaVersion.VERSION_17');
  if (patched !== text) writeFileSync(path, patched);
}

run('node', [join('scripts', 'qa-google-services.mjs')]);
// gradlew has no execute bit in git (the repo is kept on Windows).
run(windows ? 'gradlew.bat' : 'sh', windows ? ['assembleQa'] : ['gradlew', 'assembleQa'], join(root, 'android'));
console.log('\nBuilt android/app/build/outputs/apk/qa/app-qa.apk ("Wall-ette Test").');
console.log('The Android project now holds the test build\'s web code: `npm run android` puts the regular code back.');
