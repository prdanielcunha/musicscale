import { Song, FreshnessMetadata, FreshnessStatus } from '../types';

/**
 * Normalizes a song's freshness data.
 * If the song doesn't have a structured freshness object,
 * it checks the legacy `isNew` boolean flag or provides a safe default.
 */
export const normalizeSongFreshness = (song: Partial<Song>): FreshnessMetadata => {
  if (song.freshness) {
    return song.freshness;
  }

  // Legacy behavior fallback
  // If isNew was explicitly set to true, it's 'new'
  if (song.isNew === true) {
    return {
      status: 'new',
      source: 'auto',
      autoUpdatedAt: song.createdAt || new Date().toISOString()
    };
  }

  // Default fallback for old records
  return {
    status: 'default',
    source: 'auto'
  };
};

/**
 * Helper to get the canonical freshness status for UI rendering
 */
export const getSongFreshnessStatus = (song: Partial<Song>): FreshnessStatus => {
  return normalizeSongFreshness(song).status;
};
