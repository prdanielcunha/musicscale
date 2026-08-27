import { adminDb } from '../../services/firebaseAdmin.js';
import { analyzeGlobalSongBackfillDocument } from './globalSongBackfillAnalysis.js';

export interface GlobalSongsBackfillOptions {
    /** Computes the canonical delta without creating a Firestore batch or writing data. */
    dryRun?: boolean;
}

export async function backfillGlobalSongs(
    dbInstance = adminDb,
    options: GlobalSongsBackfillOptions = {},
) {
    if (!dbInstance) {
        throw new Error('Database instance missing.');
    }

    const dryRun = options.dryRun === true;
    console.log(`[Backfill] Starting ${dryRun ? 'dry-run ' : ''}globalSongs canonical normalization + search index + content metrics backfill...`);
    const limitAmount = 200;
    let query = dbInstance.collection('globalSongs').orderBy('__name__').limit(limitAmount);
    let keepGoing = true;

    let processedCount = 0;
    let updatedCount = 0;
    let normalizedUpdatedCount = 0;
    let searchUpdatedCount = 0;
    let contentMetricsUpdatedCount = 0;

    while (keepGoing) {
        const snapshot = await query.get();
        if (snapshot.empty) {
            break;
        }

        const batch = dryRun ? undefined : dbInstance.batch();
        let batchUpdates = 0;

        for (const doc of snapshot.docs) {
            const data = doc.data();
            processedCount++;

            const analysis = analyzeGlobalSongBackfillDocument(data);

            if (analysis.requiresUpdate) {
                if (!dryRun) {
                    batch.update(doc.ref, analysis.updates);
                }
                batchUpdates++;
                updatedCount++;
                if (Object.keys(analysis.normalized.updates).length > 0) normalizedUpdatedCount++;
                if (Object.keys(analysis.search.updates).length > 0) searchUpdatedCount++;
                if (Object.keys(analysis.contentMetrics.updates).length > 0) contentMetricsUpdatedCount++;
            }
        }

        if (!dryRun && batchUpdates > 0) {
            await batch.commit();
        }

        if (snapshot.size < limitAmount) {
            keepGoing = false;
        } else {
            const lastDoc = snapshot.docs[snapshot.docs.length - 1];
            query = dbInstance.collection('globalSongs').orderBy('__name__').startAfter(lastDoc).limit(limitAmount);
        }
    }

    console.log(`[Backfill] Finished globalSongs backfill. Processed: ${processedCount}. Updated: ${updatedCount}. Search updated: ${searchUpdatedCount}. Content metrics updated: ${contentMetricsUpdatedCount}.`);
    return {
        processed: processedCount,
        updated: updatedCount,
        normalizedUpdated: normalizedUpdatedCount,
        searchUpdated: searchUpdatedCount,
        contentMetricsUpdated: contentMetricsUpdatedCount,
    };
}
