import { buildSanitizedSnapshot } from '../../utils/songDiscovery/snapshotSanitizer.js';
import { extractSongIdentity } from '../../utils/songDiscovery/identityGenerator.js';
import { compareSongs } from '../../utils/songDiscovery/matcher.js';
import { GlobalLibraryCandidateRepository } from './globalLibraryCandidateRepository.js';
import { GlobalLibraryCandidateOccurrence, GlobalLibraryCandidateMatch } from '../../utils/songDiscovery/curationTypes.js';
import * as crypto from 'crypto';
import { admin } from '../firebaseAdmin.js';
import { CurationApprovalService } from './curationApprovalService.js';
import { GENERIC_TITLES, MIN_LYRICS_WORDS_FOR_STRONG_MATCH } from '../../utils/songDiscovery/constants.js';

const DISCOVERY_ALGORITHM_VERSION = '1.0';

export class PermanentProcessingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PermanentProcessingError';
  }
}

export interface ProcessResult {
  outcome: 'processed' | 'already_processed' | 'ignored' | 'not_found' | 'failed';
  reasonCode?: string;
  candidateId?: string | null;
  occurrenceId?: string | null;
  candidateCreated?: boolean;
}

/**
 * Converts any caught error into a safe internal error structure,
 * masking sensitive information like lyrics, chords, tokens, or Firebase internals.
 */
export function toSafeInternalError(error: unknown): { code: string; message: string } {
  if (error instanceof Error) {
    const msg = error.message;
    if (msg.includes('PERMISSION_DENIED')) {
      return { code: 'PERMISSION_DENIED', message: 'Acesso recusado ao banco de dados.' };
    }
    if (msg.includes('NOT_FOUND')) {
      return { code: 'NOT_FOUND', message: 'Recurso não encontrado no banco de dados.' };
    }
    if (msg.includes('DOCUMENT_TOO_LARGE')) {
      return { code: 'DOCUMENT_TOO_LARGE', message: 'O tamanho do conteúdo excede os limites.' };
    }
    if (error.name === 'PermanentProcessingError') {
      return { code: 'PERMANENT_PROCESSING_ERROR', message: msg };
    }
    return { code: 'INTERNAL_ERROR', message: 'Ocorreu um erro interno de processamento.' };
  }
  return { code: 'UNKNOWN_ERROR', message: 'Erro desconhecido.' };
}

/**
 * Generates a non-sensitive secure correlation ID from the idempotency key or metadata
 */
export function generateSafeCorrelationId(idempotencyKey: string): string {
  return crypto.createHash('sha256').update(idempotencyKey).digest('hex').substring(0, 16);
}

/**
 * Unified Domain Controller for Song Discovery Processor
 * Shared safely between Cloud Trigger & Express Reprocess API.
 */
export async function runSongDiscoveryProcessor(
  songData: any,
  songId: string,
  organizationId: string,
  dbInstance: any,
  eventId?: string
): Promise<ProcessResult> {
  // 1. Initial Start Log
  const correlationIdPart = crypto.createHash('sha256').update(`${organizationId}_${songId}`).digest('hex').substring(0, 12);
  console.log('[Discovery] Processing check initiated', {
    songId,
    correlationId: correlationIdPart,
    eventId: eventId || null
  });

  // 2. Eligibility & Rules Verification
  if (!songData) {
    console.log('[Discovery] Ignored: Song document not found', { songId, correlationId: correlationIdPart });
    return { outcome: 'not_found', reasonCode: 'DOCUMENT_NOT_FOUND' };
  }

  if (!songData.title || typeof songData.title !== 'string' || songData.title.trim().length === 0) {
    console.log('[Discovery] Ignored: Song has empty title', { songId, correlationId: correlationIdPart, reasonCode: 'MISSING_TITLE' });
    return { outcome: 'ignored', reasonCode: 'MISSING_TITLE' };
  }

  if (songData.deleted || songData.archived || songData.isDraft) {
    console.log('[Discovery] Ignored: Song is inactive or draft', {
      songId,
      correlationId: correlationIdPart,
      reasonCode: 'DRAFT_OR_DELETED_OR_ARCHIVED'
    });
    return { outcome: 'ignored', reasonCode: 'DRAFT_OR_DELETED_OR_ARCHIVED' };
  }

  if (songData.originGlobalSongId) {
    console.log('[Discovery] Ignored: Imported origin exists', {
      songId,
      correlationId: correlationIdPart,
      reasonCode: 'IMPORTED_FROM_GLOBAL'
    });
    return { outcome: 'ignored', reasonCode: 'IMPORTED_FROM_GLOBAL' };
  }

  // 3. Snapshot and Identity Generation
  let sanitizedSnapshot;
  let identity;
  try {
    sanitizedSnapshot = buildSanitizedSnapshot(songData);
    identity = extractSongIdentity(sanitizedSnapshot);
  } catch (err: unknown) {
    const safeErr = toSafeInternalError(err);
    console.error('[Discovery] Hard failure: identity calculation failed', {
      songId,
      correlationId: correlationIdPart,
      errorCode: safeErr.code
    });
    return { outcome: 'failed', reasonCode: 'IDENTITY_CALCULATION_FAILED' };
  }

  // 4. Idempotency Key & Correlation Setup
  const idempotencyKey = `${organizationId}_${songId}`;
  const correlationId = generateSafeCorrelationId(idempotencyKey);

  // 5. Query matching candidates & approved songs
  const repo = new GlobalLibraryCandidateRepository(dbInstance);

  try {
    // Never classify a truncated search as evidence of uniqueness.
    const MAX_MATCH_SCAN = 50;
    const globalSongsQuery = await dbInstance.collection('globalSongs')
      .where('normalizedTitle', '==', identity.normalizedTitle)
      .limit(MAX_MATCH_SCAN + 1).get();
    const lyricsQuery = identity.lyricsFingerprint
      ? await dbInstance.collection('globalSongs')
          .where('lyricsFingerprint', '==', identity.lyricsFingerprint)
          .limit(MAX_MATCH_SCAN + 1).get()
      : null;
    const globalDocs = new Map<string, any>();
    for (const doc of [...globalSongsQuery.docs, ...(lyricsQuery?.docs || [])]) {
      globalDocs.set(doc.id, doc);
    }
    const incompleteGlobalSearch = globalSongsQuery.docs.length > MAX_MATCH_SCAN ||
      (lyricsQuery?.docs.length || 0) > MAX_MATCH_SCAN;
    const lyricsAlreadyPresent = Boolean(lyricsQuery?.docs.length);
    const hasMatchingGlobalArtist = Array.from(globalDocs.values()).some((doc: any) => {
      const data = doc.data();
      const artists = data.normalizedArtists || (data.normalizedArtist ? [data.normalizedArtist] : []);
      return data.normalizedTitle === identity.normalizedTitle &&
        (!artists.length || !identity.normalizedArtists.length ||
         artists.some((artist: string) => identity.normalizedArtists.includes(artist)));
    });

    let bestGlobalMatch: Omit<GlobalLibraryCandidateMatch, 'id' | 'createdAt' | 'updatedAt'> | null = null;
    const globalMatches: Omit<GlobalLibraryCandidateMatch, 'id' | 'createdAt' | 'updatedAt'>[] = [];

    for (const doc of globalDocs.values()) {
      const globalData = doc.data() as any;
      const candidateIdentity = {
        normalizedTitle: globalData.normalizedTitle || '',
        normalizedArtists: globalData.normalizedArtists || (globalData.normalizedArtist ? [globalData.normalizedArtist] : []),
        normalizedLyrics: globalData.normalizedLyrics || null,
        lyricsFingerprint: globalData.lyricsFingerprint || globalData.fingerprints?.lyrics || null,
        contentFingerprint: globalData.contentFingerprint || globalData.fingerprints?.content || null,
        originalTitle: globalData.title || '',
        openingLyrics: null,
        chorusLyrics: null,
        externalReferences: {}
      };

      const matchResult = compareSongs(identity, candidateIdentity as any);
      const matchObj: Omit<GlobalLibraryCandidateMatch, 'id' | 'createdAt' | 'updatedAt'> = {
        globalSongId: doc.id,
        classification: matchResult.classification,
        overallScore: matchResult.overallScore,
        scores: matchResult.scores,
        reasonCodes: matchResult.reasons,
        warningCodes: matchResult.warnings,
        algorithmVersion: DISCOVERY_ALGORITHM_VERSION
      };

      globalMatches.push(matchObj);

      if (!bestGlobalMatch || matchResult.overallScore > bestGlobalMatch.overallScore) {
        bestGlobalMatch = matchObj;
      }
    }

    globalMatches.sort((a, b) => b.overallScore - a.overallScore);

    // 6. Cluster to matching candidates
    let targetCandidateId: string | null = null;
    let fallbackWarning: string | null = null;

    const candidatesQuery = await dbInstance.collection('globalLibraryCandidates')
      .where('canonicalIdentity.normalizedTitle', '==', identity.normalizedTitle)
      .limit(MAX_MATCH_SCAN + 1).get();
    const candidateLyricsQuery = identity.lyricsFingerprint
      ? await dbInstance.collection('globalLibraryCandidates')
          .where('canonicalIdentity.lyricsFingerprint', '==', identity.lyricsFingerprint)
          .limit(MAX_MATCH_SCAN + 1).get()
      : null;
    const candidateDocs = new Map<string, any>();
    for (const doc of [...candidatesQuery.docs, ...(candidateLyricsQuery?.docs || [])]) {
      candidateDocs.set(doc.id, doc);
    }
    const incompleteCandidateSearch = candidatesQuery.docs.length > MAX_MATCH_SCAN ||
      (candidateLyricsQuery?.docs.length || 0) > MAX_MATCH_SCAN;
    let pendingCandidateConflict = false;

    for (const doc of candidateDocs.values()) {
      const candidateData = doc.data() as any;
      if (candidateData.status !== 'pending_review') continue;
      const candidateArtist = candidateData.canonicalIdentity?.normalizedArtists || [];
      if (
        candidateData.canonicalIdentity?.lyricsFingerprint === identity.lyricsFingerprint &&
        Boolean(identity.lyricsFingerprint)
      ) pendingCandidateConflict = true;
      if (candidateData.canonicalIdentity?.normalizedTitle === identity.normalizedTitle &&
        (!candidateArtist.length || !identity.normalizedArtists.length ||
        candidateArtist.some((artist: string) => identity.normalizedArtists.includes(artist)))
      ) pendingCandidateConflict = true;
      const matchResult = compareSongs(identity, candidateData.canonicalIdentity);

      if (matchResult.classification === 'exact_match' || matchResult.classification === 'high_confidence_match') {
        targetCandidateId = doc.id;
        break;
      }
    }

    if (incompleteGlobalSearch || incompleteCandidateSearch) {
      fallbackWarning = 'SEARCH_LIMITED_NO_GLOBAL_MATCH';
    }

    let finalClassification = bestGlobalMatch?.classification || 'likely_unique';
    if (finalClassification === 'likely_unique' &&
        (lyricsAlreadyPresent || hasMatchingGlobalArtist || pendingCandidateConflict)) {
      finalClassification = 'possible_duplicate';
    }
    if (fallbackWarning) finalClassification = 'insufficient_data';

    // Only strong, unambiguous evidence allows publication without a curator.
    const lyricsWords = (identity.normalizedLyrics || '').split(/\s+/).filter(Boolean).length;
    const mayAutoPublish = !fallbackWarning && !targetCandidateId &&
      !hasMatchingGlobalArtist && !lyricsAlreadyPresent && !pendingCandidateConflict &&
      !GENERIC_TITLES.has(identity.normalizedTitle) &&
      identity.normalizedArtists.length > 0 &&
      lyricsWords >= MIN_LYRICS_WORDS_FOR_STRONG_MATCH &&
      finalClassification === 'likely_unique' &&
      globalMatches.every(match => match.classification === 'likely_unique');

    // 7. Structure the Occurrence input safely
    const occurrenceInput: Omit<GlobalLibraryCandidateOccurrence, 'id' | 'candidateId' | 'createdAt' | 'updatedAt'> = {
      source: {
        organizationId,
        songId
      },
      snapshot: sanitizedSnapshot,
      normalizedIdentity: identity,
      discovery: {
        discoveredAt: Date.now(),
        sourceContentFingerprint: identity.contentFingerprint
      },
      processing: {
        algorithmVersion: DISCOVERY_ALGORITHM_VERSION,
        classification: finalClassification as any,
        overallScore: bestGlobalMatch?.overallScore || 0,
        reasonCodes: bestGlobalMatch?.reasonCodes || [],
        warningCodes: fallbackWarning ? [fallbackWarning as any] : []
      },
      idempotencyKey,
      schemaVersion: 1
    };

    // 8. Safe Transaction Storage
    if (targetCandidateId !== null) {
      const result = await repo.addOccurrenceIdempotently(targetCandidateId, occurrenceInput);
      const safeOccurrenceId = 'occurrenceId' in result ? result.occurrenceId : null;
      
      if (result.outcome === 'already_exists') {
        console.log('[Discovery] Document processed: already exists', {
          songId,
          candidateId: targetCandidateId,
          correlationId,
          outcome: 'already_processed'
        });
        return { outcome: 'already_processed', candidateId: targetCandidateId, occurrenceId: safeOccurrenceId };
      }

      console.log('[Discovery] Document processed successfully: appended', {
        songId,
        candidateId: targetCandidateId,
        correlationId,
        outcome: 'processed'
      });
      return { outcome: 'processed', candidateId: targetCandidateId, occurrenceId: safeOccurrenceId, candidateCreated: result.outcome === 'candidate_created' };

    } else {
      // An already resolved fingerprint must not swallow a new duplicate.
      const fingerprintId = identity.contentFingerprint || dbInstance.collection('globalLibraryCandidates').doc().id;
      const oldFingerprint = candidateDocs.get(fingerprintId);
      const newCandidateId = oldFingerprint && oldFingerprint.data().status !== 'pending_review'
        ? crypto.createHash('sha256').update(idempotencyKey + '_duplicate').digest('hex')
        : fingerprintId;
      const result = await repo.addOccurrenceIdempotently(newCandidateId, occurrenceInput);
      const safeOccurrenceId = 'occurrenceId' in result ? result.occurrenceId : null;

      if (result.outcome === 'already_exists') {
        console.log('[Discovery] Document processed: already exists', {
          songId,
          candidateId: newCandidateId,
          correlationId,
          outcome: 'already_processed'
        });
        return { outcome: 'already_processed', candidateId: newCandidateId, occurrenceId: safeOccurrenceId, candidateCreated: false };
      }

      if (globalMatches.length > 0) {
        await repo.saveCandidateMatches(newCandidateId, globalMatches);
      }

      if (mayAutoPublish && result.outcome === 'candidate_created' && safeOccurrenceId) {
        try {
          const approval = new CurationApprovalService({ db: dbInstance, admin, logger: console });
          await approval.approve({
            candidateId: newCandidateId,
            occurrenceId: safeOccurrenceId,
            idempotencyKey: `automatic_${idempotencyKey}`,
            decodedToken: { uid: 'millionsnest-auto-curation', hasCurationAccess: true },
            automated: true
          });
          console.info('[Discovery] Verified unique song published', { songId, candidateId: newCandidateId });
        } catch (err: any) {
          // Candidate remains pending; the source song and scales are untouched.
          console.warn('[Discovery] Automatic publication deferred for human review', {
            songId, candidateId: newCandidateId, errorCode: err?.code || 'AUTO_APPROVAL_FAILED'
          });
        }
      }

      console.log('[Discovery] Document processed successfully: candidate created', {
        songId,
        candidateId: newCandidateId,
        correlationId,
        outcome: 'processed'
      });
      return { outcome: 'processed', candidateId: newCandidateId, occurrenceId: safeOccurrenceId, candidateCreated: result.outcome === 'candidate_created' };
    }

  } catch (err: unknown) {
    const safeErr = toSafeInternalError(err);
    console.error('[Discovery] Error stored in process transaction', {
      songId,
      correlationId,
      errorCode: safeErr.code,
      errorInfo: err instanceof Error ? err.stack : String(err)
    });
    
    // In case of non-fatal / permanent issues we do not bubble
    if (err instanceof PermanentProcessingError || safeErr.code === 'PERMISSION_DENIED' || safeErr.code === 'NOT_FOUND') {
      return { outcome: 'failed', reasonCode: safeErr.code };
    }
    
    throw err; // retry for triggers
  }
}
