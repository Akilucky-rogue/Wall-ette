import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

import { cloudflare } from "@cloudflare/vite-plugin";

// The app's version comes from android/app/build.gradle, so the web code and
// the Android build can't disagree. Profile and the splash screen show it;
// "What's new" compares versionCodes. A build without it stops here rather
// than shipping version 0, which would replay old release notes.
const gradle = readFileSync(new URL('./android/app/build.gradle', import.meta.url), 'utf8');
const versionName = /versionName\s+"([^"]+)"/.exec(gradle)?.[1];
const versionCode = Number(/versionCode\s+(\d+)/.exec(gradle)?.[1]);
if (!versionName || !Number.isInteger(versionCode) || versionCode < 1) {
  throw new Error('vite.config.ts: no versionCode/versionName in android/app/build.gradle');
}

export default defineConfig({
  plugins: [react(), cloudflare()],
  define: {
    __APP_VERSION__: JSON.stringify(versionName),
    __APP_BUILD__: JSON.stringify(versionCode),
  },
  server: {
    host: '0.0.0.0',
    port: 8080,
  },
  preview: {
    host: '0.0.0.0',
    port: 8080,
  },
  esbuild: {
    // Strip console.* and debugger statements from production bundles.
    // Preserve console.warn and console.error for actionable runtime issues.
    drop: ['debugger'],
    pure: ['console.log', 'console.info', 'console.debug', 'console.trace'],
  },
  build: {
    // Keep source maps off by default for smaller bundles; flip on for debugging.
    sourcemap: false,
    // Always clear stale hashed chunks from previous builds (audit Phase 4.4).
    emptyOutDir: true,
  },
});