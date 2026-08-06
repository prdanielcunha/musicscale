import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { buildGlobalSongSearchFields, GLOBAL_SEARCH_VERSION } from '../../utils/searchEngine';
import * as dotenv from 'dotenv';
dotenv.config();

// Initialize Firebase Admin
// Make sure to set GOOGLE_APPLICATION_CREDENTIALS in your environment
const app = initializeApp();
const db = getFirestore(app);

const GLOBAL_SONGS_COLLECTION = 'globalSongs';

async function runBackfill(dryRun: boolean = true) {
  console.log(`Starting backfill for Global Search Fields... (Dry Run: ${dryRun}, Target Version: ${GLOBAL_SEARCH_VERSION})`);
  
  const batchSize = 100;
  let processed = 0;
  let updated = 0;
  let lastDoc: any = null;
  let hasMore = true;

  while (hasMore) {
    let q = db.collection(GLOBAL_SONGS_COLLECTION)
      .orderBy('__name__')
      .limit(batchSize);

    if (lastDoc) {
      q = q.startAfter(lastDoc);
    }

    const snapshot = await q.get();

    if (snapshot.empty) {
      hasMore = false;
      break;
    }

    const batch = db.batch();
    let batchUpdates = 0;

    for (const doc of snapshot.docs) {
      processed++;
      const data = doc.data();

      // Skip if already up-to-date (idempotency)
      if (data.searchVersion === GLOBAL_SEARCH_VERSION) {
        continue;
      }

      // Generate exact canonical search fields
      const searchFields = buildGlobalSongSearchFields(data);

      if (!dryRun) {
        batch.update(doc.ref, searchFields as any);
      }
      batchUpdates++;
      updated++;
    }

    if (!dryRun && batchUpdates > 0) {
      await batch.commit();
      console.log(`Committed batch of ${batchUpdates} updates.`);
    } else if (dryRun && batchUpdates > 0) {
      console.log(`[DRY RUN] Would commit batch of ${batchUpdates} updates.`);
    }

    lastDoc = snapshot.docs[snapshot.docs.length - 1];
  }

  console.log(`Backfill complete. Processed: ${processed}, Updated (or would update): ${updated}`);
}

// Execute
const isDryRun = !process.argv.includes('--execute');
runBackfill(isDryRun).catch(console.error);
