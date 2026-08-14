/// <reference types="vite/client" />
import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, initializeAuth, inMemoryPersistence, connectAuthEmulator } from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  memoryLocalCache,
  getFirestore,
  connectFirestoreEmulator
} from 'firebase/firestore';
import prodFirebaseConfig from '../firebase-applet-config.json';
import { getFirebaseRuntimeConfig } from './firebaseRuntimeConfig';

const hostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
const safeProcessEnv = typeof process !== 'undefined' ? process.env : {} as any;

const isDevMode = import.meta.env?.DEV ?? (safeProcessEnv.NODE_ENV !== 'production');
const e2eMode = import.meta.env?.VITE_E2E_MODE ?? safeProcessEnv.VITE_E2E_MODE;
const e2eProjectId = import.meta.env?.VITE_E2E_FIREBASE_PROJECT_ID ?? safeProcessEnv.VITE_E2E_FIREBASE_PROJECT_ID;

const { firebaseConfig, useEmulators } = getFirebaseRuntimeConfig({
  prodConfig: prodFirebaseConfig,
  isDev: isDevMode,
  viteE2eMode: e2eMode,
  viteE2eProjectId: e2eProjectId,
  hostname
});

const app: FirebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// Browser persistence is part of the real product session contract. Emulator/E2E
// contexts are disposable and isolated, and Firebase Auth browser persistence can
// stall completion of an otherwise successful mobile-emulator sign-in. Use memory
// persistence only in explicit emulator mode; production continues to use getAuth()
// and authService keeps the real Local/Session remember-me behavior.
let auth: ReturnType<typeof getAuth>;
if (useEmulators) {
  try {
    auth = initializeAuth(app, { persistence: inMemoryPersistence });
    console.log('[MusicScale Firebase] Auth initialized with in-memory persistence for Emulator.');
  } catch (error: any) {
    // HMR or another module may already have initialized Auth for this app.
    // Reuse the existing instance rather than creating a second Auth instance.
    auth = getAuth(app);
  }
} else {
  auth = getAuth(app);
}

let db: any;
const isTestEnv = typeof process !== 'undefined' && (safeProcessEnv.NODE_ENV === 'test' || safeProcessEnv.VITEST === 'true');

if (useEmulators) {
  // The WebKit Playwright projects can indefinitely buffer the Firestore WebChannel
  // streaming GET even after the Emulator accepts the Listen POST. Force long polling
  // only for Emulator/E2E so each response closes after data is delivered. Production
  // keeps the normal persistent cache and transport selection below.
  db = initializeFirestore(app, {
    localCache: memoryLocalCache(),
    experimentalForceLongPolling: true,
    experimentalLongPollingOptions: { timeoutSeconds: 10 },
    ignoreUndefinedProperties: true
  }, firebaseConfig.firestoreDatabaseId);
  console.log('[MusicScale Firebase] Firestore initialized with memory cache and forced long polling for Emulator.');
} else if (isTestEnv) {
  db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
  console.log('[MusicScale Firebase] Firestore initialized without persistent cache for Test environment.');
} else {
  try {
    db = initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
      ignoreUndefinedProperties: true
    }, firebaseConfig.firestoreDatabaseId);
    console.log("[MusicScale Firebase] Firestore initialized with persistent cache.");
  } catch (error) {
    console.warn("[MusicScale Firebase] Failed to initialize Firestore with persistent cache. Attempting to fallback.", error);
    db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
  }
}

const globalAny = globalThis as any;
if (useEmulators && !globalAny.__FIREBASE_EMULATORS_CONNECTED__) {
  const authHost = import.meta.env?.VITE_E2E_AUTH_EMULATOR_HOST || safeProcessEnv.VITE_E2E_AUTH_EMULATOR_HOST || '127.0.0.1';
  const authPort = Number(import.meta.env?.VITE_E2E_AUTH_EMULATOR_PORT || safeProcessEnv.VITE_E2E_AUTH_EMULATOR_PORT || 9099);

  const firestoreHost = import.meta.env?.VITE_E2E_FIRESTORE_EMULATOR_HOST || safeProcessEnv.VITE_E2E_FIRESTORE_EMULATOR_HOST || '127.0.0.1';
  const firestorePort = Number(import.meta.env?.VITE_E2E_FIRESTORE_EMULATOR_PORT || safeProcessEnv.VITE_E2E_FIRESTORE_EMULATOR_PORT || 8080);

  try {
    connectAuthEmulator(auth, `http://${authHost}:${authPort}`, { disableWarnings: true });
    connectFirestoreEmulator(db, firestoreHost, firestorePort);
    globalAny.__FIREBASE_EMULATORS_CONNECTED__ = true;
    console.log(`[MusicScale Firebase] Connected to Emulators synchronously at Auth: ${authHost}:${authPort}, Firestore: ${firestoreHost}:${firestorePort}`);
  } catch (error: any) {
    if (error.code !== 'auth/emulator-config-failed' && error.code !== 'failed-precondition') {
      throw error;
    }
  }
}

export { auth, db };
