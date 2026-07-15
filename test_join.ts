import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';

const config = require('./firebase-applet-config.json');

const app = initializeApp(config);
const db = getFirestore(app);

// ... wait, this won't have request.auth since it's client sdk without auth sign-in.
