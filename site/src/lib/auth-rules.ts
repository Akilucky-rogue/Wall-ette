// Sign-up and sign-in rules shared with the Wall·ette app (components/Auth.tsx),
// so an account made on the website signs in to the app and the other way round.

/** The app's password rule: 8+ characters, upper and lower case, a number and one of @$!%*?&. */
export const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
export const PASSWORD_HINT = "At least 8 characters, with an uppercase and a lowercase letter, a number and one of @ $ ! % * ? &.";

/** The terms people accept on signing up; the app records the same version. */
export const TERMS_VERSION = "2026-11-28";

/** Firebase Auth error codes, in the app's words. */
export function authMessage(code: string | undefined): string {
  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "That email and password don’t match an account. Check them, or create an account.";
    case "auth/email-already-in-use":
      return "This email already has a Wall·ette account. Sign in instead.";
    case "auth/weak-password":
    case "auth/password-does-not-meet-requirements":
      return PASSWORD_HINT;
    case "auth/invalid-email":
      return "Enter a valid email address.";
    case "auth/too-many-requests":
      return "Too many attempts. Wait a few minutes, then try again.";
    case "auth/network-request-failed":
      return "You’re offline. Connect to the internet and try again.";
    case "auth/invalid-verification-code":
    case "auth/totp-challenge-timeout":
      return "That code didn’t match. Check your authenticator app and try again.";
    case "auth/expired-action-code":
    case "auth/invalid-action-code":
      return "This link has expired or was already used. Ask for a new one.";
    default:
      return "Something went wrong. Please try again.";
  }
}

export const errorCode = (error: unknown): string | undefined =>
  typeof error === "object" && error !== null && "code" in error ? String((error as { code: unknown }).code) : undefined;
