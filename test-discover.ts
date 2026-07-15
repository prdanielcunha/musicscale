import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { runSongDiscoveryProcessor } from './services/server/songDiscoveryProcessor.js';

let certData = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 ? Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf8') : '{}');
const app = initializeApp({ credential: cert(certData), projectId: certData.project_id || "music-scale-a590b" });
const db = getFirestore(app);

async function run() {
    const orgs = await db.collection("organizations").limit(1).get();
    const oid = orgs.docs[0].id;

    console.log("Org:", oid);
    const songs = await db.collection("songs").where("organizationId", "==", oid).limit(10).get();
    
    if (songs.empty) { console.log("No songs"); return; }
    for (const song of songs.docs) {
       console.log("Song:", song.data().title);
       const result = await runSongDiscoveryProcessor(song.data(), song.id, oid, db);
       console.log("Result:", result);
    }
}
run().catch(console.error).finally(() => process.exit(0));
