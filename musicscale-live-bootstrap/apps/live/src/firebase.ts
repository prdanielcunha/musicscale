import { getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager
  type Firestore
} from 'firebase/firestore';

const firebaseConfig = {
  projectId: 'millionsnest',
  appId: '1:555464791734:web:6f916a69f26e74b9767817',
  apiKey: 'AIzaSyAhXY8TV8qoXz8Pd2u5jFHUTVssZmi3kMs',
  authDomain: 'millionsnest.firebaseapp.com',
  storageBucket: 'millionsnest.firebasestorage.app',
  messagingSenderId: '555464791734',
  measurementId: 'G-65C9S77CY5'
};

const app = getApps().length ? getApps()[0]! : initializeApp(firebaseConfig);
export const auth = getAuth(app);

let db: Firestore;
try {
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    ignoreUndefinedProperties: true
  });
} catch {
  db = getFirestore(app);
}

export { db };
