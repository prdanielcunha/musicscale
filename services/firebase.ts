/// <reference types="vite/client" />
import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, onAuthStateChanged } from 'firebase/auth';
import { 
  initializeFirestore, 
  persistentLocalCache,
  persistentMultipleTabManager,
  getFirestore,
  connectFirestoreEmulator,
  doc,
  onSnapshot
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

// Inicializa o Firebase
const app: FirebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// Obtém as instâncias dos serviços
const auth = getAuth(app);

// Inicializa o firestore
let db: any;
const isTestEnv = typeof process !== 'undefined' && (safeProcessEnv.NODE_ENV === 'test' || safeProcessEnv.VITEST === 'true');
const shouldDisablePersistentCache = isTestEnv || useEmulators;

if (shouldDisablePersistentCache) {
  db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
  console.log(
    useEmulators
      ? '[MusicScale Firebase] Firestore initialized without persistent cache for Emulator.'
      : '[MusicScale Firebase] Firestore initialized without persistent cache for Test environment.'
  );
} else {
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

// Firestore 12.x can hit the ca9 -> b815 target teardown race when a cold
// memory-cache client starts with a transient getDoc(). E2E uses the emulator
// with persistence intentionally disabled, so keep the signed-in user's document
// listener alive for the authenticated session. Production keeps its existing
// persistent-cache path unchanged.
if (useEmulators && !globalAny.__MUSICSCALE_E2E_FIRESTORE_BOOTSTRAP__) {
  let unsubscribeUserDocument: (() => void) | null = null;

  const unsubscribeBootstrapAuth = onAuthStateChanged(auth, (user) => {
    if (unsubscribeUserDocument) {
      unsubscribeUserDocument();
      unsubscribeUserDocument = null;
    }

    if (!user) return;

    unsubscribeUserDocument = onSnapshot(
      doc(db, 'users', user.uid),
      () => {
        // Intentionally kept open. This stabilizes the emulator's cold listen
        // stream before EcosystemContext performs its transient bootstrap reads.
      },
      (error) => {
        console.warn('[MusicScale Firebase] E2E bootstrap user listener failed:', error);
      }
    );
  });

  globalAny.__MUSICSCALE_E2E_FIRESTORE_BOOTSTRAP__ = {
    unsubscribe: () => {
      if (unsubscribeUserDocument) unsubscribeUserDocument();
      unsubscribeBootstrapAuth();
    }
  };
}

export { auth, db };
