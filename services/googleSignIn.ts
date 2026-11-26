/**
 * Sign in with Google.
 *
 * Android: Google's own account picker (Android's Credential Manager, through
 * @capgo/capacitor-social-login) returns an ID token issued for this Firebase
 * project's web client, and Firebase signs in with that. No web page or popup
 * is involved, so it works inside the app's WebView, and Firebase Auth needs
 * no popup helper (services/firebase.ts).
 * Web (wall-ette.com/app): Firebase's Google popup.
 *
 * Outside the code (docs/PLAY_SUBMISSION.md, "Sign in with Google"): the Google
 * provider switched on in Firebase Authentication; the SHA-1 of every key that
 * signs an installed copy (debug, upload, Play app signing) on the Android app
 * in Firebase project settings; and wall-ette.com among the authorized domains.
 */
import { Capacitor } from '@capacitor/core';
import {
  GoogleAuthProvider,
  getAdditionalUserInfo,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  signInWithCredential,
  signInWithPopup,
  type User,
  type UserCredential,
} from 'firebase/auth';
import { auth } from './firebase';

/**
 * The Firebase project's Web OAuth client ("Web client (auto created by Google
 * Service)"): the audience Google issues the ID token for. Public, not a secret.
 */
export const GOOGLE_WEB_CLIENT_ID = '881370415293-3n8j6fo1j38ch0mq1m2588osgpp2ddub.apps.googleusercontent.com';

const native = () => Capacitor.isNativePlatform();

type SocialLoginPlugin = typeof import('@capgo/capacitor-social-login')['SocialLogin'];
let ready: Promise<SocialLoginPlugin> | null = null;

function plugin(): Promise<SocialLoginPlugin> {
  ready ??= import('@capgo/capacitor-social-login')
    .then(async ({ SocialLogin }) => {
      // Only the ID token is needed, so the extra authorization step that can
      // stall on Capacitor's stock activity is skipped.
      await SocialLogin.initialize({ google: { webClientId: GOOGLE_WEB_CLIENT_ID, skipAuthOnlyAuthorizationAfterSignIn: true } });
      return SocialLogin;
    })
    .catch((e) => { ready = null; throw e; });
  return ready;
}

/** Google's ID token for the account the person picks (Android). */
async function nativeIdToken(): Promise<string> {
  const SocialLogin = await plugin();
  const res = await SocialLogin.login({ provider: 'google', options: {} });
  const token = (res?.result as { idToken?: string | null } | undefined)?.idToken;
  if (!token) throw Object.assign(new Error('Google returned no ID token'), { code: 'google/no-token' });
  return token;
}

function popupProvider(): GoogleAuthProvider {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  return provider;
}

/** Signs in (or creates the account, the first time) with Google. */
export async function signInWithGoogle(): Promise<{ credential: UserCredential; isNewUser: boolean }> {
  const credential = native()
    ? await signInWithCredential(auth, GoogleAuthProvider.credential(await nativeIdToken()))
    : await signInWithPopup(auth, popupProvider());
  return { credential, isNewUser: getAdditionalUserInfo(credential)?.isNewUser ?? false };
}

/** Confirms it's still them, for the lock screen and account deletion. */
export async function reauthenticateWithGoogle(user: User): Promise<void> {
  if (native()) await reauthenticateWithCredential(user, GoogleAuthProvider.credential(await nativeIdToken()));
  else await reauthenticateWithPopup(user, popupProvider());
}

/** After sign-out: the next Google sign-in shows the account picker again (Android). */
export async function forgetGoogleAccount(): Promise<void> {
  if (!native()) return;
  try {
    await (await plugin()).logout({ provider: 'google' });
  } catch {
    /* nothing to forget */
  }
}

export const signsInWithGoogle = (user: User | null | undefined): boolean =>
  !!user?.providerData?.some((p) => p.providerId === 'google.com');

export const hasPassword = (user: User | null | undefined): boolean =>
  !!user?.providerData?.some((p) => p.providerId === 'password');

const codeOf = (e: unknown): string =>
  typeof e === 'object' && e !== null && 'code' in e ? String((e as { code: unknown }).code) : '';
const messageOf = (e: unknown): string =>
  typeof e === 'object' && e !== null && 'message' in e ? String((e as { message: unknown }).message) : String(e ?? '');

/** They closed Google's picker or popup: nothing to report. */
export function isGoogleCancel(e: unknown): boolean {
  const code = codeOf(e);
  return code === 'USER_CANCELLED'
    || code === 'auth/popup-closed-by-user'
    || code === 'auth/cancelled-popup-request'
    || /cancell?ed by (the )?user/i.test(messageOf(e));
}

/** A failed Google sign-in, in the app's words. */
export function googleErrorMessage(e: unknown): string {
  const code = codeOf(e);
  const message = messageOf(e);
  switch (code) {
    case 'auth/network-request-failed':
      return "You're offline. Connect to the internet and try again.";
    case 'auth/account-exists-with-different-credential':
      return 'This email already has a Wall·ette password. Sign in with your email and password.';
    case 'auth/user-mismatch':
      return "That's a different Google account. Choose the one you use for Wall·ette.";
    case 'auth/user-disabled':
      return 'This account has been switched off. Write to us from the About page.';
    case 'auth/operation-not-allowed':
    case 'auth/unauthorized-domain':
      return "Google sign-in isn't switched on yet. Use your email for now.";
    case 'auth/popup-blocked':
      return "Your browser blocked Google's window. Allow pop-ups for this site and try again.";
    case 'auth/too-many-requests':
      return 'Too many attempts. Wait a few minutes, then try again.';
    case 'auth/invalid-credential':
    case 'google/no-token':
      return "Google couldn't confirm your account. Try again.";
  }
  if (/not configured for this installed build|28444|28404|Developer console/i.test(message)) {
    return "Google sign-in isn't set up for this copy of Wall·ette yet. Use your email for now.";
  }
  if (/No credentials? available|no viable credential/i.test(message)) {
    return 'There’s no Google account on this phone. Add one in Settings, then try again.';
  }
  return "Google sign-in didn't work. Try again, or use your email.";
}
