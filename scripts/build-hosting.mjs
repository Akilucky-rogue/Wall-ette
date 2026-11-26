#!/usr/bin/env node
/**
 * Builds wall-ette.com for Firebase Hosting into hosting/:
 *   - the website (site/: prerendered pages, images, sitemap) at the root;
 *   - the web app (this repo, `vite build --base=/app/`) at /app;
 *   - 404.html from the website's not-found page.
 * firebase.json serves hosting/, sends /app/... to the app, and redirects the
 * old /privacy.html and /terms.html to the website's pages. The Android app
 * still builds from `npm run build` into dist/, at the root.
 *
 * Usage: npm run build:hosting   (npm run deploy builds and publishes)
 */
import { execSync } from 'node:child_process';
import { cpSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const site = join(root, 'site');
const out = join(root, 'hosting');
const run = (command, cwd) => execSync(command, { cwd, stdio: 'inherit' });

if (!existsSync(join(site, 'node_modules'))) run('npm ci', site);
run('npm run build', site);
run('npm run build:web', root);

rmSync(out, { recursive: true, force: true });
cpSync(join(site, 'dist', 'client'), out, { recursive: true });
cpSync(join(root, 'dist-web'), join(out, 'app'), { recursive: true });
// 404.html is the not-found page as plain HTML: served at any address, it
// mustn't start the router, which would render that address instead.
const notFound = readFileSync(join(site, 'dist', 'client', 'not-found', 'index.html'), 'utf8')
  .replace(/<script\b(?![^>]*application\/ld\+json)[^>]*>[\s\S]*?<\/script>/g, (tag) => (tag.includes('localStorage.getItem("theme")') ? tag : ''))
  .replace(/<link[^>]+rel="modulepreload"[^>]*>/g, '');
writeFileSync(join(out, '404.html'), notFound);

// What wall-ette.com must have, and old links that must keep working.
const must = [
  ['index.html', 'Wall·ette'],
  ['app/index.html', '/app/assets/'],
  ['privacy/index.html', 'id="delete"'],
  ['terms/index.html', 'Akshat Vora'],
  ['signin/index.html', 'Welcome back'],
  ['404.html', 'This page isn'],
];
for (const [file, text] of must) {
  const path = join(out, file);
  if (!existsSync(path) || !readFileSync(path, 'utf8').includes(text)) {
    console.error(`build-hosting: ${file} is missing or doesn't contain "${text}"`);
    process.exit(1);
  }
}
console.log(`\nhosting/ is ready: the website, the web app at /app and 404.html.`);
