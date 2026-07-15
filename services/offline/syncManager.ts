import { offlineDB, type SyncOperation } from './database';
import { db } from '../firebase';
import { doc, setDoc, updateDoc, deleteDoc, collection, addDoc, getDoc } from 'firebase/firestore';
import { ecosystemBridge } from '../ecosystem/EcosystemBridge'; // Added ecosystem bridge

let isSyncing = false;

// Conflict Detection: If remote doc is newer than the operation's timestamp, we skip an update/delete to avoid overwriting newer remote data.
export async function processSyncQueue(organizationId: string) {
  if (isSyncing || !navigator.onLine || !organizationId) return;
  isSyncing = true;

  try {
    const queue = await offlineDB.syncQueue
      .where('status')
      .anyOf('pending', 'failed')
      .sortBy('timestamp');

    let consecutiveFailures = 0;

    for (const op of queue) {
      if (op.retryCount > 8) {
         // Queue corruption / stuck prevention: Mark fatal
         await offlineDB.syncQueue.update(op.id, { status: 'fatal_failed' });
         ecosystemBridge.publishEvent({ type: 'telemetry', payload: { action: 'sync_fatal_error', op, error: op.error }, timestamp: Date.now() });
         continue; 
      }

      try {
        await offlineDB.syncQueue.update(op.id, { status: 'syncing' });
        
        const success = await applyOperationToFirebaseSafe(organizationId, op);

        if (success) {
           await offlineDB.syncQueue.delete(op.id);
           consecutiveFailures = 0;
        } else {
           // Skip if safe operation decided it was a conflict
           await offlineDB.syncQueue.delete(op.id); 
           ecosystemBridge.publishEvent({ type: 'telemetry', payload: { action: 'sync_conflict_resolved', op }, timestamp: Date.now() });
        }
      } catch (error: any) {
        console.error(`Sync failed for operation ${op.id}`, error);
        consecutiveFailures++;
        await offlineDB.syncQueue.update(op.id, { 
          status: 'failed', 
          retryCount: op.retryCount + 1,
          error: error.message || 'Unknown error'
        });
        
        // Circuit breaker: after 3 consecutive failures, assume network is partitioned.
        if (consecutiveFailures > 3) {
            ecosystemBridge.publishEvent({ type: 'telemetry', payload: { action: 'sync_circuit_breaker_open' }, timestamp: Date.now() });
            break; 
        }
      }
    }
  } finally {
    isSyncing = false;
  }
}

async function applyOperationToFirebaseSafe(orgId: string, op: SyncOperation): Promise<boolean> {
  const collPath = `organizations/${orgId}/${op.entity}`;
  
  // Conflict verification for updates/deletes
  if (op.action === 'update' || op.action === 'delete') {
      if (op.documentId) {
          const docRef = doc(db, collPath, op.documentId);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
             const data = docSnap.data();
             // If remote doc was updated after we queued this operation, and it's not our own change
             if (data.updatedAt && op.timestamp && data.updatedAt > op.timestamp + 5000) {
                 console.warn("Conflict detected. Remote is newer. Skipping operation.", op);
                 return false;
             }
          }
      }
  }
  
  if (op.action === 'create') {
    if (op.documentId) {
      await setDoc(doc(db, collPath, op.documentId), op.data);
    } else {
      await addDoc(collection(db, collPath), op.data);
    }
  } else if (op.action === 'update') {
    await updateDoc(doc(db, collPath, op.documentId), op.data);
  } else if (op.action === 'delete') {
    await deleteDoc(doc(db, collPath, op.documentId));
  }
  return true;
}

export const triggerBackgroundSync = async (orgId: string) => {
  if ('serviceWorker' in navigator && 'SyncManager' in window) {
      try {
          const registration = await navigator.serviceWorker.ready;
          // Fallback to foreground sync if background sync isn't supported/permitted by the browser immediately
          // Actually triggering processSyncQueue instead of depending purely on SW.
          processSyncQueue(orgId);
      } catch (err) {
          console.log('Background Sync could not be registered', err);
          processSyncQueue(orgId);
      }
  } else {
      processSyncQueue(orgId);
  }
};

// Set up foreground listeners
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
     window.dispatchEvent(new Event('musicscale:sync'));
  });
}
