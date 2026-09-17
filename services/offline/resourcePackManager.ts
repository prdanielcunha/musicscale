import type { PopulatedScale, PopulatedSong } from '../../types';
import { sanitizeStageScale, sanitizeStageSong } from './stageReadCache';
import { offlineDB, type OfflineResourcePack } from './database';

const STAGE_CACHE_VERSION = 1;

function scopedEntityKey(userId: string, organizationId: string, entityId: string) {
  return `${userId}::${organizationId}::${entityId}`;
}

function packKey(userId: string, organizationId: string, kind: 'library' | 'scale', targetId?: string) {
  return `${userId}::${organizationId}::${kind}${targetId ? `::${targetId}` : ''}`;
}

function timestampRevision(value: any): string {
  if (!value) return '';
  if (typeof value?.toMillis === 'function') return String(value.toMillis());
  if (value instanceof Date) return String(value.getTime());
  if (typeof value === 'object' && typeof value.seconds === 'number') {
    return `${value.seconds}:${value.nanoseconds || 0}`;
  }
  return String(value);
}

export function getOfflineSongRevision(song: PopulatedSong): string {
  const data = song as PopulatedSong & {
    lastModifiedAt?: unknown;
    chordsLastModifiedAt?: unknown;
    updatedAt?: unknown;
  };
  return [
    timestampRevision(data.lastModifiedAt),
    timestampRevision(data.chordsLastModifiedAt),
    timestampRevision(data.updatedAt),
    song.key || '',
    String(song.bpm ?? ''),
    String(song.chords?.length || 0),
    String(song.lyrics?.length || 0),
  ].join('|');
}

function buildSongRow(userId: string, organizationId: string, song: PopulatedSong, updatedAt: number) {
  const sanitized = sanitizeStageSong(song, organizationId);
  return {
    id: scopedEntityKey(userId, organizationId, sanitized.id),
    entityId: sanitized.id,
    userId,
    organizationId,
    version: STAGE_CACHE_VERSION,
    updatedAt,
    data: sanitized,
    title: sanitized.title,
    author: sanitized.artist,
  };
}

function buildScaleRow(userId: string, organizationId: string, scale: PopulatedScale, updatedAt: number) {
  const sanitized = sanitizeStageScale(scale, organizationId);
  return {
    id: scopedEntityKey(userId, organizationId, sanitized.id),
    entityId: sanitized.id,
    userId,
    organizationId,
    version: STAGE_CACHE_VERSION,
    updatedAt,
    data: sanitized,
    date: sanitized.date,
    eventTypeId: sanitized.eventType?.id,
  };
}

function assertScope(userId: string, organizationId: string) {
  if (!userId || !organizationId) throw new Error('OFFLINE_SCOPE_REQUIRED');
}

function scopedSongs(songs: PopulatedSong[], organizationId: string) {
  return songs.filter((song) => song?.id && song.organizationId === organizationId);
}

function scaleBelongsToOrganization(scale: PopulatedScale, organizationId: string) {
  const scaleOrg = (scale as PopulatedScale & { organizationId?: string }).organizationId;
  return (
    !!scale?.id &&
    scaleOrg === organizationId &&
    Array.isArray(scale.songs) &&
    scale.songs.every((song) => song.organizationId === organizationId)
  );
}

export interface OfflinePackWriteResult {
  pack: OfflineResourcePack;
  downloadedSongs: number;
  reusedSongs: number;
}

export async function downloadLibraryPack(params: {
  userId: string;
  organizationId: string;
  songs: PopulatedSong[];
}): Promise<OfflinePackWriteResult> {
  const { userId, organizationId } = params;
  assertScope(userId, organizationId);
  const songs = scopedSongs(params.songs, organizationId);
  const updatedAt = Date.now();
  const songRevisions = Object.fromEntries(songs.map((song) => [song.id, getOfflineSongRevision(song)]));
  const pack: OfflineResourcePack = {
    id: packKey(userId, organizationId, 'library'),
    userId,
    organizationId,
    kind: 'library',
    songIds: songs.map((song) => song.id),
    songRevisions,
    scaleIds: [],
    updatedAt,
  };

  await offlineDB.transaction('rw', offlineDB.cachedSongs, offlineDB.offlineResourcePacks, async () => {
    if (songs.length > 0) {
      await offlineDB.cachedSongs.bulkPut(
        songs.map((song) => buildSongRow(userId, organizationId, song, updatedAt)),
      );
    }
    await offlineDB.offlineResourcePacks.put(pack);
  });

  return { pack, downloadedSongs: songs.length, reusedSongs: 0 };
}

export async function downloadScalePack(params: {
  userId: string;
  organizationId: string;
  scale: PopulatedScale;
}): Promise<OfflinePackWriteResult> {
  const { userId, organizationId, scale } = params;
  assertScope(userId, organizationId);
  if (!scaleBelongsToOrganization(scale, organizationId)) throw new Error('OFFLINE_SCALE_SCOPE_MISMATCH');

  const updatedAt = Date.now();
  const libraryPack = await offlineDB.offlineResourcePacks.get(
    packKey(userId, organizationId, 'library'),
  );
  const songs = scopedSongs(scale.songs || [], organizationId);
  const missingFromLibrary = songs.filter(
    (song) => libraryPack?.songRevisions?.[song.id] !== getOfflineSongRevision(song),
  );
  const songRevisions = Object.fromEntries(songs.map((song) => [song.id, getOfflineSongRevision(song)]));
  const pack: OfflineResourcePack = {
    id: packKey(userId, organizationId, 'scale', scale.id),
    userId,
    organizationId,
    kind: 'scale',
    targetId: scale.id,
    songIds: songs.map((song) => song.id),
    songRevisions,
    scaleIds: [scale.id],
    updatedAt,
    label: `${scale.eventName?.name || scale.eventType?.name || 'Scale'} · ${scale.date}`,
  };

  await offlineDB.transaction(
    'rw',
    offlineDB.cachedSongs,
    offlineDB.cachedScales,
    offlineDB.offlineResourcePacks,
    async () => {
      if (missingFromLibrary.length > 0) {
        await offlineDB.cachedSongs.bulkPut(
          missingFromLibrary.map((song) => buildSongRow(userId, organizationId, song, updatedAt)),
        );
      }
      await offlineDB.cachedScales.put(buildScaleRow(userId, organizationId, scale, updatedAt));
      await offlineDB.offlineResourcePacks.put(pack);
    },
  );

  return {
    pack,
    downloadedSongs: missingFromLibrary.length,
    reusedSongs: songs.length - missingFromLibrary.length,
  };
}

export async function listOfflineResourcePacks(userId: string, organizationId: string) {
  if (!userId || !organizationId) return [] as OfflineResourcePack[];
  const rows = await offlineDB.offlineResourcePacks.toArray();
  return rows
    .filter((row) => row.userId === userId && row.organizationId === organizationId)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function removeOfflineResourcePack(
  userId: string,
  organizationId: string,
  kind: 'library' | 'scale',
  targetId?: string,
) {
  assertScope(userId, organizationId);
  await offlineDB.offlineResourcePacks.delete(packKey(userId, organizationId, kind, targetId));
}

export async function getOfflineStorageEstimate() {
  if (typeof navigator === 'undefined' || !navigator.storage?.estimate) {
    return { usage: 0, quota: 0 };
  }
  const estimate = await navigator.storage.estimate();
  return { usage: estimate.usage || 0, quota: estimate.quota || 0 };
}
