
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

export { auth, db };

