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
  organizationId?: string;
  scaleId?: string;
  songId?: string;
  scrollPosition?: number;
  zoomLevel?: number;
  activeTab?: string;
  timestamp: number;
}

export interface OfflineResourcePack {
  id: string;
  userId: string;
  organizationId: string;
  kind: 'library' | 'scale';
  targetId?: string;
  songIds: string[];
  songRevisions: Record<string, string>;
  scaleIds: string[];
  updatedAt: number;
  label?: string;
}

export interface CustomPadAssetRow {
  id: string;
  userId: string;
  organizationId: string;
  name: string;
  mimeType: string;
  size: number;
  baseKey: string;
  blob: Blob;
  updatedAt: number;
}

export class MusicScaleDatabase extends Dexie {
  // Legacy inert storage. Existing records are deliberately preserved for
  // backwards safety, but P3.2 exposes no producer or processor that can replay
  // these unscoped operations to Firestore.
  syncQueue!: Table<SyncOperation, string>;

  // High availability cached data (IndexedDB so we can load huge lists easily without crashing Quota)
  cachedSongs!: Table<any, string>;
  cachedScales!: Table<any, string>;

  // Explicit offline resource manifests. Payloads continue to live in the
  // canonical cachedSongs/cachedScales tables so scale/library downloads share
  // the same copies instead of duplicating repertoire data.
  offlineResourcePacks!: Table<OfflineResourcePack, string>;

  // User-provided Pad audio remains local to this browser/device and is scoped
  // by UID + organization. It is never uploaded by this database layer.
  customPadAssets!: Table<CustomPadAssetRow, string>;

  // Performance mode state. organizationId is intentionally not indexed: adding
  // tenant scope to the value does not require an IndexedDB schema migration.
  performanceState!: Table<PerformanceRecoveryState, string>;

  constructor() {
    super('MusicScaleOfflineDB');
    this.version(1).stores({
      syncQueue: 'id, entity, status, timestamp',
      cachedSongs: 'id, title, author',
      cachedScales: 'id, date, eventTypeId',
      performanceState: 'id'
    });
    this.version(2).stores({
      syncQueue: 'id, entity, status, timestamp',
      cachedSongs: 'id, title, author',
      cachedScales: 'id, date, eventTypeId',
      performanceState: 'id',
      offlineResourcePacks: 'id, userId, organizationId, kind, targetId, updatedAt',
      customPadAssets: 'id, userId, organizationId, updatedAt'
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
