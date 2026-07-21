import * as crypto from 'crypto';
import { compareSongs } from '../../utils/songDiscovery/matcher.js';

export interface CurationApprovalDependencies {
    db: any;
    admin: any;
    logger: any;
}

export interface CurationApprovalParams {
    candidateId: string;
    occurrenceId: string;
    idempotencyKey: string;
    decodedToken: { uid: string; [key: string]: any };
}

export class CurationApprovalService {
    constructor(private deps: CurationApprovalDependencies) {}

    async approve(params: CurationApprovalParams) {
        const { db, admin } = this.deps;
        const { candidateId, occurrenceId, idempotencyKey, decodedToken } = params;

        if (!candidateId || !occurrenceId || !idempotencyKey) {
            throw new Error("Parâmetros obrigatórios ausentes.");
        }
        if (!decodedToken || !decodedToken.uid) {
            throw new Error("Contexto de usuário (ator) ausente ou inválido.");
        }

        const candidateRef = db.collection('globalLibraryCandidates').doc(candidateId);
        const occurrenceRef = candidateRef.collection('occurrences').doc(occurrenceId);
        
        return await db.runTransaction(async (t: any) => {
            const candidateSnap = await t.get(candidateRef);
            if (!candidateSnap.exists) {
                throw new Error("Candidata não encontrada.");
            }
            const candidateData = candidateSnap.data() as any;
            
            if (candidateData.status === 'approved') {
                if (candidateData.approvalIdempotencyKey === idempotencyKey) {
                    return { success: true, alreadyApproved: true, globalSongId: candidateData.resultingGlobalSongId };
                }
                throw new Error("Candidata já foi aprovada por outra operação/token.");
            }
            if (!['pending_review', 'likely_unique'].includes(candidateData.status)) {
                throw new Error(`Estado da candidata não permite aprovação. (Estado atual: ${candidateData.status})`);
            }

            const occSnap = await t.get(occurrenceRef);
            if (!occSnap.exists) {
                throw new Error("Ocorrência-base não encontrada.");
            }
            
            const occData = occSnap.data() as any;
            const snapshot = occData.snapshot;

            // Read occurrences in the read phase to comply with transaction constraints
            const occurrencesSnap = await t.get(candidateRef.collection('occurrences'));

            // Trava Determinística na rechecagem
            const fLyrics = candidateData.canonicalIdentity?.lyricsFingerprint || '';
            const fContent = candidateData.canonicalIdentity?.contentFingerprint || '';
            const baseId = candidateData.canonicalIdentity?.normalizedTitle + "_" + (candidateData.canonicalIdentity?.normalizedArtists?.join('_') || '');
            
            const reservationId = fContent || fLyrics || baseId;
            
            if (!reservationId || reservationId === '_') {
                throw new Error("Identidade da candidata inválida.");
            }

            const reservationRef = db.collection('globalSongs_reservations').doc(reservationId);
            const reservationSnap = await t.get(reservationRef);
            if (reservationSnap.exists) {
                if (reservationSnap.data()?.candidateId !== candidateId) {
                    throw new Error("ABORT_RESERVATION_COLLISION");
                }
            } else {
                t.set(reservationRef, { candidateId, createdAt: admin.firestore.FieldValue.serverTimestamp() });
            }

            // Rechecagem Dinâmica Avançada contra Biblioteca Viva Global
            const titleQuery = await t.get(
                db.collection('globalSongs').where('normalizedTitle', '==', candidateData.canonicalIdentity.normalizedTitle)
            );
            
            for (const docSnap of titleQuery.docs) {
                const globalSong = docSnap.data();
                const comparisonObj = {
                    normalizedTitle: globalSong.normalizedTitle,
                    normalizedArtists: [globalSong.normalizedArtist].filter(Boolean),
                    originalTitle: globalSong.title,
                    originalArtist: globalSong.artist || '',
                    contentFingerprint: null,
                    externalReferences: {}
                };
                const comparison = compareSongs(comparisonObj as any, candidateData.canonicalIdentity);
                if (comparison.classification === 'exact_match' || comparison.classification === 'high_confidence_match') {
                    throw new Error(`ABORT_DUPLICATE|${docSnap.id}`);
                }
            }

            const globalSongRef = db.collection('globalSongs').doc();
            
            const primaryArtist = (candidateData.canonicalIdentity.normalizedArtists || [])[0] || snapshot.artist || '';
            // Apenas campos públicos. Nada de sourceOccurrenceId, notes, scores.
            const newGlobalSong = {
                title: snapshot.title,
                normalizedTitle: candidateData.canonicalIdentity.normalizedTitle,
                artist: snapshot.artist || '',
                normalizedArtist: primaryArtist,
                key: snapshot.originalKey || snapshot.key || 'C',
                bpm: snapshot.bpm || null,
                rhythm: snapshot.rhythm || null,
                chords: snapshot.chords || '',
                lyrics: snapshot.lyrics || '',
                sections: snapshot.sections || [],
                language: snapshot.language || 'pt',
                tags: snapshot.tagIds || snapshot.tags || [],
                videoUrl: snapshot.videoUrl || '',
                videos: snapshot.videos || [],
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                createdBy: decodedToken.uid,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                status: 'active',
                importCount: 0
            };

            t.set(globalSongRef, newGlobalSong);
            
            t.update(candidateRef, {
                status: 'approved',
                resultingGlobalSongId: globalSongRef.id,
                approvalIdempotencyKey: idempotencyKey,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            // Update the original song documents in organization collections
            for (const occDoc of occurrencesSnap.docs) {
                const oData = occDoc.data() as any;
                if (oData.source?.organizationId && oData.source?.songId) {
                    const songRef = db.collection('songs').doc(oData.source.songId);
                    t.update(songRef, {
                        originGlobalSongId: globalSongRef.id,
                        updatedAt: admin.firestore.FieldValue.serverTimestamp()
                    });
                }
            }

            // Usa o ID deterministico do log para evitar logs duplicados e gravar procedência privadamente
            const logRef = candidateRef.collection('reviewLogs').doc(`approve_${idempotencyKey}`);
            const logSnap = await t.get(logRef);
            if (!logSnap.exists) {
                const correlationId = crypto.createHash('sha256').update(idempotencyKey).digest('hex');
                const serverTimestamp = admin.firestore.FieldValue.serverTimestamp();
                const logData = {
                    eventType: 'approved',
                    actorType: 'admin',
                    actorId: decodedToken.uid,
                    resultingGlobalSongId: globalSongRef.id,
                    schemaVersion: 1,
                    correlationId: correlationId,
                    timestamp: serverTimestamp,
                    
                    metadata: {
                        sourceOrganizationId: occData.source?.organizationId || null,
                        sourceSongId: occData.source?.songId || null,
                        sourceCandidateId: candidateId,
                    },

                    // Legacy fallbacks for historical code compatibility
                    action: 'approved_as_new',
                    actorUid: decodedToken.uid,
                    createdAt: serverTimestamp
                };
                t.set(logRef, logData);
            }

            return { success: true, globalSongId: globalSongRef.id };
        });
    }
}
