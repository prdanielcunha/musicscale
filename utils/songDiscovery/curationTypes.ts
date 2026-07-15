import { MatchClassification, MatchReasonCode, MatchWarningCode, NormalizedSongIdentity, SongSnapshot } from './types.js';
import { FlexibleTimestamp } from '../curation/timestamp.js';

export type GlobalLibraryCandidateStatus =
  | 'pending_analysis'
  | 'likely_unique'
  | 'possible_duplicate'
  | 'matched_existing'
  | 'pending_review'
  | 'approved'
  | 'linked'
  | 'merged'
  | 'rejected'
  | 'processing_failed';

export interface GlobalLibraryCandidate {
  id: string; // The candidate grouping ID
  title: string;
  artist: string;
  normalizedTitle: string;
  status: GlobalLibraryCandidateStatus;
  classification: MatchClassification | 'pending';
  snapshot: SongSnapshot;
  canonicalIdentity: {
    normalizedTitle: string;
    compactTitle: string; // title without spaces for strict lookups
    normalizedArtists: string[];
    titleFingerprint: string;
    lyricsFingerprint?: string;
    openingFingerprint?: string;
    chorusFingerprint?: string;
    contentFingerprint: string;
  };
  analysisSummary: {
    algorithmVersion: string;
    classification: MatchClassification | 'pending';
    overallScore: number | null;
    bestGlobalSongId?: string;
    bestMatchScore?: number;
    possibleMatchCount: number;
    reasonCodes: MatchReasonCode[];
    warningCodes: MatchWarningCode[];
  };
  occurrenceCount: number;
  organizationCount: number;
  firstDiscoveredAt: number; 
  lastDiscoveredAt: number;
  
  // Future queue processing state
  processing: {
    state: 'idle' | 'processing' | 'failed';
    attempts: number;
    lastAttemptAt?: number;
    lastErrorCode?: string;
    nextRetryAt?: number;
  };
  
  review: {
    reviewedAt?: number;
    reviewedBy?: string; // admin user id
    decision?: string;
    internalNotePresent?: boolean;
  };
  resultingGlobalSongId?: string;
  createdAt: number;
  updatedAt: number;
  schemaVersion: number;
}

export interface GlobalLibraryCandidateOccurrence {
  id: string;
  candidateId: string;
  source: {
    organizationId: string;
    songId: string;
    sourceType?: string; // e.g., 'local_creation', 'import'
  };
  snapshot: SongSnapshot;
  normalizedIdentity: NormalizedSongIdentity;
  discovery: {
    discoveredAt: number;
    contentVersion?: string;
    sourceContentFingerprint: string;
  };
  processing: {
    processedAt?: number;
    algorithmVersion: string;
    classification?: MatchClassification;
    overallScore?: number;
    reasonCodes: MatchReasonCode[];
    warningCodes: MatchWarningCode[];
  };
  idempotencyKey: string;
  createdAt: number;
  updatedAt: number;
  schemaVersion: number;
}

export interface GlobalLibraryCandidateMatch {
  id: string; 
  globalSongId: string;
  classification: MatchClassification;
  overallScore: number;
  scores: any; 
  reasonCodes: MatchReasonCode[];
  warningCodes: MatchWarningCode[];
  algorithmVersion: string;
  createdAt: number;
  updatedAt: number;
}

export type ReviewLogEventType = 
  | 'candidate_created'
  | 'occurrence_added'
  | 'analysis_started'
  | 'analysis_completed'
  | 'analysis_failed'
  | 'reprocessed'
  | 'approved'
  | 'linked'
  | 'merged'
  | 'rejected';

export interface GlobalLibraryCandidateReviewLog {
  id: string;
  eventType: ReviewLogEventType | string;
  candidateId?: string;
  actorType?: 'system' | 'admin' | string;
  actorId?: string;
  timestamp: FlexibleTimestamp; // safe polymorphic timestamp 
  correlationId: string;
  schemaVersion: number;
  metadata?: Record<string, unknown>;
  
  // legacy/flat fallbacks for existing historical events
  action?: string;
  actorUid?: string;
  createdAt?: FlexibleTimestamp;
  reasonCode?: string;
  privateNote?: string;
  resultingGlobalSongId?: string;
  forceModeratedMatch?: boolean;
}


export type PersistenceResult = 
  | { outcome: 'candidate_created'; candidateId: string; occurrenceId: string; }
  | { outcome: 'occurrence_added'; candidateId: string; occurrenceId: string; }
  | { outcome: 'already_exists'; candidateId: string; occurrenceId: string; }
  | { outcome: 'idempotency_conflict'; conflictingCandidateId: string; message: string; }
  | { outcome: 'conflict'; conflictingCandidateId: string; message: string; };

export const CURATION_LIMITS = {
  MAX_PERSISTED_MATCHES: 10,
  MAX_TITLE_LENGTH: 200,
  MAX_ARTIST_LENGTH: 200,
  MAX_LYRICS_LENGTH: 5000,
  MAX_CHORDS_LENGTH: 15000,
  MAX_SECTIONS: 50,
  MAX_REASON_CODES: 10,
  MAX_WARNING_CODES: 10,
  MAX_INTERNAL_NOTE_LENGTH: 1000,
  MAX_IDEMPOTENCY_KEY_LENGTH: 128
};
