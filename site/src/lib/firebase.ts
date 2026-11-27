// Firebase for the website: the same project as the Wall·ette app, so an
// account made here is the account the app signs in to.
//
// Pages are rendered at build time in Node, where Firebase must not start, so
// everything here loads on first use in the browser (from a click or an
// effect), never at import.
import type { FirebaseApp } from "firebase/app";
import type { Auth } from "firebase/auth";
import type { Firestore } from "firebase/firestore";

// Public web configuration (the same as the app's services/firebase.ts).
const CONFIG = {
  apiKey: "AIzaSyD-hkH72RsRSKwpltZQSZSfEzynqb8n4Os",
  authDomain: "wall-e-7a113.firebaseapp.com",
  projectId: "wall-e-7a113",
  storageBucket: "wall-e-7a113.firebasestorage.app",
  messagingSenderId: "881370415293",
  appId: "1:881370415293:web:46ddaf1f8ae83fcd1877d4",
};

let appPromise: Promise<FirebaseApp> | undefined;
let authPromise: Promise<Auth> | undefined;
let dbPromise: Promise<Firestore> | undefined;

function app(): Promise<FirebaseApp> {
  appPromise ??= import("firebase/app").then(({ initializeApp, getApps }) => getApps()[0] ?? initializeApp(CONFIG));
  return appPromise;
}

/**
 * Firebase Auth, kept for this browser tab as the web app keeps it, so
 * signing in here and opening /app in the same tab is one sign-in.
 */
export function firebaseAuth(): Promise<Auth> {
  authPromise ??= Promise.all([app(), import("firebase/auth")]).then(async ([a, m]) => {
    const auth = m.getAuth(a);
    await m.setPersistence(auth, m.browserSessionPersistence).catch(() => {});
    return auth;
  });
  return authPromise;
}

export function firestore(): Promise<Firestore> {
  dbPromise ??= Promise.all([app(), import("firebase/firestore")]).then(([a, m]) => m.getFirestore(a));
  return dbPromise;
}

/** Where people go once signed in: the web app, beside this site. */
export const APP_URL = "/app";
