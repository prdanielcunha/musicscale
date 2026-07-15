import { initializeApp, getApps } from 'firebase-admin/app';

if (getApps().length === 0) {
  initializeApp();
}

import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import * as logger from 'firebase-functions/logger';
import { processLocalSongWritten } from './processor.js'; 

export * from './notifications.js';

export const onLocalSongWritten = onDocumentWritten(
  {
    document: 'songs/{songId}',
    retry: true,        
    memory: '256MiB',
    maxInstances: 10,
    concurrency: 1      
  },
  async (event) => {
    const change = event.data;
    if (!change) {
      logger.info('No data associated with the event', { eventId: event.id });
      return;
    }

    const songId = event.params.songId;
    const songData = change.after.exists ? change.after.data() : null;
    
    // If deleted, we don't need to process discovering it.
    if (!songData) {
        return;
    }

    const organizationId = songData?.organizationId;

    if (!organizationId) {
      logger.info('Ignored: Song has no organizationId context', { songId });
      return;
    }
    
    try {
      await processLocalSongWritten(change.after, songId, organizationId);
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : "Unknown error";
      logger.error('Error processing song write', {
        error: errMsg,
        songId,
        organizationId
      });
      throw error; 
    }
  }
);
