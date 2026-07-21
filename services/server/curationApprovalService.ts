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
    decodedToken: { uid: string; hasCurationAccess?: boolean; [key: string]: any };
}

export class CurationError extends Error {
    constructor(
        public code: string,
        public safeMessage: string,
        public httpStatus: number,
        public duplicateGlobalSongId?: string
    ) {
        super(safeMessage);
        this.name = 'CurationError';
    }
}

export class CurationApprovalService {
    constructor(private deps: CurationApprovalDependencies) {}

    async approve(params: CurationApprovalParams) {
        const { db, admin, logger } = this.deps;
        const { candidateId, occurrenceId, idempotencyKey, decodedToken } = params;

        if (!candidateId || !occurrenceId || !idempotencyKey) {
            throw new CurationError('VALIDATION_ERROR', 'Parâmetros obrigatórios ausentes.', 400);
        }
        if (!decodedToken || !decodedToken.uid) {
            throw new CurationError('ACTOR_CONTEXT_MISSING', 'Contexto de usuário (ator) ausente ou inválido.', 401);
        }

        const candidateRef = db.collection('globalLibraryCandidates').doc(candidateId);
        const occurrenceRef = candidateRef.collection('occurrences').doc(occurrenceId);
        const reviewLogsCollection = candidateRef.collection('reviewLogs');
        const logRef = reviewLogsCollection.doc(`approve_${idempotencyKey}`);

        return await db.runTransaction(async (t: any) => {
            // === PHASE 1: READS ===
            const candidateSnap = await t.get(candidateRef);
            if (!candidateSnap.exists) {
                throw new CurationError('CANDIDATE_NOT_FOUND', 'Candidata não encontrada.', 404);
            }
            const candidateData = candidateSnap.data() as any;

            if (candidateData.status === 'approved') {
                if (candidateData.approvalIdempotencyKey === idempotencyKey) {
                    return { success: true, alreadyApproved: true, globalSongId: candidateData.resultingGlobalSongId };
                }
                throw new CurationError('IDEMPOTENCY_CONFLICT', 'Candidata já foi aprovada por outra operação/token.', 409);
            }
            if (!['pending_review', 'likely_unique'].includes(candidateData.status)) {
                throw new CurationError('CANDIDATE_STATE_INVALID', `Estado da candidata não permite aprovação. (Estado atual: ${candidateData.status})`, 400);
            }

            const occSnap = await t.get(occurrenceRef);
            if (!occSnap.exists) {
                throw new CurationError('OCCURRENCE_NOT_FOUND', 'Ocorrência-base não encontrada.', 404);
            }
            const occData = occSnap.data() as any;
            const snapshot = occData.snapshot;

            const occurrencesSnap = await t.get(candidateRef.collection('occurrences'));

            const canonical = candidateData.canonicalIdentity;
            if (!canonical) {
                throw new CurationError('CANONICAL_IDENTITY_INVALID', 'Identidade da candidata inválida ou ausente.', 400);
            }
            const normTitle = canonical.normalizedTitle?.trim() || '';
            const normArtists = canonical.normalizedArtists || [];
            
            const fLyrics = canonical.lyricsFingerprint?.trim() || '';
            const fContent = canonical.contentFingerprint?.trim() || '';
            const baseId = normTitle ? normTitle + "_" + normArtists.join('_') : '';
            
            const reservationId = fContent || fLyrics || baseId;

            if (!reservationId || reservationId === '_' || reservationId.trim() === '') {
                throw new CurationError('CANONICAL_IDENTITY_INVALID', 'Identidade da candidata inválida.', 400);
            }
            if (!normTitle) {
                throw new CurationError('CANONICAL_IDENTITY_INVALID', 'Identidade da candidata inválida (título normalizado ausente).', 400);
            }

            const reservationRef = db.collection('globalSongs_reservations').doc(reservationId);
            const reservationSnap = await t.get(reservationRef);

            const titleQuery = await t.get(
                db.collection('globalSongs').where('normalizedTitle', '==', normTitle)
            );

            const logSnap = await t.get(logRef);

            // Read all local songs
            const sourceSongRefs: { occDoc: any, songRef: any, songSnap: any, sourceOrg: string }[] = [];
            for (const occDoc of occurrencesSnap.docs) {
                const oData = occDoc.data() as any;
                const sourceOrg = oData.source?.organizationId;
                const sourceSongId = oData.source?.songId;
                if (sourceOrg && sourceSongId) {
                    const songRef = db.collection('songs').doc(sourceSongId);
                    const songSnap = await t.get(songRef);
                    sourceSongRefs.push({ occDoc, songRef, songSnap, sourceOrg });
                }
            }

            // === VALIDATIONS POST-READS ===
            if (reservationSnap.exists) {
                if (reservationSnap.data()?.candidateId !== candidateId) {
                    throw new CurationError("RESERVATION_COLLISION", "Colisão de reserva com outra candidata.", 409);
                }
            }

            for (const docSnap of titleQuery.docs) {
                const globalSong = docSnap.data();
                const comparisonObj = {
                    normalizedTitle: globalSong.normalizedTitle,
                    normalizedArtists: [globalSong.normalizedArtist].filter(Boolean),
                    originalTitle: globalSong.title,
                    originalArtist: globalSong.artist || '',
                    contentFingerprint: globalSong.contentFingerprint || null,
                    lyricsFingerprint: globalSong.lyricsFingerprint || null,
                    normalizedLyrics: globalSong.normalizedLyrics || null,
                    openingLyrics: globalSong.openingLyrics || null,
                    chorusLyrics: globalSong.chorusLyrics || null,
                    externalReferences: globalSong.externalReferences || {}
                };
                
                const comparison = compareSongs(comparisonObj as any, canonical);
                if (comparison.classification === 'exact_match' || comparison.classification === 'high_confidence_match') {
                    throw new CurationError('DUPLICATE_GLOBAL_SONG', 'Duplicata global detectada.', 409, docSnap.id);
                }
            }

            // Validate Source Songs to avoid SOURCE_ORGANIZATION_MISMATCH
            for (const item of sourceSongRefs) {
                if (!item.songSnap.exists) {
                    throw new CurationError('SOURCE_SONG_NOT_FOUND', `Música de origem não encontrada: ${item.songRef.id}`, 400);
                }
                const songData = item.songSnap.data();
                if (songData.organizationId !== item.sourceOrg) {
                    throw new CurationError('SOURCE_ORGANIZATION_MISMATCH', `Música de origem não pertence à organização informada.`, 403);
                }
            }

            // === PHASE 2: WRITES ===
            const globalSongRef = db.collection('globalSongs').doc();

            if (!reservationSnap.exists) {
                t.set(reservationRef, { candidateId, createdAt: admin.firestore.FieldValue.serverTimestamp() });
            }

            const primaryArtist = normArtists[0] || snapshot.artist || '';
            const newGlobalSong = {
                title: snapshot.title,
                normalizedTitle: normTitle,
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
                externalReferences: canonical.externalReferences || {},
                contentFingerprint: canonical.contentFingerprint || null,
                lyricsFingerprint: canonical.lyricsFingerprint || null,
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

            // Keep track of updated source songs to avoid duplicate updates (same source song in two occurrences)
            const updatedSongIds = new Set<string>();
            for (const item of sourceSongRefs) {
                if (!updatedSongIds.has(item.songRef.id)) {
                    t.update(item.songRef, {
                        originGlobalSongId: globalSongRef.id,
                        updatedAt: admin.firestore.FieldValue.serverTimestamp()
                    });
                    updatedSongIds.add(item.songRef.id);
                }
            }

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
