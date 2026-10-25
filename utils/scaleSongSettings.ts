import { Song, ScaleSongSettings } from '../types';
import { isValidKey, resolveChordContentSourceKey, transposeChordDocument } from './chordEngine';

export const getEffectiveKey = (song: Song, settings?: ScaleSongSettings): string => {
  if (settings && settings.key) return settings.key;
  // selectedKey represents the musician-facing/current key and may carry a
  // confirmed correction while legacy imports still retain an older key value.
  // Scale-local settings remain the strongest override.
  if (song.selectedKey) return song.selectedKey;
  if (song.key) return song.key;
  if (song.originalKey) return song.originalKey;
  return "";
};

export const getEffectiveBpm = (song: Song, settings?: ScaleSongSettings): number | null => {
  if (settings && settings.bpm !== undefined) return settings.bpm;
  if (song.bpm) return song.bpm;
  return null;
};

export const hasChords = (song: Song): boolean => {
  return (song.chords && song.chords.trim().length > 0) || (song.chordsUrl && song.chordsUrl.trim().length > 0) || false;
};

export const hasLyrics = (song: Song): boolean => {
  return (song.lyrics && song.lyrics.trim().length > 0) || false;
};

export const normalizeScaleSongSettings = (
  songIds: string[],
  settings?: Record<string, ScaleSongSettings>
): Record<string, ScaleSongSettings> => {
  if (!settings) return {};
  const normalized: Record<string, ScaleSongSettings> = {};
  
  songIds.forEach(id => {
    if (settings[id]) {
      const { key, bpm } = settings[id] as any; // Cast to any to handle runtime malformed data as requested by tests
      
      let validKey: string | null | undefined = undefined;
      if (key === null) {
        validKey = null;
      } else if (typeof key === 'string') {
        validKey = key.trim() || undefined;
      }

      let validBpm: number | null | undefined = undefined;
      if (bpm === null) {
        validBpm = null;
      } else {
        const bpmNum = typeof bpm === 'string' ? Number((bpm as string).trim()) : typeof bpm === 'number' ? bpm : NaN;
        if (!isNaN(bpmNum) && bpmNum >= 20 && bpmNum <= 300) {
          validBpm = bpmNum;
        }
      }
      
      if (validKey !== undefined || validBpm !== undefined) {
        normalized[id] = {};
        if (validKey !== undefined) normalized[id].key = validKey;
        if (validBpm !== undefined) normalized[id].bpm = validBpm;
      }
    }
  });
  
  return normalized;
};

export const applyScaleSongSettings = <T extends Song>(song: T, settings?: ScaleSongSettings): T => {
  // The written chart has its own source key. A selected/performance key is a
  // destination, never proof of the pitch of imported chord shapes.
  const newSong = { ...song };
  delete (newSong as any)._untransposedKey;
  delete (newSong as any)._untransposedChords;
  const sourceKey = resolveChordContentSourceKey(song.metadata)?.key || getEffectiveKey(song);
  const targetKey = getEffectiveKey(song, settings);

  if (isValidKey(sourceKey) && isValidKey(targetKey) && song.chords?.trim()) {
    newSong.chords = transposeChordDocument(song.chords, sourceKey, targetKey).chords;
    // This is a display copy only. Keeping its content key aligned makes repeated
    // application idempotent (populated scales can pass through this twice).
    newSong.metadata = { ...song.metadata, chordContentKey: targetKey, normalizedToConcertKey: true };
  }
  if (targetKey) {
    newSong.key = targetKey;
    newSong.selectedKey = targetKey;
  }

  if (settings?.bpm !== undefined && settings.bpm !== null) {
    newSong.bpm = settings.bpm;
  }

  return newSong;
};

export const moveSongId = (
  songIds: string[],
  fromIndex: number,
  toIndex: number
): string[] => {
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= songIds.length ||
    toIndex >= songIds.length ||
    fromIndex === toIndex
  ) {
    return songIds;
  }

  const next = [...songIds];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
};

export const moveSongBeforeTarget = (
  songIds: string[],
  movedSongId: string,
  targetSongId: string
): string[] => {
  if (movedSongId === targetSongId) return songIds;
  const fromIndex = songIds.indexOf(movedSongId);
  if (fromIndex === -1) return songIds;

  const next = [...songIds];
  next.splice(fromIndex, 1);

  if (targetSongId === "end") {
    next.push(movedSongId);
    return next;
  }

  const toIndex = next.indexOf(targetSongId);
  if (toIndex === -1) return songIds;

  next.splice(toIndex, 0, movedSongId);
  return next;
};

export const applyLocalScaleSongSettingsUpdate = (
  currentSettings: Record<string, any> | undefined,
  songId: string,
  key: string | null,
  bpm: number | null
): Record<string, any> => {
  const nextSettings = { ...(currentSettings || {}) };
  const singleSettings: any = {};
  if (key && key.trim() !== '') {
    singleSettings.key = key;
  }
  if (bpm !== null && !isNaN(bpm) && bpm >= 20 && bpm <= 300) {
    singleSettings.bpm = bpm;
  }

  if (Object.keys(singleSettings).length === 0) {
    delete nextSettings[songId];
  } else {
    nextSettings[songId] = singleSettings;
  }
  return nextSettings;
};


