/// <reference types="vite/client" />
import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { 
  initializeFirestore, 
  persistentLocalCache,
  persistentMultipleTabManager,
  getFirestore,
  connectFirestoreEmulator
} from 'firebase/firestore';
import prodFirebaseConfig from '../firebase-applet-config.json';
import { getFirebaseRuntimeConfig } from './firebaseRuntimeConfig';

const hostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost';

const { firebaseConfig, useEmulators } = getFirebaseRuntimeConfig({
  prodConfig: prodFirebaseConfig,
  isDev: import.meta.env.DEV,
  viteE2eMode: import.meta.env.VITE_E2E_MODE,
  viteE2eProjectId: import.meta.env.VITE_E2E_FIREBASE_PROJECT_ID,
  hostname
});

// Inicializa o Firebase
const app: FirebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// Obtém as instâncias dos serviços
const auth = getAuth(app);

// Inicializa o firestore
let db: any;
try {
  // Use persistentLocalCache to speed up loading
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    ignoreUndefinedProperties: true
  }, firebaseConfig.firestoreDatabaseId);
  console.log("[MusicScale Firebase] Firestore initialized with persistent cache.");
} catch (error) {
  console.warn("[MusicScale Firebase] Failed to initialize Firestore with persistent cache. Attempting to fallback.", error);
  db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
}

const globalAny = globalThis as any;
if (useEmulators && !globalAny.__FIREBASE_EMULATORS_CONNECTED__) {
  try {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
    globalAny.__FIREBASE_EMULATORS_CONNECTED__ = true;
    console.log("[MusicScale Firebase] Connected to Emulators synchronously.");
  } catch (error: any) {
    if (error.code !== 'auth/emulator-config-failed' && error.code !== 'failed-precondition') {
      throw error;
    }
  }
}

export { auth, db };
