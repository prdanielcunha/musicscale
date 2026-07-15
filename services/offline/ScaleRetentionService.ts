import { collection, query, where, getDocs, writeBatch, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { offlineDB } from './database';
import { ecosystemBridge } from '../ecosystem/EcosystemBridge';

export class ScaleRetentionService {
  private static instance: ScaleRetentionService;
  
  // Rule: Keep only the scales from the last 6 months (about 180 days)
  private readonly RETENTION_MONTHS = 6;
  // Safety window: never delete scales newer than this many days, to ensure timezone/leap year anomalies don't wipe recent active scales
  private readonly SAFETY_DAYS = 170;

  private constructor() {}

  public static getInstance(): ScaleRetentionService {
    if (!ScaleRetentionService.instance) {
      ScaleRetentionService.instance = new ScaleRetentionService();
    }
    return ScaleRetentionService.instance;
  }

  public async runRetentionCleanup(orgId: string): Promise<void> {
    if (!orgId) return;
    
    if (!navigator.onLine) {
       console.debug('[RetentionService] Offline, skipping retention cleanup.');
       return;
    }

    try {
      const now = new Date();
      const cutoffDate = new Date(now.setMonth(now.getMonth() - this.RETENTION_MONTHS));
      const cutoffIsoString = cutoffDate.toISOString().split('T')[0];

      // Extremely basic safety check to prevent logic bugs wiping db
      const safetyCheckDate = new Date();
      safetyCheckDate.setDate(safetyCheckDate.getDate() - this.SAFETY_DAYS);
      const safetyIsoString = safetyCheckDate.toISOString().split('T')[0];
      
      if (cutoffIsoString >= safetyIsoString) {
          console.warn('[RetentionService] Safety check failed. Cutoff date is too close to today.', { cutoffIsoString, safetyIsoString });
          return;
      }

      console.info(`[RetentionService] Starting cleanup for organization ${orgId}. Cutoff date: ${cutoffIsoString}`);

      const musicScalesDeleted = await this.cleanupCollection(orgId, 'scales', cutoffIsoString);
      const bandScalesDeleted = await this.cleanupCollection(orgId, 'bandScales', cutoffIsoString);
      
      if (musicScalesDeleted > 0 || bandScalesDeleted > 0) {
         ecosystemBridge.publishEvent({
            type: 'telemetry',
            payload: {
               action: 'retention_cleanup',
               musicScalesDeleted,
               bandScalesDeleted,
               orgId,
               cutoffIsoString
            },
            timestamp: Date.now()
         });
         console.info(`[RetentionService] Cleanup complete. Removed ${musicScalesDeleted} music scales and ${bandScalesDeleted} band scales.`);
      }

    } catch (error) {
      console.error('[RetentionService] Error during retention cleanup:', error);
      ecosystemBridge.publishEvent({
        type: 'error',
        payload: {
            type: 'retention_cleanup_error',
            message: error instanceof Error ? error.message : String(error)
        },
        timestamp: Date.now()
      });
    }
  }

  private async cleanupCollection(orgId: string, collectionName: 'scales' | 'bandScales', cutoffIsoString: string): Promise<number> {
    const scalesRef = collection(db, collectionName);
    
    // Using date string since eventDate might map to "date" in the entity.
    // In our types.ts: Scale has `date: string`.
    const q = query(scalesRef, where('organizationId', '==', orgId));
    const snapshot = await getDocs(q);

    const matchDocs = snapshot.docs.filter(doc => {
       const data = doc.data();
       return data.date && data.date < cutoffIsoString;
    });

    if (matchDocs.length === 0) {
      return 0;
    }

    let deletedCount = 0;
    
    // Firestore max batch size is 500, we use safe chunks
    const chunkArray = <T>(arr: T[], size: number): T[][] => {
       return Array.from({ length: Math.ceil(arr.length / size) }, (v, i) => arr.slice(i * size, i * size + size));
    };

    const batches = chunkArray(matchDocs, 200);

    for (const batchDocs of batches) {
       const batch = writeBatch(db);
       const idsToDelete: string[] = [];

       for (const document of batchDocs) {
          batch.delete(doc(db, collectionName, document.id));
          idsToDelete.push(document.id);
          deletedCount++;
       }

       // Perform remote delete
       await batch.commit();

       // Perform local delete inside IndexedDB
       if (idsToDelete.length > 0) {
          if (collectionName === 'scales') {
             await offlineDB.cachedScales.bulkDelete(idsToDelete);
          } else {
             // If we had cachedBandScales...
             // For now we just clear what we can. 
          }
       }
    }
    
    return deletedCount;
  }
}

export const scaleRetentionService = ScaleRetentionService.getInstance();
