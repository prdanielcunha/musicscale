import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, writeBatch, serverTimestamp, query, where } from 'firebase/firestore';
import { getAuth, signInWithCustomToken } from 'firebase/auth';
import admin from 'firebase-admin';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf-8'));
const app = initializeApp(config);
const db = getFirestore(app);

const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 
    ? JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString()) 
    : {};
if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

async function test() {
    const customToken = await admin.auth().createCustomToken('oJpA9s3f9zXUOhO1s687QO8Qf502'); // pastor's uid
    
    const auth = getAuth(app);
    await signInWithCustomToken(auth, customToken);
    
    const orgQuery = query(collection(db, "organizations"), where("ownerUid", "==", auth.currentUser?.uid));
    const orgs = await getDocs(orgQuery);
    const orgId = orgs.docs[0]?.id || "DbbO2A8Bv9yP3WlIavsZ";

    console.log("Reading eventTypes for org:", orgId);
    const q = query(collection(db, "eventTypes"), where("organizationId", "==", orgId));
    const snap = await getDocs(q);
    const orgEvents = snap.docs;
    console.log(`Found ${orgEvents.length} eventTypes.`);

    if (orgEvents.length > 0) {
        const item = orgEvents[0];
        console.log("Attempting to update item:", item.id);
        const batch = writeBatch(db);
        batch.update(item.ref, {
            name: item.data().name + " - edited",
            lastModifiedAt: serverTimestamp()
        });
        
        const auditRef = doc(collection(db, 'audits'));
        batch.set(auditRef, {
            action: 'UPDATE',
            targetCollection: 'eventTypes',
            targetId: item.id,
            details: { name: "test" },
            user: { uid: auth.currentUser?.uid },
            organizationId: orgId,
            timestamp: serverTimestamp()
        });
        
        try {
            await batch.commit();
            console.log("Update SUCCESS!");
        } catch (err) {
            console.error("Update FAILED:", err);
        }
    }
    
    process.exit(0);
}

test().catch(console.error);
