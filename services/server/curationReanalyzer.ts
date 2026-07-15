import { adminDb } from '../../services/firebaseAdmin.js';
import { compareSongs } from '../../utils/songDiscovery/matcher.js';

export async function reanalyzeCandidates(dbInstance = adminDb) {
    if (!dbInstance) {
        throw new Error('Database missing');
    }

    const snapshot = await dbInstance.collection('globalLibraryCandidates')
        .where('status', 'in', ['pending', 'pending_review', 'processing_failed', 'insufficient_data'])
        .get();

    let processedCount = 0;
    const results = { reanalyzed: 0, failed: 0, likely_unique: 0, possible_duplicate: 0, matched_existing: 0, insufficient_data: 0 };

    for (const doc of snapshot.docs) {
        const candidateData = doc.data() as any;
        const identity = candidateData.canonicalIdentity;
        const candidateId = doc.id;
        
        if (!identity || !identity.normalizedTitle) continue;

        try {
            const globalSongsQuery = await dbInstance.collection('globalSongs')
              .where('normalizedTitle', '==', identity.normalizedTitle)
              .limit(10)
              .get();

            let bestGlobalMatch: any = null;
            const globalMatches: any[] = [];

            for (const gDoc of globalSongsQuery.docs) {
              const globalData = gDoc.data() as any;
              const gIdentity = {
                normalizedTitle: globalData.normalizedTitle || '',
                normalizedArtists: globalData.normalizedArtists || [],
                normalizedLyrics: globalData.normalizedLyrics || null,
                lyricsFingerprint: globalData.fingerprints?.lyrics || null,
                contentFingerprint: globalData.fingerprints?.content || null,
                originalTitle: globalData.title || '',
                openingLyrics: null,
                chorusLyrics: null,
                externalReferences: {}
              };

              const matchResult = compareSongs(identity, gIdentity as any);
              const matchObj = {
                globalSongId: gDoc.id,
                classification: matchResult.classification,
                overallScore: matchResult.overallScore,
                scores: matchResult.scores,
                reasonCodes: matchResult.reasons,
                warningCodes: matchResult.warnings,
                algorithmVersion: '1.0'
              };
              globalMatches.push(matchObj);

              if (!bestGlobalMatch || matchResult.overallScore > bestGlobalMatch.overallScore) {
                bestGlobalMatch = matchObj;
              }
            }

            globalMatches.sort((a, b) => b.overallScore - a.overallScore);

            const fallbackWarning = globalSongsQuery.empty ? 'SEARCH_LIMITED_NO_GLOBAL_MATCH' : null;
            let finalClassification = bestGlobalMatch?.classification || 'likely_unique';
            if (fallbackWarning === 'SEARCH_LIMITED_NO_GLOBAL_MATCH' || (fallbackWarning as string | null)?.includes('SEARCH_LIMITED')) {
                finalClassification = 'insufficient_data';
            }

            const updates: any = {
                'analysisSummary.classification': finalClassification,
                'analysisSummary.overallScore': bestGlobalMatch?.overallScore || 0,
                'analysisSummary.reasonCodes': bestGlobalMatch?.reasonCodes || [],
                'analysisSummary.warningCodes': fallbackWarning ? [fallbackWarning] : [],
                'analysisSummary.possibleMatchCount': globalMatches.length,
                status: finalClassification === 'processing_failed' ? 'processing_failed' : 'pending_review',
                classification: finalClassification,
                updatedAt: Date.now()
            };

            await dbInstance.collection('globalLibraryCandidates').doc(candidateId).update(updates);

            // Delete existing matches and insert new ones
            const existingMatches = await dbInstance.collection(`globalLibraryCandidates/${candidateId}/matches`).get();
            const b = dbInstance.batch();
            existingMatches.docs.forEach(mDoc => b.delete(mDoc.ref));
            
            const timestamp = Date.now();
            globalMatches.slice(0, 10).forEach(m => {
                const ref = dbInstance.collection(`globalLibraryCandidates/${candidateId}/matches`).doc();
                b.set(ref, {
                    ...m,
                    id: ref.id,
                    createdAt: timestamp,
                    updatedAt: timestamp
                });
            });

            await b.commit();

            results.reanalyzed++;
            if (finalClassification === 'likely_unique') results.likely_unique++;
            else if (finalClassification === 'possible_duplicate') results.possible_duplicate++;
            else if (finalClassification === 'matched_existing') results.matched_existing++;
            else if (finalClassification === 'insufficient_data') results.insufficient_data++;

        } catch (e) {
            results.failed++;
        }
    }

    return results;
}
