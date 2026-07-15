// import { Song } from '../../types.js';

export type MatchClassification =
  | 'exact_match'
  | 'high_confidence_match'
  | 'possible_duplicate'
  | 'likely_unique'
  | 'insufficient_data';

export type MatchReasonCode =
  | 'CONTENT_FINGERPRINT_MATCH'
  | 'TITLE_EXACT'
  | 'TITLE_HIGH_SIMILARITY'
  | 'ARTIST_EXACT'
  | 'LYRICS_EXACT'
  | 'LYRICS_HIGH_SIMILARITY'
  | 'OPENING_MATCH'
  | 'CHORUS_MATCH'
  | 'EXTERNAL_VIDEO_MATCH';

export type MatchWarningCode =
  | 'MISSING_LYRICS'
  | 'SHORT_LYRICS'
  | 'GENERIC_TITLE'
  | 'ARTIST_CONFLICT'
  | 'TITLE_CONFLICT'
  | 'POSSIBLE_MEDLEY'
  | 'INSUFFICIENT_DATA'
  | 'FINGERPRINT_COLLISION_GUARD'
  | 'DIFFERENT_CONTENT_DESPITE_FINGERPRINT';

export interface NormalizedSongIdentity {
  originalTitle: string;
  normalizedTitle: string;
  compactTitle: string;
  titleTokens: string[];
  removedTitleTerms: string[];
  originalArtist?: string;
  normalizedArtists: string[];
  normalizedLyrics: string | null;
  openingLyrics: string | null;
  chorusLyrics: string | null;
  titleFingerprint: string;
  lyricsFingerprint: string | null;
  openingFingerprint: string | null;
  chorusFingerprint: string | null;
  contentFingerprint: string;
  externalReferences: {
    youtubeVideoId: string | null;
    chordsUrl: string | null;
    sourceUrl: string | null;
  };
}

export interface MatchEvidenceScores {
  title: number | null;
  artist: number | null;
  lyrics: number | null;
  opening: number | null;
  chorus: number | null;
  structure: number | null;
  externalReference: number | null;
  harmony: number | null;
}

export interface SongMatchEvidence {
  overallScore: number;
  classification: MatchClassification;
  scores: MatchEvidenceScores;
  reasons: MatchReasonCode[];
  warnings: MatchWarningCode[];
  comparableFields: string[];
  missingFields: string[];
}

export interface SongComparableInput {
    identity: NormalizedSongIdentity;
}

export interface SongSnapshot {
  title: string;
  artist: string;
  lyrics: string;
  chords: string;
  sections?: string[];
  key: string;
  originalKey?: string;
  selectedKey?: string;
  version?: string;
  bpm?: number | null;
  suggestedBpm?: number | null;
  bpmConfidence?: 'high' | 'medium' | 'low' | 'unknown' | 'user_provided';
  bpmSource?: 'source_text' | 'ai_suggestion' | 'provider_name' | 'manual' | 'not_detected';
  rhythm?: string;
  chordsUrl: string;
  videoUrl: string;
  language?: 'pt' | 'en' | 'es' | 'other' | 'unknown';
  languageDetection?: {
    confidence: number;
    method: 'ai' | 'heuristic' | 'manual';
  };
}
