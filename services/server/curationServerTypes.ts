import { FieldValue } from 'firebase-admin/firestore';
import { ReviewLogEventType } from '../../utils/songDiscovery/curationTypes.js';

export interface GlobalLibraryCandidateReviewLogServerInput {
  eventType: ReviewLogEventType;
  candidateId?: string;
  actorType: 'system' | 'admin';
  actorId?: string;
  timestamp: FieldValue; 
  correlationId: string;
  schemaVersion: number;
  metadata?: Record<string, unknown>;
  
  // also allow the optional payload properties for flat logging
  resultingGlobalSongId?: string;
  forceModeratedMatch?: boolean;
  reasonCode?: string;
  privateNote?: string;
  action?: string;
  actorUid?: string;
  createdAt?: FieldValue;
}

export interface MergeFieldsToMerge {
  title?: boolean;
  artist?: boolean;
  key?: boolean;
  bpm?: boolean;
  chords?: boolean;
  lyrics?: boolean;
  language?: boolean;
  tags?: boolean;
}

export interface MergeRequestBody {
  candidateId: string;
  occurrenceId: string;
  globalSongId: string;
  expectedRevision: number;
  fieldsToMerge: MergeFieldsToMerge;
  optionalNote?: string;
  idempotencyKey: string;
}

export interface GlobalLibraryMergeHistoryRecord {
  globalSongId: string;
  candidateId: string;
  occurrenceId: string;
  actorId: string;
  correlationId: string; // SHA-256 of idempotencyKey
  previousRevision: number;
  resultingRevision: number;
  mergedFields: string[];
  previousSnapshot: Record<string, string | number | string[] | null | undefined>;
  resultingSnapshot: Record<string, string | number | string[] | null | undefined>;
  optionalNote?: string;
  timestamp: FieldValue;
  schemaVersion: number;
}
