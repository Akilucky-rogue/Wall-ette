// Sign in with Google on the website, in a popup: the same Firebase account
// as the Wall·ette app (services/googleSignIn.ts there). A first sign-in
// creates the account, with the consent the note beside the button asks for
// recorded as an email sign-up's is.
import type { MultiFactorResolver } from "firebase/auth";
import { firebaseAuth, firestore } from "@/lib/firebase";
import { TERMS_VERSION, errorCode } from "@/lib/auth-rules";

export type GoogleOutcome =
  | { status: "signed-in" }
  | { status: "cancelled" }
  | { status: "second-factor"; resolver: MultiFactorResolver }
  | { status: "failed"; message: string };

export async function continueWithGoogle(): Promise<GoogleOutcome> {
  const [auth, m] = await Promise.all([firebaseAuth(), import("firebase/auth")]);
  const provider = new m.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  try {
    const credential = await m.signInWithPopup(auth, provider);
    if (m.getAdditionalUserInfo(credential)?.isNewUser) {
      try {
        const [db, f] = await Promise.all([firestore(), import("firebase/firestore")]);
        await f.setDoc(f.doc(db, "users", credential.user.uid), { termsAccepted: true, termsVersion: TERMS_VERSION, termsAcceptedAt: f.serverTimestamp(), termsAcceptedVia: "google" }, { merge: true });
      } catch {
        // The account exists either way.
      }
    }
    return { status: "signed-in" };
  } catch (e) {
    const code = errorCode(e);
    if (code === "auth/multi-factor-auth-required") return { status: "second-factor", resolver: m.getMultiFactorResolver(auth, e as Parameters<typeof m.getMultiFactorResolver>[1]) };
    if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") return { status: "cancelled" };
    return { status: "failed", message: googleMessage(code) };
  }
}

/** A failed Google sign-in, in the app's words. */
export function googleMessage(code: string | undefined): string {
  switch (code) {
    case "auth/popup-blocked":
      return "Your browser blocked Google’s window. Allow pop-ups for this site and try again.";
    case "auth/account-exists-with-different-credential":
      return "This email already has a Wall·ette password. Sign in with your email and password.";
    case "auth/network-request-failed":
      return "You’re offline. Connect to the internet and try again.";
    case "auth/operation-not-allowed":
    case "auth/unauthorized-domain":
      return "Google sign-in isn’t switched on yet. Use your email for now.";
    case "auth/user-disabled":
      return "This account has been switched off. Write to us from the Contact page.";
    case "auth/too-many-requests":
      return "Too many attempts. Wait a few minutes, then try again.";
    default:
      return "Google sign-in didn’t work. Try again, or use your email.";
  }
}
