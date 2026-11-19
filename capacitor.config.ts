import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  // The Google Play package name: permanent once the Play app exists, and it
  // must match applicationId in android/app/build.gradle. Builds before Play
  // used com.wallet.walle; those installs stay a separate app. The iOS project
  // still has that bundle ID.
  appId: 'com.wallette.app',
  appName: 'Wall-ette',
  webDir: 'dist'
};

export default config;
