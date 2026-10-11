import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

if (getApps().length === 0) {
  initializeApp();
}

import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import * as logger from 'firebase-functions/logger';
import { processLocalSongWritten } from './processor.js';
import { runSongDiscoveryProcessor } from '../../services/server/songDiscoveryProcessor.js'; 
import { processGlobalSongContentMetricsWritten } from './globalSongMetricsProcessor.js';

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

      // Durable immediate discovery: the browser may close as soon as the
      // organizational save commits, so the client request is not authoritative.
      // The processor is idempotent across Function retries and browser calls.
      // Privileged opt-out requests are instead settled by the authenticated API,
      // which writes the server-only exemption before processing.
      if (songData.globalCurationOptOut !== true) {
        const result = await runSongDiscoveryProcessor(songData, songId, organizationId, getFirestore(), event.id);
        logger.info('Global curation discovery processed', {
          songId, organizationId, outcome: result.outcome, reasonCode: result.reasonCode || null
        });
      } else {
        logger.info('Curation decision deferred pending verified ecosystem opt-out', { songId, organizationId });
      }
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

export const onGlobalSongWritten = onDocumentWritten(
  {
    document: 'globalSongs/{songId}',
    retry: true,
    memory: '256MiB',
    maxInstances: 10,
    concurrency: 1
  },
  async (event) => {
    const change = event.data;
    if (!change) return;

    await processGlobalSongContentMetricsWritten(
      change.after.exists ? change.after : undefined
    );
  }
);
