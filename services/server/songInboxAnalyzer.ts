import { adminDb } from '../../services/firebaseAdmin.js';
import { runSongDiscoveryProcessor } from './songDiscoveryProcessor.js';
import { SongDiscoveryInboxRecord } from './songDiscoveryInboxService.js';
import { sanitizeFirestoreData } from './firestoreSanitizer.js';

/**
 * Analyzes records in the songDiscoveryInbox.
 */
export async function analyzeInboxBatch(limitAmount = 10, dbInstance = adminDb, organizationId?: string) {
    if (!dbInstance) {
        throw new Error('Database instance missing.');
    }

    let query = dbInstance.collection('songDiscoveryInbox')
        .where('status', 'in', ['pending', 'failed']);
        
    if (organizationId) {
        query = query.where('sourceOrganizationId', '==', organizationId);
    }
    
    const inboxQuery = await query
        .limit(limitAmount)
        .get();

    const payload = {
        processed: 0,
        summary: {
            likelyUnique: 0,
            possibleDuplicate: 0,
            matchedExisting: 0,
            insufficientData: 0,
            ignored: 0,
            errors: 0
        },
        results: [] as any[]
    };

    for (const doc of inboxQuery.docs) {
        const record = doc.data() as SongDiscoveryInboxRecord;
        const { sourceSongId, sourceOrganizationId, inboxId } = record;
        payload.processed++;

        try {
            await dbInstance.collection('songDiscoveryInbox').doc(inboxId).update({
                status: 'processing',
                attempts: record.attempts + 1,
                updatedAt: Date.now()
            });

            const songDoc = await dbInstance.collection('songs').doc(sourceSongId).get();
            const songData = songDoc.data();

            if (!songDoc.exists || !songData) {
                await updateInboxResult(dbInstance, inboxId, 'ignored', 'SOURCE_NOT_FOUND');
                payload.summary.ignored++;
                payload.results.push({ sourceSongId, analysisOutcome: 'ignored', title: record.title, artist: record.artist, reason: 'SOURCE_NOT_FOUND' });
                continue;
            }

            if (songData.deleted || songData.archived || songData.isDraft || songData.originGlobalSongId) {
                await updateInboxResult(dbInstance, inboxId, 'ignored', 'INELIGIBLE_SOURCE');
                payload.summary.ignored++;
                payload.results.push({ sourceSongId, analysisOutcome: 'ignored', title: record.title, artist: record.artist, reason: 'INELIGIBLE_SOURCE' });
                continue;
            }

            const processResult = await runSongDiscoveryProcessor(songData, sourceSongId, sourceOrganizationId, dbInstance);

            let analysisOutcome = 'error';
            let reason = processResult.reasonCode || '';

            if (processResult.reasonCode === 'MISSING_TITLE') {
                analysisOutcome = 'error';
            } else if (processResult.outcome === 'ignored' || processResult.outcome === 'not_found') {
                analysisOutcome = 'ignored';
            } else if (processResult.outcome === 'processed' || processResult.outcome === 'already_processed') {
                 analysisOutcome = processResult.candidateCreated ? 'likely_unique' : 'matched_existing'; 
                 if (processResult.candidateId) {
                     const candRef = await dbInstance.collection('globalLibraryCandidates').doc(processResult.candidateId).get();
                     if (candRef.exists) {
                         const cData = candRef.data();
                         const candidateClassification = cData?.classification || cData?.analysisSummary?.classification;
                         if (candidateClassification === 'insufficient_data') analysisOutcome = 'insufficient_data';
                         else if (candidateClassification === 'exact_match' || candidateClassification === 'high_confidence_match') analysisOutcome = 'matched_existing';
                         else if (candidateClassification === 'possible_duplicate') analysisOutcome = 'possible_duplicate';
                         else if (candidateClassification === 'likely_unique') analysisOutcome = 'likely_unique';
                     }
                 }
            } else if (processResult.outcome === 'failed') {
                 analysisOutcome = 'error';
            }

            await dbInstance.collection('songDiscoveryInbox').doc(inboxId).update(sanitizeFirestoreData({
                status: analysisOutcome === 'error' ? 'failed' : (analysisOutcome === 'ignored' ? 'ignored' : 'analyzed'),
                lastErrorCode: reason || null,
                candidateId: processResult.candidateId || null,
                updatedAt: Date.now()
            }));

            if (analysisOutcome === 'likely_unique') payload.summary.likelyUnique++;
            else if (analysisOutcome === 'possible_duplicate') payload.summary.possibleDuplicate++;
            else if (analysisOutcome === 'matched_existing') payload.summary.matchedExisting++;
            else if (analysisOutcome === 'insufficient_data') payload.summary.insufficientData++;
            else if (analysisOutcome === 'ignored') payload.summary.ignored++;
            else payload.summary.errors++;
            
            payload.results.push({ 
                sourceSongId, 
                analysisOutcome, 
                title: record.title,
                artist: record.artist,
                candidateId: processResult.candidateId,
                reason
            });

        } catch (err: any) {
             const errorMsg = err.message || String(err);
             await dbInstance.collection('songDiscoveryInbox').doc(inboxId).update({
                status: 'failed',
                lastErrorCode: errorMsg,
                updatedAt: Date.now()
             });
             payload.summary.errors++;
             payload.results.push({ sourceSongId, analysisOutcome: 'error', title: record.title, artist: record.artist, reason: errorMsg });
        }
    }

    return payload;
}

async function updateInboxResult(db: any, inboxId: string, status: string, errorCode: string | null = null) {
    await db.collection('songDiscoveryInbox').doc(inboxId).update(sanitizeFirestoreData({
        status,
        lastErrorCode: errorCode,
        updatedAt: Date.now()
    }));
}
