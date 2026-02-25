import { initializeApp } from 'firebase/app';
import { getAuth, setPersistence, browserSessionPersistence, indexedDBLocalPersistence } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache } from 'firebase/firestore';

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
export const auth = getAuth(app);

// Set session persistence based on platform
// For mobile: use session persistence (clears on app close)
// For web: use local persistence (stays logged in)
import { Capacitor } from '@capacitor/core';
const isNativePlatform = Capacitor.isNativePlatform && Capacitor.isNativePlatform();
if (isNativePlatform) {
  setPersistence(auth, indexedDBLocalPersistence).catch((error) => {
    console.warn('Failed to set local persistence:', error);
  });
  console.log('Mobile platform detected - Local persistence enabled (session survives background)');
} else {
  setPersistence(auth, browserSessionPersistence).catch((error) => {
    console.warn('Failed to set session persistence:', error);
  });
}

// Initialize Firestore with persistent cache enabled via the new API
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache()
});

export default app;