import type { Song } from '../types';
import { getEffectiveKey } from './scaleSongSettings';
import { isValidKey, normalizeKey, resolveChordContentSourceKey, transposeChordDocument, validateTransposedPreview, validateChordContentKeyConsistency } from './chordEngine';

/** Always build repertoire writes from the canonical song, never a scale's display copy. */
export function buildPerformanceSongKeyPatch(song: Song, targetKey: string): Partial<Song> {
  const key = normalizeKey(targetKey);
  const source = resolveChordContentSourceKey(song.metadata);
  const sourceKey = source?.key || getEffectiveKey(song);
  if (!isValidKey(key) || !isValidKey(sourceKey)) throw new Error('INVALID_CHORD_KEY');
  const patch: Partial<Song> = { key, selectedKey: key };
  if (song.chords?.trim()) {
    if (source?.source === 'shapeKey' || validateChordContentKeyConsistency(song.chords, sourceKey).status === 'MISMATCH') {
      throw new Error('CHORD_KEY_REVIEW_REQUIRED');
    }
    const result = transposeChordDocument(song.chords, sourceKey, key);
    if (!validateTransposedPreview(song.chords, result.chords, sourceKey, key).valid) {
      throw new Error('INVALID_CHORD_TRANSPOSITION');
    }
    patch.chords = result.chords;
    patch.metadata = { ...song.metadata, chordContentKey: key, normalizedToConcertKey: true };
  }
  return patch;
}
