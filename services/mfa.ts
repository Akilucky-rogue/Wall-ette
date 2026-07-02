/**
 * Real two-factor authentication via Firebase TOTP (authenticator apps like
 * Google Authenticator / Authy). Replaces the old simulated MFA.
 *
 * ONE-TIME CONSOLE PREREQUISITE (free):
 *   Firebase Console → Authentication → Sign-in method →
 *   "Upgrade to Identity Platform" → SMS multi-factor section →
 *   enable "Authenticator app (TOTP)".
 * Until that's enabled, enrollment throws `auth/operation-not-allowed`,
 * which the UI surfaces with instructions.
 */
import {
  multiFactor,
  getMultiFactorResolver,
  TotpMultiFactorGenerator,
  TotpSecret,
  type User,
  type MultiFactorError,
  type MultiFactorResolver,
  type UserCredential,
} from 'firebase/auth';
import { auth } from './firebase';
import { log } from '../utils/log';

export interface TotpEnrollmentStart {
  secret: TotpSecret;
  /** otpauth:// URI for QR codes and authenticator-app deep links */
  uri: string;
  /** Base32 secret for manual entry */
  secretKey: string;
}

/** Does the signed-in user already have a TOTP factor enrolled? */
export const isTotpEnrolled = (user: User): boolean =>
  multiFactor(user).enrolledFactors.some(f => f.factorId === TotpMultiFactorGenerator.FACTOR_ID);

/** Step 1 of enrollment: generate a secret (requires recent login). */
export async function startTotpEnrollment(user: User): Promise<TotpEnrollmentStart> {
  const session = await multiFactor(user).getSession();
  const secret = await TotpMultiFactorGenerator.generateSecret(session);
  const uri = secret.generateQrCodeUrl(user.email ?? 'Walter user', 'Walter');
  return { secret, uri, secretKey: secret.secretKey };
}

/** Step 2: confirm the 6-digit code from the authenticator app. */
export async function finishTotpEnrollment(
  user: User,
  secret: TotpSecret,
  code: string
): Promise<void> {
  const assertion = TotpMultiFactorGenerator.assertionForEnrollment(secret, code.trim());
  await multiFactor(user).enroll(assertion, 'Authenticator app');
}

/** Remove the TOTP factor (requires recent login). */
export async function unenrollTotp(user: User): Promise<void> {
  const factor = multiFactor(user).enrolledFactors
    .find(f => f.factorId === TotpMultiFactorGenerator.FACTOR_ID);
  if (factor) await multiFactor(user).unenroll(factor);
}

// ── Sign-in / reauth resolution ──────────────────────────────────────────────

export const isMfaRequiredError = (e: any): boolean =>
  e?.code === 'auth/multi-factor-auth-required';

/** Build a resolver from the multi-factor-auth-required error. */
export const mfaResolverFromError = (e: MultiFactorError): MultiFactorResolver =>
  getMultiFactorResolver(auth, e);

/** Complete sign-in (or reauth) with the 6-digit TOTP code. */
export async function resolveTotpSignIn(
  resolver: MultiFactorResolver,
  code: string
): Promise<UserCredential> {
  const hint = resolver.hints.find(h => h.factorId === TotpMultiFactorGenerator.FACTOR_ID);
  if (!hint) {
    log.warn('No TOTP factor on account');
    throw new Error('No authenticator app is enrolled on this account.');
  }
  const assertion = TotpMultiFactorGenerator.assertionForSignIn(hint.uid, code.trim());
  return resolver.resolveSignIn(assertion);
}

/** Human-readable messages for the common failure modes. */
export function mfaErrorMessage(e: any): string {
  switch (e?.code) {
    case 'auth/operation-not-allowed':
      return 'TOTP 2FA is not enabled for this Firebase project yet. Enable "Authenticator app" under Authentication → Sign-in method (Identity Platform).';
    case 'auth/invalid-verification-code':
    case 'auth/totp-challenge-timeout':
      return 'That code didn\'t match. Check your authenticator app and try again.';
    case 'auth/requires-recent-login':
      return 'For security, please log out and back in, then retry this action.';
    case 'auth/maximum-second-factor-count-exceeded':
      return 'An authenticator is already enrolled. Remove it first to enroll a new one.';
    default:
      return e?.message?.replace('Firebase: ', '') || 'Something went wrong. Please try again.';
  }
}
