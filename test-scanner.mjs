import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

let certData = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 ? Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf8') : '{}');

const app = initializeApp({ credential: cert(certData), projectId: certData.project_id || "music-scale-a590b" });
const db = getFirestore(app);

async function run() {
    console.log("Checking songs...");
    const snap = await db.collection("songs").limit(10).get();
    snap.forEach(doc => {
        console.log("Song:", doc.id, "Org:", doc.data().organizationId, "Title:", doc.data().title);
    });
}
run().catch(console.error).finally(() => process.exit(0));
