import { db } from './services/firebase.js';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import * as dotenv from 'dotenv';
dotenv.config();

async function run() {
  try {
    const q = query(collection(db, 'organizations'), where('name', '>=', 'Fam'), where('name', '<=', 'Fam\uf8ff'), limit(10));
    const snap = await getDocs(q);
    console.log("Orgs found:", snap.docs.map(d => ({id: d.id, name: d.data().name})));
    process.exit(0);
  } catch(e) {
    console.error(e);
  }
}
run();
