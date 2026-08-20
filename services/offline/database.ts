import Dexie, { type Table } from 'dexie';
import { v4 as uuidv4 } from 'uuid';

export interface SyncOperation {
  id: string; // uuid
  entity: 'songs' | 'scales' | 'bandScales';
  action: 'create' | 'update' | 'delete';
  documentId: string;
  data?: any;
  timestamp: number;
  status: 'pending' | 'syncing' | 'failed' | 'fatal_failed';
  retryCount: number;
  error?: string;
}

export interface PerformanceRecoveryState {
  id: string;
  scaleId?: string;
  songId?: string;
  scrollPosition?: number;
  zoomLevel?: number;
  activeTab?: string;
  timestamp: number;
}

type LegacySyncQueueProcessorView = Omit<Table<SyncOperation, string>, 'add' | 'bulkAdd' | 'put' | 'bulkPut'>;

export class MusicScaleDatabase extends Dexie {
  // P3.2 diagnostic probe: production code outside this file should only be able
  // to process existing legacy records, not enqueue new ones directly. The local
  // producer below casts explicitly so TypeScript will expose any other writers.
  syncQueue!: LegacySyncQueueProcessorView;
  
  // High availability cached data (IndexedDB so we can load huge lists easily without crashing Quota)
  cachedSongs!: Table<any, string>;
  cachedScales!: Table<any, string>;
  
  // Performance mode state
  performanceState!: Table<PerformanceRecoveryState, string>;

  constructor() {
    super('MusicScaleOfflineDB');
    this.version(1).stores({
      syncQueue: 'id, entity, status, timestamp',
      cachedSongs: 'id, title, author',
      cachedScales: 'id, date, eventTypeId',
      performanceState: 'id'
    });
  }
}

export const offlineDB = new MusicScaleDatabase();

// P3.2 diagnostic probe only: requiring an organizationId here lets the full
// TypeScript/Vercel pipeline prove whether any compiled production caller still
// depends on this legacy producer API. This branch is not intended for merge.
export async function queueSyncOperation(
  organizationId: string,
  entity: SyncOperation['entity'],
  action: SyncOperation['action'],
  documentId: string,
  data?: any
) {
  void organizationId;
  await (offlineDB.syncQueue as Table<SyncOperation, string>).add({
    id: uuidv4(),
    entity,
    action,
    documentId,
    data,
    timestamp: Date.now(),
    status: 'pending',
    retryCount: 0
  });

  // Attempt sync immediately if online
  if (navigator.onLine) {
    triggerBackgroundSync();
  }
}

export async function triggerBackgroundSync() {
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator && (navigator as any).serviceWorker.ready) {
    try {
      const registration = await navigator.serviceWorker.ready;
      if ((registration as any).sync) {
        await (registration as any).sync.register('sync-musicscale');
        return;
      }
    } catch(e) {
      console.warn("Background Sync not supported by browser, falling back to foreground sync.");
    }
  }
  
  // Foreground sync fallback
  window.dispatchEvent(new Event('musicscale:sync'));
}

export async function savePerformanceState(state: Partial<PerformanceRecoveryState>) {
  await offlineDB.performanceState.put({
    id: 'current',
    timestamp: Date.now(),
    ...state
  } as PerformanceRecoveryState);
}

export async function getPerformanceState(): Promise<PerformanceRecoveryState | null> {
  const state = await offlineDB.performanceState.get('current');
  return state || null;
}

export async function clearPerformanceState() {
  await offlineDB.performanceState.delete('current');
}
