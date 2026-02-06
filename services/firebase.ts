import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache } from 'firebase/firestore';

// Configuration provided for the WALL-E app
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

// Initialize Firestore with persistent cache enabled via the new API
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache()
});

export default app;