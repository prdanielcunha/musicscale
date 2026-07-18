import { adminAuth as auth } from './services/firebaseAdmin.js';

async function run() {
  const token = await auth.createCustomToken('EPymQj34Tof3smPuNd3Z8yM4Cw13');
  console.log("TOKEN:", token);
}
run().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
