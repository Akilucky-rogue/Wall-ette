import { initializeApp } from 'firebase/app';
import {
  getAuth,
  initializeAuth,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  indexedDBLocalPersistence,
  type Auth,
} from 'firebase/auth';
import { initializeFirestore, persistentLocalCache } from 'firebase/firestore';
import { Capacitor } from '@capacitor/core';
import { log } from '../utils/log';

// Configuration provided for the Wall-ette app
const firebaseConfig = {
  apiKey: "AIzaSyD-hkH72RsRSKwpltZQSZSfEzynqb8n4Os",
  authDomain: "wall-e-7a113.firebaseapp.com",
  projectId: "wall-e-7a113",
  storageBucket: "wall-e-7a113.firebasestorage.app",
  messagingSenderId: "881370415293",
  appId: "1:881370415293:web:46ddaf1f8ae83fcd1877d4",
  measurementId: "G-59W9LNWQ0K"
};

const app = initializeApp(firebaseConfig);

const isNativePlatform = Capacitor.isNativePlatform && Capacitor.isNativePlatform();

// Native (Capacitor): the session stays on the device (IndexedDB, with
// localStorage as a fallback), so it survives backgrounding and restarts.
// Started with initializeAuth and no popup/redirect helper: the app signs in
// with email and password (plus an authenticator code), never a Google popup
// or redirect. getAuth() would add that helper, and on Android it loads
// apis.google.com/js/api.js and an auth iframe before the signed-in user is
// known, so a slow or broken connection held start-up on the spinner (60 s
// per stalled request on the emulator).
//
// Web: getAuth() as before, with session persistence (cleared when the tab
// closes).
export const auth: Auth = isNativePlatform
  ? initializeAuth(app, { persistence: [indexedDBLocalPersistence, browserLocalPersistence] })
  : getAuth(app);

if (!isNativePlatform) {
  setPersistence(auth, browserSessionPersistence).catch(() => {
    log.warn('Failed to set session persistence');
  });
}

// Initialize Firestore with persistent cache enabled via the new API
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache()
});

export default app;
