import { doc, getDoc, writeBatch, runTransaction } from 'firebase/firestore';
import { db } from './firebase';
import { FreshnessStatus, FreshnessSource, UserProfile } from '../types';

/**
 * Validates and updates freshness status for a batch of songs.
 * Ensures that the songs belong to the provided organizationId before updating.
 */
export const updateSongFreshnessInBatch = async (
  organizationId: string,
  songIds: string[],
  status: FreshnessStatus,
  source: FreshnessSource
) => {
  if (!organizationId) throw new Error("organizationId is required");
  if (!songIds || songIds.length === 0) return;
  
  // Limiting batch size to 500 which is Firestore's limit
  if (songIds.length > 500) {
    throw new Error("Batch size cannot exceed 500");
  }

  const batch = writeBatch(db);
  const nowIso = new Date().toISOString();

  // We should read each doc to ensure it belongs to the org.
  // In a real high-volume app, we might just trust security rules, 
  // but a read-verify-write is safer for multi-tenant isolation.
  const promises = songIds.map(async (id) => {
    const docRef = doc(db, 'songs', id);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      if (data?.organizationId === organizationId) {
        batch.update(docRef, {
          freshness: {
            status,
            source,
            manualResetAt: source === 'manual' ? nowIso : (data.freshness?.manualResetAt || null),
            autoUpdatedAt: source === 'auto' ? nowIso : (data.freshness?.autoUpdatedAt || null)
          }
        });
      }
    }
  });

  await Promise.all(promises);
  await batch.commit();
};

/**
 * Validates and updates language for a batch of songs.
 */
export const updateSongLanguageInBatch = async (
  organizationId: string,
  songIds: string[],
  language: string
) => {
  if (!organizationId) throw new Error("organizationId is required");
  if (!songIds || songIds.length === 0) return;
  if (songIds.length > 500) throw new Error("Batch size cannot exceed 500");

  const batch = writeBatch(db);

  const promises = songIds.map(async (id) => {
    const docRef = doc(db, 'songs', id);
    const snap = await getDoc(docRef);
    if (snap.exists() && snap.data()?.organizationId === organizationId) {
      batch.update(docRef, { language });
    }
  });

  await Promise.all(promises);
  await batch.commit();
};

/**
 * Validates and adjusts tags for a batch of songs.
 */
export const updateSongTagIdsInBatch = async (
  organizationId: string,
  songIds: string[],
  tagIdsToAdd: string[] = [],
  tagIdsToRemove: string[] = []
) => {
  if (!organizationId) throw new Error("organizationId is required");
  if (!songIds || songIds.length === 0) return;
  if (songIds.length > 500) throw new Error("Batch size cannot exceed 500");

  const batch = writeBatch(db);

  const promises = songIds.map(async (id) => {
    const docRef = doc(db, 'songs', id);
    const snap = await getDoc(docRef);
    if (snap.exists() && snap.data()?.organizationId === organizationId) {
      const data = snap.data();
      let currentTags: string[] = data.tagIds || [];
      
      // Remove tags
      if (tagIdsToRemove.length > 0) {
        currentTags = currentTags.filter(t => !tagIdsToRemove.includes(t));
      }
      
      // Add tags
      if (tagIdsToAdd.length > 0) {
        tagIdsToAdd.forEach(tagId => {
          if (!currentTags.includes(tagId)) {
            currentTags.push(tagId);
          }
        });
      }

      batch.update(docRef, { tagIds: currentTags });
    }
  });

  await Promise.all(promises);
  await batch.commit();
};

export interface LastScheduledResult {
  requested: number;
  updated: number;
  skippedOlderOrEqual: number;
  skippedWrongOrganization: number;
  missing: number;
  failed: number;
}

const isValidDateOnly = (dateStr: string): boolean => {
  if (!dateStr) return false;
  // Format YYYY-MM-DD
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateStr)) return false;
  const parts = dateStr.split('-');
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);
  if (year < 1900 || year > 2100) return false;
  if (month < 1 || month > 12) return false;
  
  // calendar-safe day count validation
  const dateObj = new Date(year, month - 1, day);
  return dateObj.getFullYear() === year && dateObj.getMonth() === month - 1 && dateObj.getDate() === day;
};

const normalizeDateOnly = (dateVal: any): string | null => {
  if (typeof dateVal !== 'string') return null;
  const trimmed = dateVal.trim();
  return isValidDateOnly(trimmed) ? trimmed : null;
};

/**
 * Safely updates lastScheduledAt in local 'songs' using atomic Firestore transactions.
 * Never touches globalSongs, enforces multi-tenancy, and preserves monotonicity.
 */
export const updateSongsLastScheduledAtSafely = async ({
  organizationId,
  songIds,
  scheduledDate
}: {
  organizationId: string;
  songIds: string[];
  scheduledDate: string;
}): Promise<LastScheduledResult> => {
  if (!organizationId) throw new Error("organizationId is required");
  
  const result: LastScheduledResult = {
    requested: 0,
    updated: 0,
    skippedOlderOrEqual: 0,
    skippedWrongOrganization: 0,
    missing: 0,
    failed: 0
  };

  if (!songIds || songIds.length === 0) {
    return result;
  }

  // 1. Clean duplicates & empty IDs
  const uniqueSongIds = Array.from(new Set(songIds.filter(id => typeof id === 'string' && id.trim() !== '')));
  result.requested = uniqueSongIds.length;
  if (uniqueSongIds.length === 0) {
    return result;
  }

  // 2. Validate scheduledDate (YYYY-MM-DD)
  const normalizedScheduled = normalizeDateOnly(scheduledDate);
  if (!normalizedScheduled) {
    throw new Error(`Invalid scheduledDate format: ${scheduledDate}. Expected YYYY-MM-DD.`);
  }

  // 3. Process with controlled concurrency to prevent transaction spikes
  const CONCURRENCY_LIMIT = 5;
  const chunks: string[][] = [];
  for (let i = 0; i < uniqueSongIds.length; i += CONCURRENCY_LIMIT) {
    chunks.push(uniqueSongIds.slice(i, i + CONCURRENCY_LIMIT));
  }

  for (const chunk of chunks) {
    await Promise.all(chunk.map(async (songId) => {
      const songRef = doc(db, 'songs', songId);
      try {
        await runTransaction(db, async (transaction) => {
          const snapshot = await transaction.get(songRef);
          if (!snapshot.exists()) {
            result.missing++;
            return;
          }
          const song = snapshot.data();
          if (song.organizationId !== organizationId) {
            result.skippedWrongOrganization++;
            return;
          }

          const current = normalizeDateOnly(song.lastScheduledAt);
          if (!current || normalizedScheduled > current) {
            transaction.update(songRef, {
              lastScheduledAt: normalizedScheduled
            });
            result.updated++;
          } else {
            result.skippedOlderOrEqual++;
          }
        });
      } catch (err) {
        console.error(`Error updating lastScheduledAt for song ${songId}:`, err);
        result.failed++;
      }
    }));
  }

  return result;
};
