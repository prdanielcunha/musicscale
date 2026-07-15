import * as logger from 'firebase-functions/logger';
import { getFirestore } from 'firebase-admin/firestore';
import { SongDiscoveryInboxService } from '../../services/server/songDiscoveryInboxService.js';

export async function processLocalSongWritten(
  snapshot: any,
  songId: string,
  organizationId: string,
  injectedDb?: any
): Promise<void> {
  const db = injectedDb || getFirestore();
  const songData = snapshot.data();

  try {
    const inboxService = new SongDiscoveryInboxService(db);
    await inboxService.registerInboxRecord(songId, organizationId, songData);
    logger.info('Inbox record registered successfully', { songId, organizationId });
  } catch (err: unknown) {
    logger.error('Transient registration error inside Firebase Function context', { songId });
    throw err; // Bubbles up so Cloud Functions retry mechanism does its configured job.
  }
}

