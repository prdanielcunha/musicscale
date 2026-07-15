import { adminDb } from '../../services/firebaseAdmin.js';
import { normalizeBaseText } from '../../utils/songDiscovery/textNormalization.js';

export async function backfillGlobalSongs(dbInstance = adminDb) {
    if (!dbInstance) {
        throw new Error('Database instance missing.');
    }

    console.log('[Backfill] Starting globalSongs normalizedTitle backfill...');
    const limitAmount = 200;
    let query = dbInstance.collection('globalSongs').orderBy('__name__').limit(limitAmount);
    let keepGoing = true;

    let processedCount = 0;
    let updatedCount = 0;

    while (keepGoing) {
        const snapshot = await query.get();
        if (snapshot.empty) {
            break;
        }

        const batch = dbInstance.batch();
        let batchUpdates = 0;

        for (const doc of snapshot.docs) {
            const data = doc.data();
            processedCount++;

            let needsUpdate = false;
            const updates: any = {};

            const correctNormalizedTitle = normalizeBaseText(data.title || '');
            if (!data.normalizedTitle || data.normalizedTitle !== correctNormalizedTitle) {
                updates.normalizedTitle = correctNormalizedTitle;
                needsUpdate = true;
            }

            if (data.artist) {
                const correctNormalizedArtist = normalizeBaseText(data.artist);
                const currentPrimaryArtist = data.normalizedArtists && data.normalizedArtists.length > 0 ? data.normalizedArtists[0] : null;
                if (currentPrimaryArtist !== correctNormalizedArtist) {
                    updates.normalizedArtists = [correctNormalizedArtist];
                    needsUpdate = true;
                }
            }

            if (needsUpdate) {
                batch.update(doc.ref, updates);
                batchUpdates++;
                updatedCount++;
            }
        }

        if (batchUpdates > 0) {
            await batch.commit();
        }

        if (snapshot.size < limitAmount) {
            keepGoing = false;
        } else {
            const lastDoc = snapshot.docs[snapshot.docs.length - 1];
            query = dbInstance.collection('globalSongs').orderBy('__name__').startAfter(lastDoc).limit(limitAmount);
        }
    }

    console.log(`[Backfill] Finished globalSongs backfill. Processed: ${processedCount}. Updated: ${updatedCount}.`);
    return { processed: processedCount, updated: updatedCount };
}
