/// <reference types="vite/client" />

// Global CSS Modules declaration for TypeScript
// Allows importing '*.module.css' files without type errors

declare module '*.module.css' {
  const classes: { [key: string]: string };
  export default classes;
}

// App version from android/app/build.gradle, set by vite.config.ts
declare const __APP_VERSION__: string;
/** The Android versionCode. */
declare const __APP_BUILD__: number;
/**
 * True only in the test build ("Wall-ette Test", scripts/build-qa.mjs): it
 * opens without the app lock, so it can be tried with a made-up account.
 */
declare const __QA_BUILD__: boolean;

// Vite `?url` asset imports (used for the bundled pdf.js worker)
declare module '*?url' {
  const src: string;
  export default src;
}
