import { SongSnapshot } from './types.js';
import { Song } from '../../types.js';

/**
 * Creates a sanitized SongSnapshot suitable for domain classification.
 * Extracts exclusively allow-listed safe public properties and discards
 * private/organizational metadata, audit fields, etc.
 */
export function buildSanitizedSnapshot(song: Song): SongSnapshot {
  let safeChordsUrl = song.chordsUrl;
  if (safeChordsUrl) {
      try {
          const u = new URL(safeChordsUrl);
          if (u.protocol !== 'http:' && u.protocol !== 'https:') {
              safeChordsUrl = '';
          }
      } catch {
          safeChordsUrl = '';
      }
  }

  let safeVideoUrl = song.videoUrl;
  if (safeVideoUrl) {
      try {
          const u = new URL(safeVideoUrl);
          if (u.protocol !== 'http:' && u.protocol !== 'https:') {
              safeVideoUrl = '';
          }
      } catch {
          safeVideoUrl = '';
      }
  }

  const snapshotResult: SongSnapshot = {
    title: song.title,
    artist: song.artist,
    lyrics: song.lyrics || '',
    chords: song.chords || '',
    sections: Array.isArray(song.sections) ? song.sections.slice() : [],
    key: song.key || '',
    chordsUrl: safeChordsUrl || '',
    videoUrl: safeVideoUrl || '',
    ...(song.originalKey !== undefined ? { originalKey: song.originalKey } : {}),
    ...(song.selectedKey !== undefined ? { selectedKey: song.selectedKey } : {}),
    ...(song.version !== undefined ? { version: song.version } : {}),
    ...(song.bpm !== undefined ? { bpm: song.bpm } : {}),
    ...(song.suggestedBpm !== undefined ? { suggestedBpm: song.suggestedBpm } : {}),
    ...(song.bpmConfidence !== undefined ? { bpmConfidence: song.bpmConfidence } : {}),
    ...(song.bpmSource !== undefined ? { bpmSource: song.bpmSource } : {}),
    ...(song.rhythm !== undefined ? { rhythm: song.rhythm } : {}),
    ...(song.language !== undefined ? { language: song.language } : {}),
    ...(song.languageDetection !== undefined ? { languageDetection: { ...song.languageDetection } } : {})
  };

  return snapshotResult;
}
