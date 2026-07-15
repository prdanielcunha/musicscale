import { Firestore, FieldValue } from 'firebase-admin/firestore';
import { runSongDiscoveryProcessor } from './songDiscoveryProcessor.js';
import { sanitizeFirestoreData } from './firestoreSanitizer.js';

export async function preVerifyCandidates(db: Firestore, target: string, candidateIds: string[] = []) {
    let idsToCheck = candidateIds;

    if (target === 'all') {
        const query = await db.collection('globalLibraryCandidates')
            .where('status', '==', 'pending_review')
            .where('classification', '==', 'likely_unique')
            .get();
        idsToCheck = query.docs.map(doc => doc.id);
    }

    const results = [];

    for (const candId of idsToCheck) {
        const candDoc = await db.collection('globalLibraryCandidates').doc(candId).get();
        if (!candDoc.exists) {
            results.push({
                candidateId: candId,
                title: 'Desconhecida',
                artist: 'Desconhecida',
                sourceOrganizationName: 'Desconhecida',
                state: 'invalid_candidate',
                reason: 'Candidata não encontrada no banco de dados.'
            });
            continue;
        }

        const data = candDoc.data()!;
        
        if (!data.title || !data.artist) {
             results.push({
                candidateId: candId,
                title: data.title || 'Sem título',
                artist: data.artist || 'Sem artista',
                sourceOrganizationName: data.organizationName || '',
                state: 'invalid_candidate',
                reason: 'Dados obrigatórios ausentes.'
            });
            continue;
        }

        const normalizedTitle = typeof data.title === 'string' 
                ? data.title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim()
                : '';
                
        const exactMatchQuery = await db.collection('globalSongs')
            .where('normalizedTitle', '==', normalizedTitle)
            .limit(1)
            .get();

        if (!exactMatchQuery.empty) {
             const existing = exactMatchQuery.docs[0].data();
             results.push({
                 candidateId: candId,
                 title: data.title,
                 artist: data.artist,
                 sourceOrganizationName: data.organizationName || '',
                 state: 'already_exists',
                 matchedGlobalSong: {
                     id: exactMatchQuery.docs[0].id,
                     title: existing.title,
                     artist: existing.artist
                 },
                 reason: 'Música com o mesmo título já foi importada ou existia na Biblioteca.'
             });
             continue;
        }

        results.push({
            candidateId: candId,
            title: data.title,
            artist: data.artist,
            sourceOrganizationName: data.organizationName || '',
            state: 'ready_to_import',
            reason: 'Nenhuma correspondência exata de título encontrada. Pronta para criação.'
        });
    }

    return results;
}

export async function bulkImportCandidates(db: Firestore, candidateIds: string[], resolvedBy: string) {
    const importResults = [];

    for (const candId of candidateIds) {
        try {
             const candRef = db.collection('globalLibraryCandidates').doc(candId);
             
             // Use transaction or simple check? Simple check first, but let's do a robust sequence.
             const candDoc = await candRef.get();
             if (!candDoc.exists) {
                 importResults.push({ id: candId, status: 'error', reason: 'Not found' });
                 continue;
             }

             const data = candDoc.data()!;
             if (data.status !== 'pending_review' && data.status !== 'unresolved') {
                 importResults.push({ id: candId, status: 'ignored', reason: 'Status is not pending_review' });
                 continue;
             }

             // Re-verify inside the import execution
             const normalizedTitle = typeof data.title === 'string' 
                    ? data.title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim()
                    : '';
             
             const exactMatchQuery = await db.collection('globalSongs')
                .where('normalizedTitle', '==', normalizedTitle)
                .limit(1)
                .get();

             if (!exactMatchQuery.empty) {
                 // Already exists, update candidate to already_exists / matched_existing concept 
                 // and keep pending or convert to something else
                 const globalId = exactMatchQuery.docs[0].id;
                 await candRef.update(sanitizeFirestoreData({
                     classification: 'matched_existing',
                     'analysisSummary.classification': 'exact_match',
                     'analysisSummary.matchedGlobalSongId': globalId,
                     updatedAt: Date.now()
                 }));
                 importResults.push({ id: candId, status: 'already_exists', reason: 'Concurrent creation detected' });
                 continue;
             }

             // Create Global Song
             const globalRef = db.collection('globalSongs').doc();
             
             const whitelist = [
                 'title', 'normalizedTitle', 'artist', 'normalizedArtist', 'key', 'originalKey', 
                 'bpm', 'rhythm', 'chords', 'lyrics', 'sections', 'language', 'tags', 'tagIds', 
                 'videoUrl', 'videos', 'fingerprints'
             ];

             const payload: any = {};
             for (const field of whitelist) {
                 if (data[field] !== undefined) {
                     payload[field] = data[field];
                 }
             }

             payload.status = 'published';
             payload.createdAt = Date.now();
             payload.updatedAt = Date.now();
             payload.importCount = data.occurrences?.length || data.occurrenceCount || 1;

             await globalRef.set(sanitizeFirestoreData(payload));

             // Update candidate
             await candRef.update(sanitizeFirestoreData({
                 status: 'approved',
                 approvedGlobalSongId: globalRef.id,
                 updatedAt: Date.now()
             }));

             // Log to private audit
             await db.collection('curationAuditLogs').add(sanitizeFirestoreData({
                 candidateId: candId,
                 action: 'BULK_IMPORT',
                 globalSongId: globalRef.id,
                 resolvedBy,
                 timestamp: Date.now()
             }));

             importResults.push({ id: candId, status: 'imported', globalSongId: globalRef.id });

        } catch (err: any) {
             importResults.push({ id: candId, status: 'error', reason: err.message });
        }
    }

    return importResults;
}
