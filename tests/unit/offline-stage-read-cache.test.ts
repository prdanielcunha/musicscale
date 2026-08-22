import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PopulatedScale, PopulatedSong } from '../../types';

const { dbState, cachedSongs, cachedScales, transaction } = vi.hoisted(() => {
  const state = {
    songs: [] as any[],
    scales: [] as any[],
  };

  const createTable = (key: 'songs' | 'scales') => ({
    toArray: vi.fn(async () => [...state[key]]),
    bulkDelete: vi.fn(async (ids: string[]) => {
      state[key] = state[key].filter((row) => !ids.includes(row.id));
    }),
    bulkPut: vi.fn(async (rows: any[]) => {
      const ids = new Set(rows.map((row) => row.id));
      state[key] = state[key].filter((row) => !ids.has(row.id));
      state[key].push(...rows);
    }),
  });

  return {
    dbState: state,
    cachedSongs: createTable('songs'),
    cachedScales: createTable('scales'),
    transaction: vi.fn(
      async (
        _mode: string,
        _songs: unknown,
        _scales: unknown,
        callback: () => Promise<void>,
      ) => callback(),
    ),
  };
});

vi.mock('../../services/offline/database', () => ({
  offlineDB: {
    cachedSongs,
    cachedScales,
    transaction,
  },
}));

import {
  readOfflineStageReadCache,
  sanitizeStageScale,
  sanitizeStageSong,
  STAGE_CACHE_MAX_AGE_MS,
  writeOfflineStageReadCache,
} from '../../services/offline/stageReadCache';

const actor = {
  uid: 'sensitive-user',
  displayName: 'Sensitive Name',
  photoURL: 'https://example.com/photo.jpg',
};

function song(orgId: string, id = 'song-1'): PopulatedSong {
  return {
    id,
    organizationId: orgId,
    title: 'Song',
    artist: 'Artist',
    key: 'C',
    status: 'active',
    tagIds: ['tag-1'],
    tags: [{ id: 'tag-1', name: 'Worship', createdBy: actor }],
    lyrics: 'Lyrics',
    chords: 'C G Am F',
    chordsUrl: '',
    videoUrl: '',
    createdAt: '2026-08-20T00:00:00.000Z',
    lastPlayed: null,
    createdBy: actor,
    importedBy: 'sensitive-user',
    lastModifiedBy: actor,
    chordsCreatedBy: actor,
    chordsLastModifiedBy: actor,
  } as PopulatedSong;
}

function scale(orgId: string, id = 'scale-1'): PopulatedScale {
  return {
    id,
    organizationId: orgId,
    date: '2026-08-23',
    status: 'published',
    observations: 'Stage note',
    songIds: ['song-1'],
    eventTypeId: 'event-type-1',
    locationId: 'location-1',
    eventNameId: 'event-name-1',
    songs: [song(orgId)],
    eventType: { id: 'event-type-1', name: 'Culto', createdBy: actor },
    location: { id: 'location-1', name: 'Templo', createdBy: actor },
    eventName: { id: 'event-name-1', name: 'Domingo', createdBy: actor },
    bandScale: {
      id: 'band-1',
      assignments: [{ user: { uid: 'member-1', displayName: 'Member' }, instrument: { id: 'guitar', name: 'Guitar' } }],
    },
    eventAssignments: [{ userId: 'member-1', functionName: 'Guitar' }],
    createdBy: actor,
    createdAt: '2026-08-20T00:00:00.000Z',
    lastModifiedBy: actor,
  } as any;
}

describe('offline stage read cache', () => {
  beforeEach(() => {
    dbState.songs = [];
    dbState.scales = [];
    vi.clearAllMocks();
  });

  it('sanitizes user/audit and band-assignment data before persistence', () => {
    const sanitizedSong = sanitizeStageSong(song('org-A'), 'org-A') as any;
    const sanitizedScale = sanitizeStageScale(scale('org-A'), 'org-A') as any;

    expect(sanitizedSong.organizationId).toBe('org-A');
    expect(sanitizedSong.createdBy).toEqual({ uid: '', displayName: null, photoURL: null });
    expect(sanitizedSong.importedBy).toBeUndefined();
    expect(sanitizedSong.lastModifiedBy).toBeNull();
    expect(sanitizedSong.chordsCreatedBy).toBeNull();
    expect(sanitizedSong.tags).toEqual([{ id: 'tag-1', name: 'Worship' }]);

    expect(sanitizedScale.organizationId).toBe('org-A');
    expect(sanitizedScale.createdBy).toEqual({ uid: '', displayName: null, photoURL: null });
    expect(sanitizedScale.lastModifiedBy).toBeNull();
    expect(sanitizedScale.bandScale).toBeUndefined();
    expect(sanitizedScale.eventAssignments).toBeUndefined();
    expect(sanitizedScale.eventType).toEqual({ id: 'event-type-1', name: 'Culto' });
    expect(sanitizedScale.songs[0].createdBy.uid).toBe('');
  });

  it('uses UID+tenant-prefixed keys and never exposes another user or organization pack', async () => {
    const now = Date.now();
    await writeOfflineStageReadCache('user-A', 'org-A', [song('org-A')], [scale('org-A')], now);
    await writeOfflineStageReadCache('user-B', 'org-A', [song('org-A')], [scale('org-A')], now + 1);
    await writeOfflineStageReadCache('user-A', 'org-B', [song('org-B')], [scale('org-B')], now + 2);

    expect(dbState.songs.map((row) => row.id).sort()).toEqual([
      'user-A::org-A::song-1',
      'user-A::org-B::song-1',
      'user-B::org-A::song-1',
    ]);

    const userAOrgA = await readOfflineStageReadCache('user-A', 'org-A', now + 3);
    const userBOrgA = await readOfflineStageReadCache('user-B', 'org-A', now + 3);
    const userAOrgB = await readOfflineStageReadCache('user-A', 'org-B', now + 3);

    expect(userAOrgA?.songs.every((entry) => entry.organizationId === 'org-A')).toBe(true);
    expect(userBOrgA?.songs.every((entry) => entry.organizationId === 'org-A')).toBe(true);
    expect(userAOrgB?.songs.every((entry) => entry.organizationId === 'org-B')).toBe(true);
    expect(await readOfflineStageReadCache('user-C', 'org-A', now + 3)).toBeNull();
  });

  it('atomically replaces only the active UID+tenant pack so deleted entities do not resurrect', async () => {
    const now = Date.now();
    await writeOfflineStageReadCache(
      'user-A',
      'org-A',
      [song('org-A', 'song-1'), song('org-A', 'song-2')],
      [scale('org-A', 'scale-1')],
      now,
    );
    await writeOfflineStageReadCache(
      'user-B',
      'org-A',
      [song('org-A', 'song-1')],
      [scale('org-A', 'scale-1')],
      now + 1,
    );
    await writeOfflineStageReadCache('user-A', 'org-A', [song('org-A', 'song-2')], [], now + 2);

    const userARows = dbState.songs.filter((row) => row.userId === 'user-A');
    const userBRows = dbState.songs.filter((row) => row.userId === 'user-B');
    expect(userARows.map((row) => row.id)).toEqual(['user-A::org-A::song-2']);
    expect(userBRows.map((row) => row.id)).toEqual(['user-B::org-A::song-1']);

    const snapshot = await readOfflineStageReadCache('user-A', 'org-A', now + 3);
    expect(snapshot?.songs.map((entry) => entry.id)).toEqual(['song-2']);
    expect(snapshot?.populatedScales).toEqual([]);
  });

  it('rejects expired packs instead of silently treating old stage data as current', async () => {
    const now = Date.now();
    await writeOfflineStageReadCache('user-A', 'org-A', [song('org-A')], [scale('org-A')], now);

    const expired = await readOfflineStageReadCache(
      'user-A',
      'org-A',
      now + STAGE_CACHE_MAX_AGE_MS + 1,
    );
    expect(expired).toBeNull();
  });

  it('does not write a pack with an invalid future source timestamp', async () => {
    const now = Date.now();
    await writeOfflineStageReadCache(
      'user-A',
      'org-A',
      [song('org-A')],
      [scale('org-A')],
      now + 10 * 60 * 1000,
    );

    expect(dbState.songs).toEqual([]);
    expect(dbState.scales).toEqual([]);
  });

  it('rejects tampered tenant identity or non-canonical cache keys', async () => {
    const now = Date.now();
    await writeOfflineStageReadCache('user-A', 'org-A', [song('org-A')], [scale('org-A')], now);

    dbState.songs[0].data.organizationId = 'org-B';
    expect(await readOfflineStageReadCache('user-A', 'org-A', now + 1)).toBeNull();

    dbState.songs[0].data.organizationId = 'org-A';
    dbState.songs[0].id = 'song-1';
    expect(await readOfflineStageReadCache('user-A', 'org-A', now + 1)).toBeNull();
  });

  it('refuses to persist a scale whose tenant scope is not proven', async () => {
    const now = Date.now();
    await writeOfflineStageReadCache(
      'user-A',
      'org-A',
      [song('org-A')],
      [scale('org-B')],
      now,
    );

    expect(dbState.scales).toEqual([]);
    const snapshot = await readOfflineStageReadCache('user-A', 'org-A', now + 1);
    expect(snapshot?.songs).toHaveLength(1);
    expect(snapshot?.populatedScales).toEqual([]);
  });

  it('reconstructs only stage-safe taxonomy and raw scale data', async () => {
    const now = Date.now();
    await writeOfflineStageReadCache('user-A', 'org-A', [song('org-A')], [scale('org-A')], now);

    const snapshot = await readOfflineStageReadCache('user-A', 'org-A', now + 1);
    expect(snapshot).not.toBeNull();
    expect(snapshot?.eventTypes).toEqual([{ id: 'event-type-1', name: 'Culto' }]);
    expect(snapshot?.locations).toEqual([{ id: 'location-1', name: 'Templo' }]);
    expect(snapshot?.eventNames).toEqual([{ id: 'event-name-1', name: 'Domingo' }]);
    expect(snapshot?.tags).toEqual([{ id: 'tag-1', name: 'Worship' }]);
    expect((snapshot?.scales[0] as any).songs).toBeUndefined();
    expect((snapshot?.scales[0] as any).bandScale).toBeUndefined();
    expect((snapshot?.scales[0] as any).eventAssignments).toBeUndefined();
  });
});
