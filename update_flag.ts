import { adminDb as db } from './services/firebaseAdmin.js';
async function run() {
  const orgId = "JPrzMnxJu77hTLJtu7FT";
  await db.collection("organizations").doc(orgId).set({
    featureFlags: {
      "musicscale.scaleResponsesV1": true
    }
  }, { merge: true });
  console.log("Flag updated");
}
run();
