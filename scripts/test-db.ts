import { adminDb, adminAuth } from '../services/firebaseAdmin.js';
async function run() {
  try {
     const snap = await adminAuth!.listUsers(1);
     console.log("Success! users:", snap.users.length);
  } catch (e: any) {
     console.log("Error:", e.message);
  }
}
run();
