import { adminDb } from '../../services/firebaseAdmin.js';
import { sanitizeFirestoreData } from './firestoreSanitizer.js';
import { normalizeBaseText } from '../../utils/songDiscovery/textNormalization.js';

export async function fixCandidatesWithoutTitle(dbInstance = adminDb) {
    if (!dbInstance) {
        throw new Error('Database instance missing.');
    }

    const snapshot = await dbInstance.collection('globalLibraryCandidates').get();
    
    let processed = 0;
    let fixed = 0;
    let failed = 0;

    for (const doc of snapshot.docs) {
        const data = doc.data();
        // Check if the candidate doesn't have a valid title
        if (!data.title || data.title === 'Sem Título' || data.title.trim() === '') {
            processed++;
            let newTitle = '';
            let newArtist = 'Desconhecido';
            const occurrencesSnap = await dbInstance.collection(`globalLibraryCandidates/${doc.id}/occurrences`).limit(1).get();

            if (data.snapshot && data.snapshot.title && data.snapshot.title !== 'Sem Título') {
                newTitle = data.snapshot.title;
                newArtist = data.snapshot.artist || 'Desconhecido';
            } else if (!occurrencesSnap.empty) {
                const occData = occurrencesSnap.docs[0].data();
                if (occData.snapshot && occData.snapshot.title && occData.snapshot.title !== 'Sem Título') {
                     newTitle = occData.snapshot.title;
                     newArtist = occData.snapshot.artist || 'Desconhecido';
                } else if (occData.source) {
                     const sourceOrg = occData.source.organizationId;
                     const sourceSong = occData.source.songId;
                     if (sourceOrg && sourceSong) {
                          const originSongRef = await dbInstance.collection(`organizations/${sourceOrg}/songs`).doc(sourceSong).get();
                          if (originSongRef.exists) {
                               const originData = originSongRef.data();
                               if (originData && originData.title && originData.title !== 'Sem Título') {
                                    newTitle = originData.title;
                                    newArtist = originData.artist || 'Desconhecido';
                               }
                          }
                     }
                }
            }

            if (newTitle && newTitle.trim() !== '') {
                 const normalizedTitle = normalizeBaseText(newTitle);
                 
                 // Fix candidate
                 await dbInstance.collection('globalLibraryCandidates').doc(doc.id).update(sanitizeFirestoreData({
                     title: newTitle,
                     artist: newArtist,
                     normalizedTitle: normalizedTitle,
                     'canonicalIdentity.normalizedTitle': normalizedTitle,
                     'canonicalIdentity.compactTitle': normalizedTitle.replace(/\\s+/g, '')
                 }));
                 fixed++;
            } else {
                 // Move to processing_failed
                 await dbInstance.collection('globalLibraryCandidates').doc(doc.id).update(sanitizeFirestoreData({
                     status: 'processing_failed',
                     classification: 'processing_failed',
                     'processing.lastErrorCode': 'missing_candidate_title',
                     'analysisSummary.classification': 'processing_failed'
                 }));
                 failed++;
            }
        }
    }

    return { processed, fixed, failed };
}
