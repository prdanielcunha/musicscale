import * as crypto from 'node:crypto';
import { Firestore, FieldValue } from 'firebase-admin/firestore';
import { runSongDiscoveryProcessor } from './songDiscoveryProcessor.js';
import { sanitizeFirestoreData } from './firestoreSanitizer.js';
import { buildGlobalSongSearchFields } from '../../utils/searchEngine.js';

function normalizeSongIdentityValue(value: unknown): string {
    return typeof value === 'string'
        ? value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim()
        : '';
}

function buildBulkGlobalSongIdentity(title: unknown, artist: unknown) {
    const normalizedTitle = normalizeSongIdentityValue(title);
    const normalizedArtist = normalizeSongIdentityValue(artist);

    if (!normalizedTitle || !normalizedArtist) return null;

    const digest = crypto
        .createHash('sha256')
        .update(`${normalizedTitle}\u0000${normalizedArtist}`)
        .digest('hex');

    return {
        normalizedTitle,
        normalizedArtist,
        globalSongId: `bulk_${digest}`
    };
}

function findExactGlobalSongMatchInDocs(docs: any[], normalizedArtist: string) {
    return docs.find((doc) => {
        const existing = doc.data();
        const existingNormalizedArtist = normalizeSongIdentityValue(
            existing.normalizedArtist || existing.artist
        );
        return existingNormalizedArtist === normalizedArtist;
    }) || null;
}

async function findExactGlobalSongMatch(db: Firestore, title: unknown, artist: unknown) {
    const identity = buildBulkGlobalSongIdentity(title, artist);
    if (!identity) return null;

    const sameTitleQuery = await db.collection('globalSongs')
        .where('normalizedTitle', '==', identity.normalizedTitle)
        .get();

    return findExactGlobalSongMatchInDocs(sameTitleQuery.docs, identity.normalizedArtist);
}

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

        const exactMatchDoc = await findExactGlobalSongMatch(db, data.title, data.artist);

        if (exactMatchDoc) {
             const existing = exactMatchDoc.data();
             results.push({
                 candidateId: candId,
                 title: data.title,
                 artist: data.artist,
                 sourceOrganizationName: data.organizationName || '',
                 state: 'already_exists',
                 matchedGlobalSong: {
                     id: exactMatchDoc.id,
                     title: existing.title,
                     artist: existing.artist
                 },
                 reason: 'Música com o mesmo título e artista já foi importada ou existia na Biblioteca.'
             });
             continue;
        }

        results.push({
            candidateId: candId,
            title: data.title,
            artist: data.artist,
            sourceOrganizationName: data.organizationName || '',
            state: 'ready_to_import',
            reason: 'Nenhuma correspondência exata de título e artista encontrada. Pronta para criação.'
        });
    }

    return results;
}

export async function bulkImportCandidates(db: Firestore, candidateIds: string[], resolvedBy: string) {
    const importResults = [];

    for (const candId of candidateIds) {
        try {
            const candRef = db.collection('globalLibraryCandidates').doc(candId);
            const auditRef = db.collection('curationAuditLogs').doc();

            const result = await db.runTransaction(async (transaction) => {
                const candDoc = await transaction.get(candRef);
                if (!candDoc.exists) {
                    return { id: candId, status: 'error', reason: 'Not found' };
                }

                const data = candDoc.data()!;

                if (data.status === 'approved' && data.approvedGlobalSongId) {
                    return {
                        id: candId,
                        status: 'already_exists',
                        globalSongId: data.approvedGlobalSongId,
                        reason: 'Candidate already approved'
                    };
                }

                if (data.status !== 'pending_review' && data.status !== 'unresolved') {
                    return { id: candId, status: 'ignored', reason: 'Status is not pending_review' };
                }

                const identity = buildBulkGlobalSongIdentity(data.title, data.artist);
                if (!identity) {
                    return { id: candId, status: 'error', reason: 'Missing title or artist' };
                }

                const titleQuery = db.collection('globalSongs')
                    .where('normalizedTitle', '==', identity.normalizedTitle);
                const sameTitleQuery = await transaction.get(titleQuery);

                const deterministicGlobalRef = db.collection('globalSongs').doc(identity.globalSongId);
                const deterministicGlobalSnap = await transaction.get(deterministicGlobalRef);

                const exactMatchDoc = findExactGlobalSongMatchInDocs(
                    sameTitleQuery.docs,
                    identity.normalizedArtist
                );

                if (exactMatchDoc) {
                    const globalId = exactMatchDoc.id;
                    transaction.update(candRef, sanitizeFirestoreData({
                        classification: 'matched_existing',
                        'analysisSummary.classification': 'exact_match',
                        'analysisSummary.matchedGlobalSongId': globalId,
                        updatedAt: Date.now()
                    }));
                    return {
                        id: candId,
                        status: 'already_exists',
                        globalSongId: globalId,
                        reason: 'Exact title and artist already exist'
                    };
                }

                if (deterministicGlobalSnap.exists) {
                    const existing = deterministicGlobalSnap.data()!;
                    const existingArtist = normalizeSongIdentityValue(
                        existing.normalizedArtist || existing.artist
                    );
                    const existingTitle = normalizeSongIdentityValue(
                        existing.normalizedTitle || existing.title
                    );

                    if (
                        existingTitle !== identity.normalizedTitle ||
                        existingArtist !== identity.normalizedArtist
                    ) {
                        throw new Error('Bulk import identity collision');
                    }

                    transaction.update(candRef, sanitizeFirestoreData({
                        classification: 'matched_existing',
                        'analysisSummary.classification': 'exact_match',
                        'analysisSummary.matchedGlobalSongId': deterministicGlobalRef.id,
                        updatedAt: Date.now()
                    }));
                    return {
                        id: candId,
                        status: 'already_exists',
                        globalSongId: deterministicGlobalRef.id,
                        reason: 'Concurrent creation converged'
                    };
                }

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

                payload.normalizedTitle = identity.normalizedTitle;
                payload.normalizedArtist = identity.normalizedArtist;
                payload.status = 'active';
                payload.createdAt = Date.now();
                payload.updatedAt = Date.now();
                payload.importCount = data.occurrences?.length || data.occurrenceCount || 1;
                Object.assign(payload, buildGlobalSongSearchFields(payload));

                transaction.set(deterministicGlobalRef, sanitizeFirestoreData(payload));
                transaction.update(candRef, sanitizeFirestoreData({
                    status: 'approved',
                    approvedGlobalSongId: deterministicGlobalRef.id,
                    updatedAt: Date.now()
                }));
                transaction.set(auditRef, sanitizeFirestoreData({
                    candidateId: candId,
                    action: 'BULK_IMPORT',
                    globalSongId: deterministicGlobalRef.id,
                    resolvedBy,
                    timestamp: Date.now()
                }));

                return {
                    id: candId,
                    status: 'imported',
                    globalSongId: deterministicGlobalRef.id
                };
            });

            importResults.push(result);
        } catch (err: any) {
            importResults.push({ id: candId, status: 'error', reason: err.message });
        }
    }

    return importResults;
}
