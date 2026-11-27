/**
 * The public web address (Firebase Hosting, custom domain): the website
 * (site/) with the web app at /app; wall-e-7a113.web.app serves the same.
 * The policy pages are the website's; /privacy.html and /terms.html, where
 * they used to be, redirect to them (firebase.json).
 */
export const SITE_HOST = 'wall-ette.com';
export const SITE_URL = `https://${SITE_HOST}`;
export const PRIVACY_URL = `${SITE_URL}/privacy`;
export const TERMS_URL = `${SITE_URL}/terms`;
/** Referrals, student access and gifts (wall-ette.com/spread). */
export const SPREAD_URL = `${SITE_URL}/spread`;

/** Where support and bank requests go: the website's contact address (site/src/lib/site.ts). */
export const SUPPORT_EMAIL = 'akshatbvora@gmail.com';

/**
 * Sender of the password-reset email (Firebase's default for this project).
 * Update it if the Firebase email templates get a custom domain.
 */
export const ACCOUNT_EMAIL_FROM = 'noreply@wall-e-7a113.firebaseapp.com';

/** Wall-ette on Google Play. */
export const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.wallette.app';

/**
 * Whether the Play listing is public. Until it is, the website's "Get the
 * Android app" banner stays hidden: the old APK download is retired, since a
 * new one would be com.wallette.app signed with the old key, which blocks
 * installing the Play version. Set to true when Production is live, then
 * deploy the website (docs/PLAY_SUBMISSION.md).
 */
export const PLAY_LISTING_PUBLIC = false;
