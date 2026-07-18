import { adminDb as db } from './services/firebaseAdmin.js';

async function run() {
  if (!db) { console.log("NO DB"); return; }
  const users = await db.collection('users').where('email', '==', 'pastordanielpcunha@gmail.com').get();
  if (users.empty) {
    console.log("User not found");
    return;
  }
  const userDoc = users.docs[0];
  const userData = userDoc.data();
  console.log("UID:", userDoc.id);
  console.log("User Org ID:", userData.organizationId);
  const orgId = userData.organizationId;

  const orgDoc = await db.collection('organizations').doc(orgId).get();
  const orgData = orgDoc.data() || {};
  console.log("Org apps.musicscale.status:", orgData.apps?.musicscale?.status);
  console.log("Org ownerUid:", orgData.ownerUid);

  const subSnap = await db.collection('subscriptions').doc(orgId).get();
  console.log("Sub exists:", subSnap.exists);
  if (subSnap.exists) {
    console.log("Sub status:", subSnap.data()?.status);
    console.log("Sub plan:", subSnap.data()?.plan);
  }

  const memberDoc = await db.collection('organizations').doc(orgId).collection('members').doc(userDoc.id).get();
  console.log("Member exists:", memberDoc.exists);
  if (memberDoc.exists) {
    console.log("Member status:", memberDoc.data()?.status);
    console.log("Member role:", memberDoc.data()?.organizationRole);
  }
  
  console.log("System Role:", userData.systemRole);
}
run().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
