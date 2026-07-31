/// <reference types="vite/client" />
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { 
  initializeFirestore, 
  persistentLocalCache,
  persistentMultipleTabManager,
  getFirestore
} from 'firebase/firestore';
import prodFirebaseConfig from '../firebase-applet-config.json';

const isLocalhost = typeof window !== 'undefined' && 
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

const isE2E = import.meta.env.DEV && 
  import.meta.env.VITE_E2E_MODE === 'true' && 
  isLocalhost;

const firebaseConfig = isE2E 
  ? { ...prodFirebaseConfig, projectId: 'demo-musicscale', authDomain: 'demo-musicscale.firebaseapp.com' }
  : prodFirebaseConfig;

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);

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

if (isE2E) {
  // Conecta aos emuladores
  import('firebase/auth').then(({ connectAuthEmulator }) => {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  });
  import('firebase/firestore').then(({ connectFirestoreEmulator }) => {
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
  });
}

export { auth, db };
