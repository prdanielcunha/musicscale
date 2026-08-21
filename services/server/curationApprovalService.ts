import * as crypto from 'crypto';
import { compareSongs } from '../../utils/songDiscovery/matcher.js';
import { buildGlobalSongSearchFields } from '../../utils/searchEngine.js';

function normalizedOptionalString(value: unknown, fieldName: string, errorCode: any): string | null {
    if (value === undefined || value === null) return null;
    if (typeof value !== 'string') {
        throw new CurationError(errorCode, 'Campo ' + fieldName + ' possui tipo inválido.', 400);
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

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

export type CurationErrorCode =
| "VALIDATION_ERROR"
| "ACTOR_CONTEXT_MISSING"
| "CURATION_ACCESS_DENIED"
| "CANDIDATE_NOT_FOUND"
| "CANDIDATE_STATE_INVALID"
| "OCCURRENCE_NOT_FOUND"
| "OCCURRENCE_SNAPSHOT_INVALID"
| "CANONICAL_IDENTITY_INVALID"
| "IDEMPOTENCY_CONFLICT"
| "RESERVATION_COLLISION"
| "DUPLICATE_GLOBAL_SONG"
| "SOURCE_SONG_NOT_FOUND"
| "SOURCE_ORGANIZATION_MISMATCH"
| "SOURCE_OCCURRENCE_CONFLICT"
| "TRANSACTION_FAILED"

| "INTERNAL_CURATION_ROUTE_ERROR";

export class CurationError extends Error {
    constructor(
        public code: CurationErrorCode,
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

        const safeCandidateId = normalizedOptionalString(candidateId, 'candidateId', 'VALIDATION_ERROR');
        const safeOccurrenceId = normalizedOptionalString(occurrenceId, 'occurrenceId', 'VALIDATION_ERROR');
        const safeIdempotencyKey = normalizedOptionalString(idempotencyKey, 'idempotencyKey', 'VALIDATION_ERROR');

        if (!safeCandidateId || safeCandidateId.length > 200 || 
            !safeOccurrenceId || safeOccurrenceId.length > 200 || 
            !safeIdempotencyKey || safeIdempotencyKey.length > 200 || 
            /[\x00-\x1F\x7F]/.test(safeCandidateId) || 
            /[\x00-\x1F\x7F]/.test(safeOccurrenceId) || 
            /[\x00-\x1F\x7F]/.test(safeIdempotencyKey)) {
            throw new CurationError('VALIDATION_ERROR', 'Parâmetros obrigatórios ausentes ou inválidos.', 400);
        }
        const safeUid = normalizedOptionalString(decodedToken?.uid, 'uid', 'ACTOR_CONTEXT_MISSING');
        if (!decodedToken || !safeUid) {
            throw new CurationError('ACTOR_CONTEXT_MISSING', 'Contexto de usuário (ator) ausente.', 401);
        }
        if (decodedToken.hasCurationAccess !== true) {
            throw new CurationError('CURATION_ACCESS_DENIED', 'Acesso de curadoria negado no serviço.', 403);
        }

        const candidateRef = db.collection('globalLibraryCandidates').doc(safeCandidateId);
        const occurrenceRef = candidateRef.collection('occurrences').doc(safeOccurrenceId);
        const reviewLogsCollection = candidateRef.collection('reviewLogs');
        const logRef = reviewLogsCollection.doc(`approve_${safeIdempotencyKey}`);

        try {
            return await db.runTransaction(async (t: any) => {
            // === PHASE 1: READS ===
            const candidateSnap = await t.get(candidateRef);
            if (!candidateSnap.exists) {
                throw new CurationError('CANDIDATE_NOT_FOUND', 'Candidata não encontrada.', 404);
            }
            const candidateData = candidateSnap.data() as any;

            if (candidateData.status === 'approved') {
                if (candidateData.approvalIdempotencyKey === safeIdempotencyKey) {
                    return { success: true, alreadyApproved: true, globalSongId: candidateData.resultingGlobalSongId };
                }
                throw new CurationError('IDEMPOTENCY_CONFLICT', 'Candidata já foi aprovada por outra requisição.', 409);
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
            const normTitle = normalizedOptionalString(canonical.normalizedTitle, 'normalizedTitle', 'CANONICAL_IDENTITY_INVALID') || '';
            if (canonical.normalizedArtists !== undefined && !Array.isArray(canonical.normalizedArtists)) {
                throw new CurationError('CANONICAL_IDENTITY_INVALID', 'normalizedArtists deve ser um array.', 400);
            }
            const normArtistsArray = Array.isArray(canonical.normalizedArtists) ? canonical.normalizedArtists : [];
            const normArtists = normArtistsArray.filter((a: any) => normalizedOptionalString(a, 'normalizedArtists item', 'CANONICAL_IDENTITY_INVALID') !== null).map((a: any) => a.trim());
            
            const fLyrics = normalizedOptionalString(canonical.lyricsFingerprint, 'lyricsFingerprint', 'CANONICAL_IDENTITY_INVALID') || '';
            const fContent = normalizedOptionalString(canonical.contentFingerprint, 'contentFingerprint', 'CANONICAL_IDENTITY_INVALID') || '';
            const baseId = normTitle ? normTitle + "_" + normArtists.join('_') : '';
            
            const reservationId = fContent || fLyrics || baseId;

            if (!normalizedOptionalString(reservationId, 'reservationId', 'CANONICAL_IDENTITY_INVALID') || reservationId === '_') {
                throw new CurationError('CANONICAL_IDENTITY_INVALID', 'Identidade da candidata inválida (título normalizado ausente).', 400);
            }
            if (!normTitle) {
                throw new CurationError('CANONICAL_IDENTITY_INVALID', 'Identidade da candidata inválida (título normalizado ausente).', 400);
            }
            
            const safeCanonical = {
                ...canonical,
                normalizedTitle: normTitle,
                normalizedArtists: normArtists,
                externalReferences: (canonical.externalReferences ? (typeof canonical.externalReferences === "object" && !Array.isArray(canonical.externalReferences) ? canonical.externalReferences : (() => { throw new CurationError('CANONICAL_IDENTITY_INVALID', 'externalReferences invalido', 400) })()) : {}),
                contentFingerprint: fContent || null,
                lyricsFingerprint: fLyrics || null,
                normalizedLyrics: normalizedOptionalString(canonical.normalizedLyrics, 'normalizedLyrics', 'CANONICAL_IDENTITY_INVALID'),
                openingLyrics: normalizedOptionalString(canonical.openingLyrics, 'openingLyrics', 'CANONICAL_IDENTITY_INVALID'),
                chorusLyrics: normalizedOptionalString(canonical.chorusLyrics, 'chorusLyrics', 'CANONICAL_IDENTITY_INVALID'),
            };

            // VALIDATE SNAPSHOT (REQ 8)
            if (!snapshot || typeof snapshot !== 'object') {
                throw new CurationError('OCCURRENCE_SNAPSHOT_INVALID', 'Snapshot da ocorrência ausente ou inválido.', 400);
            }
            if (!normalizedOptionalString(snapshot.title, 'snapshot.title', 'OCCURRENCE_SNAPSHOT_INVALID')) {
                throw new CurationError('OCCURRENCE_SNAPSHOT_INVALID', 'Snapshot não possui título válido.', 400);
            }
            
            if (occData.source) {
                normalizedOptionalString(occData.source.organizationId, 'source.organizationId', 'OCCURRENCE_SNAPSHOT_INVALID');
                normalizedOptionalString(occData.source.songId, 'source.songId', 'OCCURRENCE_SNAPSHOT_INVALID');
            }

            const reservationRef = db.collection('globalSongs_reservations').doc(reservationId);
            const reservationSnap = await t.get(reservationRef);

            const titleQuery = await t.get(
                db.collection('globalSongs').where('normalizedTitle', '==', normTitle)
            );

            const logSnap = await t.get(logRef);

            // Read all local songs
            const sourceSongMap = new Map<string, { songRef: any, songSnap: any, sourceOrg: string }>();
            for (const occDoc of occurrencesSnap.docs) {
                const oData = occDoc.data() as any;
                const sourceOrg = normalizedOptionalString(oData.source?.organizationId, 'source.organizationId', 'OCCURRENCE_SNAPSHOT_INVALID');
                const sourceSongId = normalizedOptionalString(oData.source?.songId, 'source.songId', 'OCCURRENCE_SNAPSHOT_INVALID');
                if (sourceOrg && sourceSongId) {
                    if (sourceSongMap.has(sourceSongId)) {
                        if (sourceSongMap.get(sourceSongId)!.sourceOrg !== sourceOrg) {
                            throw new CurationError('SOURCE_OCCURRENCE_CONFLICT', 'Mesmo songId com múltiplas organizações.', 409);
                        }
                        continue; // Already processed
                    }
                    const songRef = db.collection('songs').doc(sourceSongId);
                    const songSnap = await t.get(songRef);
                    sourceSongMap.set(sourceSongId, { songRef, songSnap, sourceOrg });
                }
            }

            // === VALIDATIONS POST-READS ===
            if (reservationSnap.exists) {
                if (reservationSnap.data()?.candidateId !== safeCandidateId) {
                    throw new CurationError("RESERVATION_COLLISION", "Colisão de reserva com outra candidata.", 409);
                }
            }

            for (const docSnap of titleQuery.docs) {
                const globalSong = docSnap.data();
                const comparisonObj = {
                    normalizedTitle: globalSong.normalizedTitle,
                    normalizedArtists: Array.isArray(globalSong.normalizedArtists) ? globalSong.normalizedArtists : (globalSong.normalizedArtist ? [globalSong.normalizedArtist] : []),
                    originalTitle: globalSong.title,
                    originalArtist: globalSong.artist || '',
                    contentFingerprint: globalSong.contentFingerprint || null,
                    lyricsFingerprint: globalSong.lyricsFingerprint || null,
                    normalizedLyrics: globalSong.normalizedLyrics || null,
                    openingLyrics: globalSong.openingLyrics || null,
                    chorusLyrics: globalSong.chorusLyrics || null,
                    externalReferences: globalSong.externalReferences && typeof globalSong.externalReferences === 'object' ? globalSong.externalReferences : {}
                };
                
                const comparison = compareSongs(comparisonObj as any, safeCanonical as any);
                if (comparison.classification === 'exact_match' || comparison.classification === 'high_confidence_match') {
                    throw new CurationError('DUPLICATE_GLOBAL_SONG', 'Música duplicada encontrada na rechecagem', 409, docSnap.id);
                }
            }

            // Validate Source Songs to avoid SOURCE_ORGANIZATION_MISMATCH
            for (const item of sourceSongMap.values()) {
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
                t.set(reservationRef, { candidateId: safeCandidateId, createdAt: admin.firestore.FieldValue.serverTimestamp() });
            }

            const primaryArtist = normArtists[0] || snapshot.artist || '';
            const safeSnapshotTitle = normalizedOptionalString(snapshot.title, 'snapshot.title', 'OCCURRENCE_SNAPSHOT_INVALID')!;
            const newGlobalSong = {
                title: safeSnapshotTitle,
                normalizedTitle: safeCanonical.normalizedTitle,
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
                externalReferences: safeCanonical.externalReferences,
                contentFingerprint: safeCanonical.contentFingerprint,
                lyricsFingerprint: safeCanonical.lyricsFingerprint,
                normalizedLyrics: safeCanonical.normalizedLyrics,
                openingLyrics: safeCanonical.openingLyrics,
                chorusLyrics: safeCanonical.chorusLyrics,
                normalizedArtists: safeCanonical.normalizedArtists,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                createdBy: safeUid,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                status: 'active',
                importCount: 0
            };
            const indexedGlobalSong = {
                ...newGlobalSong,
                ...buildGlobalSongSearchFields(newGlobalSong),
            };
            t.set(globalSongRef, indexedGlobalSong);

            t.update(candidateRef, {
                status: 'approved',
                resultingGlobalSongId: globalSongRef.id,
                approvalIdempotencyKey: safeIdempotencyKey,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            // Update all local songs exactly once
            for (const item of sourceSongMap.values()) {
                t.update(item.songRef, {
                    originGlobalSongId: globalSongRef.id,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
            }

            if (!logSnap.exists) {
                const correlationId = crypto.createHash('sha256').update(safeIdempotencyKey).digest('hex');
                const serverTimestamp = admin.firestore.FieldValue.serverTimestamp();
                const logData = {
                    eventType: 'approved',
                    actorType: 'admin',
                    actorId: safeUid,
                    resultingGlobalSongId: globalSongRef.id,
                    schemaVersion: 1,
                    correlationId: correlationId,
                    timestamp: serverTimestamp,
                    metadata: {
                        sourceOrganizationId: occData.source?.organizationId || null,
                        sourceSongId: occData.source?.songId || null,
                        sourceCandidateId: safeCandidateId,
                    },
                    action: 'approved_as_new',
                    actorUid: safeUid,
                    createdAt: serverTimestamp
                };
                t.set(logRef, logData);
            }

            return { success: true, globalSongId: globalSongRef.id };
        });
        } catch (e: any) {
            if (e instanceof CurationError) throw e;
            throw new CurationError('TRANSACTION_FAILED', 'Erro inesperado na transação de curadoria.', 500);
        }
    }
}
