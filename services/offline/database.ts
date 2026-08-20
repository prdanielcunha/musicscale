import Dexie, { type Table } from 'dexie';

export interface SyncOperation {
  id: string;
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

export class MusicScaleDatabase extends Dexie {
  // Legacy inert storage. Existing records are deliberately preserved for
  // backwards safety, but P3.2 exposes no producer or processor that can replay
  // these unscoped operations to Firestore.
  syncQueue!: Table<SyncOperation, string>;

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
