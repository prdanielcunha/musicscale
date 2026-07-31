/// <reference types="vite/client" />

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { 
  initializeFirestore, 
  persistentLocalCache,
  persistentMultipleTabManager,
  getFirestore
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);

// Obtém as instâncias dos serviços
const auth = getAuth(app);

// Conecta aos emuladores se VITE_E2E_MODE estiver ativo (preferred option)
if (import.meta.env.VITE_E2E_MODE === 'true' || import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true') {
  const { connectAuthEmulator } = await import('firebase/auth');
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
}

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

if (import.meta.env.VITE_E2E_MODE === 'true' || import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true') {
  const { connectFirestoreEmulator } = await import('firebase/firestore');
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
}

export { auth, db };

