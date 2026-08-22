import type {
  CreatedBy,
  EventName,
  EventType,
  Location,
  PopulatedScale,
  PopulatedSong,
  Scale,
  Tag,
} from '../../types';
import { offlineDB } from './database';

const STAGE_CACHE_VERSION = 1;
export const STAGE_CACHE_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;
const FUTURE_CLOCK_SKEW_MS = 5 * 60 * 1000;

interface StageCacheRow<T> {
  id: string;
  entityId: string;
  userId: string;
  organizationId: string;
  version: number;
  updatedAt: number;
  data: T;
  title?: string;
  author?: string;
  date?: string;
  eventTypeId?: string;
}

export interface OfflineStageReadSnapshot {
  songs: PopulatedSong[];
  scales: Scale[];
  populatedScales: PopulatedScale[];
  eventTypes: EventType[];
  locations: Location[];
  eventNames: EventName[];
  tags: Tag[];
  updatedAt: number;
}

const EMPTY_ACTOR: CreatedBy = {
  uid: '',
  displayName: null,
  photoURL: null,
};

function cacheKey(userId: string, organizationId: string, entityId: string): string {
  return `${userId}::${organizationId}::${entityId}`;
}

function sanitizeNamedResource<T extends { id: string; name: string }>(resource: T): T {
  return { id: resource.id, name: resource.name } as T;
}

function sanitizeTag(tag: Tag): Tag {
  return { id: tag.id, name: tag.name };
}

export function sanitizeStageSong(song: PopulatedSong, organizationId: string): PopulatedSong {
  const {
    importedBy: _importedBy,
    lastModifiedBy: _lastModifiedBy,
    chordsCreatedBy: _chordsCreatedBy,
    chordsLastModifiedBy: _chordsLastModifiedBy,
    ...rest
  } = song;

  return {
    ...rest,
    organizationId,
    createdBy: EMPTY_ACTOR,
    lastModifiedBy: null,
    chordsCreatedBy: null,
    chordsLastModifiedBy: null,
    tags: (song.tags || []).map(sanitizeTag),
  };
}

export function sanitizeStageScale(
  scale: PopulatedScale,
  organizationId: string,
): PopulatedScale {
  const {
    bandScale: _bandScale,
    createdBy: _createdBy,
    lastModifiedBy: _lastModifiedBy,
    ...rest
  } = scale as PopulatedScale & { eventAssignments?: unknown; organizationId?: string };

  const { eventAssignments: _eventAssignments, ...withoutAssignments } = rest as typeof rest & {
    eventAssignments?: unknown;
  };

  return {
    ...withoutAssignments,
    organizationId,
    songs: (scale.songs || []).map((song) => sanitizeStageSong(song, organizationId)),
    eventType: sanitizeNamedResource(scale.eventType),
    location: sanitizeNamedResource(scale.location),
    eventName: scale.eventName ? sanitizeNamedResource(scale.eventName) : undefined,
    bandScale: undefined,
    createdBy: EMPTY_ACTOR,
    lastModifiedBy: null,
  } as PopulatedScale;
}

function toRawScale(scale: PopulatedScale): Scale {
  const {
    songs: _songs,
    eventType: _eventType,
    location: _location,
    eventName: _eventName,
    bandScale: _bandScale,
    ...raw
  } = scale;
  return raw as Scale;
}

function uniqueById<T extends { id: string }>(values: T[]): T[] {
  const result = new Map<string, T>();
  values.forEach((value) => {
    if (value?.id && !result.has(value.id)) result.set(value.id, value);
  });
  return Array.from(result.values());
}

function isValidTimestamp(updatedAt: unknown, now: number): updatedAt is number {
  return (
    typeof updatedAt === 'number' &&
    Number.isFinite(updatedAt) &&
    updatedAt > 0 &&
    updatedAt <= now + FUTURE_CLOCK_SKEW_MS &&
    now - updatedAt <= STAGE_CACHE_MAX_AGE_MS
  );
}

function isValidSongRow(
  row: StageCacheRow<PopulatedSong>,
  userId: string,
  organizationId: string,
  now: number,
): boolean {
  return (
    row?.version === STAGE_CACHE_VERSION &&
    row.userId === userId &&
    row.organizationId === organizationId &&
    row.id === cacheKey(userId, organizationId, row.entityId) &&
    isValidTimestamp(row.updatedAt, now) &&
    !!row.data &&
    row.data.id === row.entityId &&
    row.data.organizationId === organizationId
  );
}

function isValidScaleRow(
  row: StageCacheRow<PopulatedScale>,
  userId: string,
  organizationId: string,
  now: number,
): boolean {
  const dataOrgId = (row?.data as PopulatedScale & { organizationId?: string } | undefined)?.organizationId;
  return (
    row?.version === STAGE_CACHE_VERSION &&
    row.userId === userId &&
    row.organizationId === organizationId &&
    row.id === cacheKey(userId, organizationId, row.entityId) &&
    isValidTimestamp(row.updatedAt, now) &&
    !!row.data &&
    row.data.id === row.entityId &&
    dataOrgId === organizationId &&
    Array.isArray(row.data.songs) &&
    row.data.songs.every((song) => song.organizationId === organizationId)
  );
}

function isScaleProvenForOrganization(
  scale: PopulatedScale,
  organizationId: string,
): boolean {
  const scaleOrganizationId = (scale as PopulatedScale & { organizationId?: string }).organizationId;
  return (
    !!scale?.id &&
    scaleOrganizationId === organizationId &&
    Array.isArray(scale.songs) &&
    scale.songs.every((song) => song.organizationId === organizationId)
  );
}

export async function writeOfflineStageReadCache(
  userId: string,
  organizationId: string,
  songs: PopulatedSong[],
  populatedScales: PopulatedScale[],
  updatedAt = Date.now(),
): Promise<void> {
  if (!userId || !organizationId || !isValidTimestamp(updatedAt, Date.now())) return;

  const sanitizedSongs = songs
    .filter((song) => song?.id && song.organizationId === organizationId)
    .map((song) => sanitizeStageSong(song, organizationId));
  const sanitizedScales = populatedScales
    .filter((scale) => isScaleProvenForOrganization(scale, organizationId))
    .map((scale) => sanitizeStageScale(scale, organizationId));

  const songRows: StageCacheRow<PopulatedSong>[] = sanitizedSongs.map((song) => ({
    id: cacheKey(userId, organizationId, song.id),
    entityId: song.id,
    userId,
    organizationId,
    version: STAGE_CACHE_VERSION,
    updatedAt,
    data: song,
    title: song.title,
    author: song.artist,
  }));
  const scaleRows: StageCacheRow<PopulatedScale>[] = sanitizedScales.map((scale) => ({
    id: cacheKey(userId, organizationId, scale.id),
    entityId: scale.id,
    userId,
    organizationId,
    version: STAGE_CACHE_VERSION,
    updatedAt,
    data: scale,
    date: scale.date,
    eventTypeId: scale.eventType?.id,
  }));

  await offlineDB.transaction('rw', offlineDB.cachedSongs, offlineDB.cachedScales, async () => {
    const [existingSongs, existingScales] = await Promise.all([
      offlineDB.cachedSongs.toArray(),
      offlineDB.cachedScales.toArray(),
    ]);

    const priorSongKeys = existingSongs
      .filter((row: any) => row?.userId === userId && row?.organizationId === organizationId)
      .map((row: any) => row.id)
      .filter((id: unknown): id is string => typeof id === 'string');
    const priorScaleKeys = existingScales
      .filter((row: any) => row?.userId === userId && row?.organizationId === organizationId)
      .map((row: any) => row.id)
      .filter((id: unknown): id is string => typeof id === 'string');

    if (priorSongKeys.length > 0) await offlineDB.cachedSongs.bulkDelete(priorSongKeys);
    if (priorScaleKeys.length > 0) await offlineDB.cachedScales.bulkDelete(priorScaleKeys);
    if (songRows.length > 0) await offlineDB.cachedSongs.bulkPut(songRows);
    if (scaleRows.length > 0) await offlineDB.cachedScales.bulkPut(scaleRows);
  });
}

export async function readOfflineStageReadCache(
  userId: string,
  organizationId: string,
  now = Date.now(),
): Promise<OfflineStageReadSnapshot | null> {
  if (!userId || !organizationId) return null;

  const [allSongRows, allScaleRows] = await Promise.all([
    offlineDB.cachedSongs.toArray(),
    offlineDB.cachedScales.toArray(),
  ]);

  const scopedSongRows = allSongRows.filter(
    (row: any) => row?.userId === userId && row?.organizationId === organizationId,
  ) as StageCacheRow<PopulatedSong>[];
  const scopedScaleRows = allScaleRows.filter(
    (row: any) => row?.userId === userId && row?.organizationId === organizationId,
  ) as StageCacheRow<PopulatedScale>[];

  if (scopedSongRows.length === 0 && scopedScaleRows.length === 0) {
    return null;
  }

  if (
    scopedSongRows.some((row) => !isValidSongRow(row, userId, organizationId, now)) ||
    scopedScaleRows.some((row) => !isValidScaleRow(row, userId, organizationId, now))
  ) {
    return null;
  }

  const songs = scopedSongRows.map((row) => row.data);
  const populatedScales = scopedScaleRows
    .map((row) => row.data)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const eventTypes = uniqueById(populatedScales.map((scale) => scale.eventType).filter(Boolean));
  const locations = uniqueById(populatedScales.map((scale) => scale.location).filter(Boolean));
  const eventNames = uniqueById(
    populatedScales.map((scale) => scale.eventName).filter((value): value is EventName => !!value),
  );
  const tags = uniqueById(songs.flatMap((song) => song.tags || []));
  const timestamps = [
    ...scopedSongRows.map((row) => row.updatedAt),
    ...scopedScaleRows.map((row) => row.updatedAt),
  ];

  return {
    songs,
    scales: populatedScales.map(toRawScale),
    populatedScales,
    eventTypes,
    locations,
    eventNames,
    tags,
    updatedAt: Math.min(...timestamps),
  };
}
