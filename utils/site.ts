/**
 * The app's public web address (Firebase Hosting, custom domain). The
 * policy pages are in public/; wall-e-7a113.web.app serves the same site.
 */
export const SITE_HOST = 'wall-ette.com';
export const SITE_URL = `https://${SITE_HOST}`;
export const PRIVACY_URL = `${SITE_URL}/privacy.html`;
export const TERMS_URL = `${SITE_URL}/terms.html`;

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
