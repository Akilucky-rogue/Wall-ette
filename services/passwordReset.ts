/**
 * Password-reset emails, for the sign-in screen and the lock screen.
 *
 * Firebase sends the email and hosts the page where the new password is set
 * (the Firebase password policy holds it to the sign-up rules). Email
 * enumeration protection is off for this project, so Firebase says when no
 * account uses the address and the app can tell people, instead of promising
 * an email that never comes (docs/TECH_SPEC.md, Authentication).
 */
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from './firebase';
import { reportProblem } from './crashReports';

export type ResetResult =
  | { status: 'sent' }
  | { status: 'no-account' }
  | { status: 'failed'; message: string };

// Failures with a cause the person can fix; anything else is reported.
const EXPECTED = new Set([
  'auth/invalid-email',
  'auth/missing-email',
  'auth/too-many-requests',
  'auth/network-request-failed',
  'auth/user-disabled',
]);

/** What to say when the email couldn't be sent, by Firebase error code. */
export function resetFailureMessage(code: string): string {
  switch (code) {
    case 'auth/invalid-email':
    case 'auth/missing-email':
      return "That doesn't look like an email address. Check it and try again.";
    case 'auth/too-many-requests':
      return 'Too many reset emails in a short time. Wait a few minutes, then try again.';
    case 'auth/network-request-failed':
      return "You're offline. Connect to the internet and try again.";
    case 'auth/user-disabled':
      return 'This account has been turned off, so no reset email was sent.';
    case 'auth/quota-exceeded':
      return "Wall-ette can't send more emails right now. Try again in a few hours.";
    default:
      return "The reset email couldn't be sent. Try again in a minute.";
  }
}

/** Sends the reset email to `address`, or says why it didn't go. */
export async function sendResetLink(address: string): Promise<ResetResult> {
  try {
    await sendPasswordResetEmail(auth, address.trim());
    return { status: 'sent' };
  } catch (err: unknown) {
    const code = typeof (err as { code?: unknown })?.code === 'string' ? (err as { code: string }).code : '';
    if (code === 'auth/user-not-found') return { status: 'no-account' };
    if (!EXPECTED.has(code)) reportProblem('Password reset email failed', { code: code || 'unknown' });
    return { status: 'failed', message: resetFailureMessage(code) };
  }
}
