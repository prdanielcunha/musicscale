import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

let certData = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 ? Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf8') : '{}');

const app = initializeApp({ credential: cert(certData), projectId: certData.project_id || "music-scale-a590b" });
const db = getFirestore(app);

async function run() {
    try {
        const orgs = await db.collection("organizations").limit(2).get();
        const orgId = orgs.docs[0].id;
        console.log("Checking songs for org:", orgId);
        
        const q = db.collection("songs").where("organizationId", "==", orgId).offset(5).limit(5);
        const snap = await q.get();
        console.log("Got", snap.size, "songs with offset 5");
    } catch (e) {
        console.error("Query failed:", e.message);
    }
}
run().catch(console.error).finally(() => process.exit(0));
