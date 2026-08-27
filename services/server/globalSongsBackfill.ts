import { adminDb } from '../../services/firebaseAdmin.js';
import { buildGlobalSongSearchFields, type GlobalSongSearchFields } from '../../utils/searchEngine.js';
import { normalizeBaseText } from '../../utils/songDiscovery/textNormalization.js';
import { deriveGlobalSongContentMetrics } from '../../utils/globalSongContentMetrics.js';

function arraysEqual(left: unknown, right: string[]): boolean {
    return Array.isArray(left)
        && left.length === right.length
        && left.every((value, index) => value === right[index]);
}

function collectSearchFieldUpdates(data: any, canonical: GlobalSongSearchFields): Record<string, any> {
    const updates: Record<string, any> = {};

    if (data.searchVersion !== canonical.searchVersion) updates.searchVersion = canonical.searchVersion;
    if (!arraysEqual(data.searchTokens, canonical.searchTokens)) updates.searchTokens = canonical.searchTokens;
    if (!arraysEqual(data.searchContentTokens, canonical.searchContentTokens)) updates.searchContentTokens = canonical.searchContentTokens;
    if (!arraysEqual(data.searchTitlePrefixes, canonical.searchTitlePrefixes)) updates.searchTitlePrefixes = canonical.searchTitlePrefixes;
    if (!arraysEqual(data.searchArtistPrefixes, canonical.searchArtistPrefixes)) updates.searchArtistPrefixes = canonical.searchArtistPrefixes;
    if (!arraysEqual(data.searchTitleGrams, canonical.searchTitleGrams)) updates.searchTitleGrams = canonical.searchTitleGrams;
    if (!arraysEqual(data.searchArtistGrams, canonical.searchArtistGrams)) updates.searchArtistGrams = canonical.searchArtistGrams;
    if (!arraysEqual(data.searchKeyTokens, canonical.searchKeyTokens)) updates.searchKeyTokens = canonical.searchKeyTokens;

    return updates;
}

function collectContentMetricUpdates(data: any): Record<string, boolean> {
    const canonical = deriveGlobalSongContentMetrics({
        chords: data.chords,
        lyrics: data.lyrics,
    });
    const updates: Record<string, boolean> = {};

    if (data.hasChords !== canonical.hasChords) updates.hasChords = canonical.hasChords;
    if (data.hasLyrics !== canonical.hasLyrics) updates.hasLyrics = canonical.hasLyrics;
    if (data.isComplete !== canonical.isComplete) updates.isComplete = canonical.isComplete;

    return updates;
}

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

            const updates: Record<string, any> = {};
            let normalizedChanged = false;

            const correctNormalizedTitle = normalizeBaseText(data.title || '');
            if (!data.normalizedTitle || data.normalizedTitle !== correctNormalizedTitle) {
                updates.normalizedTitle = correctNormalizedTitle;
                normalizedChanged = true;
            }

            if (data.artist) {
                const correctNormalizedArtist = normalizeBaseText(data.artist);
                const currentPrimaryArtist = data.normalizedArtists && data.normalizedArtists.length > 0 ? data.normalizedArtists[0] : null;
                if (currentPrimaryArtist !== correctNormalizedArtist) {
                    updates.normalizedArtists = [correctNormalizedArtist];
                    normalizedChanged = true;
                }
            }

            const canonicalSearchFields = buildGlobalSongSearchFields(data);
            const searchUpdates = collectSearchFieldUpdates(data, canonicalSearchFields);
            const searchChanged = Object.keys(searchUpdates).length > 0;
            Object.assign(updates, searchUpdates);

            const contentMetricUpdates = collectContentMetricUpdates(data);
            const contentMetricsChanged = Object.keys(contentMetricUpdates).length > 0;
            Object.assign(updates, contentMetricUpdates);

            if (Object.keys(updates).length > 0) {
                if (!dryRun) {
                    batch.update(doc.ref, updates);
                }
                batchUpdates++;
                updatedCount++;
                if (normalizedChanged) normalizedUpdatedCount++;
                if (searchChanged) searchUpdatedCount++;
                if (contentMetricsChanged) contentMetricsUpdatedCount++;
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
