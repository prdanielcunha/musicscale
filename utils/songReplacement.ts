import type { Song } from '../types';

/**
 * Builds the writable musical-content patch used when the user explicitly
 * chooses to replace an existing repertoire song.
 *
 * Identity and operational history (id, organizationId, createdAt/By,
 * lastPlayed/lastScheduledAt and scale references) are intentionally not part
 * of this patch, so existing scales keep pointing to the same song.
 */
export const buildSongContentReplacementPatch = (
  candidate: Partial<Song>,
): Partial<Song> => ({
  title: candidate.title?.trim() || '',
  artist: candidate.artist?.trim() || '',
  key: candidate.key?.trim() || '',
  originalKey: candidate.originalKey?.trim() || '',
  selectedKey: candidate.selectedKey?.trim() || candidate.key?.trim() || '',
  version: candidate.version?.trim() || 'Original',
  bpm: candidate.bpm ?? null,
  suggestedBpm: candidate.suggestedBpm ?? null,
  bpmConfidence: candidate.bpmConfidence ?? 'unknown',
  bpmSource: candidate.bpmSource ?? 'not_detected',
  rhythm: candidate.rhythm?.trim() || '',
  sections: Array.isArray(candidate.sections) ? candidate.sections : [],
  status: candidate.status ?? 'active',
  tagIds: Array.isArray(candidate.tagIds) ? candidate.tagIds : [],
  lyrics: candidate.lyrics ?? '',
  chords: candidate.chords ?? '',
  chordsUrl: candidate.chordsUrl ?? '',
  videoUrl: candidate.videoUrl ?? '',
  language: candidate.language ?? 'unknown',
  languageDetection: candidate.languageDetection ?? {
    confidence: 0,
    method: 'manual',
  },
  freshness: candidate.freshness ?? {
    status: 'default',
    source: 'manual',
  },
  sourceType: candidate.sourceType ?? 'manual',
  aiProcessed: candidate.aiProcessed ?? false,
  tabs: Array.isArray(candidate.tabs) ? candidate.tabs : [],
  metadata: candidate.metadata ?? {},
});
