import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  // The Google Play package name: permanent once the Play app exists, and it
  // must match applicationId in android/app/build.gradle. Builds before Play
  // used com.wallet.walle; those installs stay a separate app. The iOS project
  // still has that bundle ID.
  appId: 'com.wallette.app',
  appName: 'Wall-ette',
  webDir: 'dist',
  plugins: {
    SystemBars: {
      // index.html asks for viewport-fit=cover; saying so up front saves a
      // layout jump while Capacitor checks the page.
      initialViewportFitValueHint: 'cover',
    },
    // Phone notifications (services/phoneNotifier.ts): the white wallet in
    // android/app/src/main/res/drawable, tinted the theme's deep sage.
    LocalNotifications: {
      smallIcon: 'ic_stat_wallette',
      iconColor: '#7D937A',
    },
    // Sign in with Google (services/googleSignIn.ts). Only Google is built in:
    // no Facebook SDK (it would add the advertising-ID permission Play asks
    // about), no Apple or X. android/gradle.properties says the same, so a
    // build without `cap sync` leaves them out too.
    SocialLogin: {
      providers: { google: true, facebook: false, apple: false, twitter: false },
      logLevel: 1,
    },
  },
};

export default config;
