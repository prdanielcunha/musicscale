import { admin, adminDb } from '../firebaseAdmin.js';
import * as crypto from 'crypto';
import { sanitizeFirestoreData } from './firestoreSanitizer.js';
import { 

  GlobalLibraryCandidate, 
  GlobalLibraryCandidateOccurrence, 
  GlobalLibraryCandidateMatch,
  PersistenceResult,
  CURATION_LIMITS
} from '../../utils/songDiscovery/curationTypes.js';
import { GlobalLibraryCandidateReviewLogServerInput } from './curationServerTypes.js';

export class GlobalLibraryCandidateRepository {
  private db: FirebaseFirestore.Firestore;

  constructor(mockDb?: any) {
    this.db = mockDb || adminDb || admin.firestore();
  }

  private get candidatesCol() {
    return this.db.collection('globalLibraryCandidates');
  }

  private occurrencesCol(candidateId: string) {
    return this.candidatesCol.doc(candidateId).collection('occurrences');
  }

  private matchesCol(candidateId: string) {
    return this.candidatesCol.doc(candidateId).collection('matches');
  }

  private reviewLogsCol(candidateId: string) {
    return this.candidatesCol.doc(candidateId).collection('reviewLogs');
  }

  private organizationsCol(candidateId: string) {
    return this.candidatesCol.doc(candidateId).collection('organizations');
  }

  private enforceLimits(occurrence: Omit<GlobalLibraryCandidateOccurrence, 'id' | 'candidateId' | 'createdAt' | 'updatedAt'>) {
    if (occurrence.normalizedIdentity.normalizedTitle.length > CURATION_LIMITS.MAX_TITLE_LENGTH) {
      throw new Error(`DOCUMENT_TOO_LARGE: Title exceeds ${CURATION_LIMITS.MAX_TITLE_LENGTH} characters.`);
    }
    if (occurrence.normalizedIdentity.normalizedLyrics && occurrence.normalizedIdentity.normalizedLyrics.length > CURATION_LIMITS.MAX_LYRICS_LENGTH) {
      throw new Error(`DOCUMENT_TOO_LARGE: Lyrics exceed ${CURATION_LIMITS.MAX_LYRICS_LENGTH} characters.`);
    }
    if (occurrence.idempotencyKey.length > CURATION_LIMITS.MAX_IDEMPOTENCY_KEY_LENGTH) {
      throw new Error(`DOCUMENT_TOO_LARGE: IdempotencyKey exceeds ${CURATION_LIMITS.MAX_IDEMPOTENCY_KEY_LENGTH} characters.`);
    }
  }

  /**
   * Safe payload structure validator to prevent huge payloads via REST/SDK.
   */
  public async addOccurrenceIdempotently(
    candidateId: string, 
    occurrenceInput: Omit<GlobalLibraryCandidateOccurrence, 'id' | 'candidateId' | 'createdAt' | 'updatedAt'>
  ): Promise<PersistenceResult> {
    this.enforceLimits(occurrenceInput);

    // Provide the occurrence ID deterministically based on idempotency key
    // We use SHA-256 to ensure safe, fixed-length document IDs without slash collision or truncation issues
    const safeOccurrenceId = crypto.createHash('sha256').update(occurrenceInput.idempotencyKey).digest('hex');
    
    return this.db.runTransaction(async (t) => {
      // 1. Check idempotency deterministically without queries
      const occurrenceRef = this.occurrencesCol(candidateId).doc(safeOccurrenceId);
      const occurrenceDoc = await t.get(occurrenceRef);
      
      if (occurrenceDoc.exists) {
        const existingData = occurrenceDoc.data() as GlobalLibraryCandidateOccurrence;
        if (existingData.idempotencyKey !== occurrenceInput.idempotencyKey) {
            return {
                outcome: 'idempotency_conflict',
                conflictingCandidateId: candidateId,
                message: 'Hash collision on idempotency key.'
            };
        }
        return { 
          outcome: 'already_exists', 
          candidateId, 
          occurrenceId: safeOccurrenceId 
        };
      }

      const candidateRef = this.candidatesCol.doc(candidateId);
      const candidateDoc = await t.get(candidateRef);

      const timestamp = Date.now();
      const orgId = occurrenceInput.source.organizationId;
      const orgRef = this.organizationsCol(candidateId).doc(orgId);
      const orgDoc = await t.get(orgRef);
      const isNewOrg = !orgDoc.exists;

      const newOccurrence: GlobalLibraryCandidateOccurrence = {
        ...occurrenceInput,
        id: safeOccurrenceId,
        candidateId,
        createdAt: timestamp,
        updatedAt: timestamp
      };

      if (!candidateDoc.exists) {
        // Create new candidate
        const newCandidate: GlobalLibraryCandidate = sanitizeFirestoreData({
          id: candidateId,
          title: occurrenceInput.snapshot.title,
          artist: occurrenceInput.snapshot.artist,
          normalizedTitle: occurrenceInput.normalizedIdentity.normalizedTitle,
          status: (occurrenceInput.processing.classification as any) === 'processing_failed' ? 'processing_failed' : 'pending_review',
          classification: occurrenceInput.processing.classification || 'pending',
          snapshot: occurrenceInput.snapshot,
          canonicalIdentity: {
            normalizedTitle: occurrenceInput.normalizedIdentity.normalizedTitle,
            compactTitle: occurrenceInput.normalizedIdentity.normalizedTitle.replace(/\s+/g, ''),
            normalizedArtists: [...occurrenceInput.normalizedIdentity.normalizedArtists],
            titleFingerprint: occurrenceInput.normalizedIdentity.titleFingerprint,
            ...(occurrenceInput.normalizedIdentity.lyricsFingerprint !== undefined ? { lyricsFingerprint: occurrenceInput.normalizedIdentity.lyricsFingerprint } : {}),
            ...(occurrenceInput.normalizedIdentity.openingFingerprint !== undefined ? { openingFingerprint: occurrenceInput.normalizedIdentity.openingFingerprint } : {}),
            ...(occurrenceInput.normalizedIdentity.chorusFingerprint !== undefined ? { chorusFingerprint: occurrenceInput.normalizedIdentity.chorusFingerprint } : {}),
            contentFingerprint: occurrenceInput.normalizedIdentity.contentFingerprint
          },
          analysisSummary: {
            algorithmVersion: occurrenceInput.processing.algorithmVersion,
            classification: occurrenceInput.processing.classification || 'pending',
            ...(occurrenceInput.processing.overallScore !== undefined ? { overallScore: occurrenceInput.processing.overallScore } : {}),
            possibleMatchCount: 0,
            reasonCodes: occurrenceInput.processing.reasonCodes || [],
            warningCodes: occurrenceInput.processing.warningCodes || []
          },
          occurrenceCount: 1,
          organizationCount: 1, 
          firstDiscoveredAt: timestamp,
          lastDiscoveredAt: timestamp,
          processing: {
            state: 'idle',
            attempts: 0
          },
          review: {},
          createdAt: timestamp,
          updatedAt: timestamp,
          schemaVersion: 1
        });

        t.set(candidateRef, newCandidate);
        t.set(orgRef, { addedAt: timestamp });
        
        // Add log
        const logRef = this.reviewLogsCol(candidateId).doc();
        t.set(logRef, sanitizeFirestoreData({
          id: logRef.id,
          eventType: 'candidate_created',
          candidateId,
          actorType: 'system',
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          correlationId: occurrenceInput.idempotencyKey,
          schemaVersion: 1,
          metadata: { occurrenceId: safeOccurrenceId }
        }));

      } else {
        const cData = candidateDoc.data() as GlobalLibraryCandidate;
        
        if (cData.canonicalIdentity.normalizedTitle !== occurrenceInput.normalizedIdentity.normalizedTitle && cData.canonicalIdentity.contentFingerprint === occurrenceInput.normalizedIdentity.contentFingerprint) {
          // This is a fingerprint collision! Same hash, different title!
          return {
            outcome: 'conflict',
            conflictingCandidateId: candidateId,
            message: 'Fingerprint collision guard triggered: Same fingerprint but different title.'
          };
        }

        // Just update counters
        const updates: any = sanitizeFirestoreData({
           occurrenceCount: admin.firestore.FieldValue.increment(1),
           lastDiscoveredAt: timestamp,
           updatedAt: timestamp
        });

        if (isNewOrg) {
           updates.organizationCount = admin.firestore.FieldValue.increment(1);
           t.set(orgRef, { addedAt: timestamp });
        }

        t.update(candidateRef, updates);

        // Add log
        const logRef = this.reviewLogsCol(candidateId).doc();
        t.set(logRef, sanitizeFirestoreData({
          id: logRef.id,
          eventType: 'occurrence_added',
          candidateId,
          actorType: 'system',
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          correlationId: occurrenceInput.idempotencyKey,
          schemaVersion: 1,
          metadata: { occurrenceId: safeOccurrenceId }
        }));
      }

      t.set(occurrenceRef, sanitizeFirestoreData(newOccurrence));

      return {
        outcome: candidateDoc.exists ? 'occurrence_added' : 'candidate_created',
        candidateId,
        occurrenceId: safeOccurrenceId
      };
    });
  }

  public async saveCandidateMatches(candidateId: string, matches: Omit<GlobalLibraryCandidateMatch, 'id' | 'createdAt' | 'updatedAt'>[]) {
    // Only persist up to MAX limit
    const persistedMatches = matches.slice(0, CURATION_LIMITS.MAX_PERSISTED_MATCHES);
    
    const batch = this.db.batch();
    const timestamp = Date.now();

    for (const match of persistedMatches) {
       const matchRef = this.matchesCol(candidateId).doc();
       batch.set(matchRef, sanitizeFirestoreData({
         ...match,
         id: matchRef.id,
         createdAt: timestamp,
         updatedAt: timestamp
       }));
    }

    await batch.commit();
  }

  public async appendReviewLog(candidateId: string, log: Omit<GlobalLibraryCandidateReviewLogServerInput, 'id' | 'timestamp'>) {
    const logRef = this.reviewLogsCol(candidateId).doc();
    await logRef.set(sanitizeFirestoreData({
      ...log,
      id: logRef.id,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    }));
  }

}
