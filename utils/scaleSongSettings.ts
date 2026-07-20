import { Song, ScaleSongSettings } from '../types';
import { getKeyDifference, parseChordsAndLyrics, transposeChord } from '../components/songs/ChordsRenderer';

export const getEffectiveKey = (song: Song, settings?: ScaleSongSettings): string => {
  if (settings && settings.key) return settings.key;
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
      const validKey = typeof key === 'string' ? key.trim() || undefined : undefined;
      const bpmNum = typeof bpm === 'string' ? Number(bpm.trim()) : typeof bpm === 'number' ? bpm : NaN;
      const validBpm = (!isNaN(bpmNum) && bpmNum >= 20 && bpmNum <= 300) ? bpmNum : undefined;
      
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
  if (!settings) return song;

  // Clone the song to avoid mutating the original object
  const newSong = { ...song };

  if (settings.key !== undefined && settings.key !== null) {
    const semitones = newSong.key ? getKeyDifference(newSong.key, settings.key) : 0;
    
    newSong.key = settings.key;
    // We update selectedKey too so UI components expecting that use the effective key
    newSong.selectedKey = settings.key;

    if (semitones !== 0 && newSong.chords && newSong.chords.trim().length > 0) {
        const parsed = parseChordsAndLyrics(newSong.chords);
        newSong.chords = parsed.map(line => 
            line.type === 'chord' ? transposeChord(line.content, semitones) : line.content
        ).join('\n');
    }
  }

  if (settings.bpm !== undefined && settings.bpm !== null) {
    newSong.bpm = settings.bpm;
  }

  return newSong;
};
