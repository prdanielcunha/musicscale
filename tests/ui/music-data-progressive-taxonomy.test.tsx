import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { writeMusicDataCache } from '../../lib/musicDataCache';
import { useMusicData } from '../../hooks/useMusicData';

const mocks = vi.hoisted(() => ({ useAuth: vi.fn(), useApi: vi.fn() }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => mocks.useAuth() }));
vi.mock('../../contexts/ApiContext', () => ({ useApi: () => mocks.useApi() }));
vi.mock('../../services/offline/ScaleRetentionService', () => ({ scaleRetentionService: { runRetentionCleanup: vi.fn().mockResolvedValue(undefined) } }));
vi.mock('../../lib/startupTelemetry', () => ({ markStartupMetric: vi.fn(), markStartupFailure: vi.fn(), recordStartupGauge: vi.fn() }));
vi.mock('../../lib/logger', () => ({ logger: { debug: vi.fn(), warn: vi.fn() } }));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

const song = { id: 'song-1', title: 'Song', tagIds: ['tag-1'], originalKey: 'C', bpm: 100 };
const scale = { id: 'scale-1', date: '2099-01-01', eventTypeId: 'type-1', locationId: 'location-1', eventNameId: 'name-1', bandScaleId: 'band-1', songIds: ['song-1'], songSettings: { 'song-1': { key: 'D', bpm: 123 } } };
const bandScale = { id: 'band-1', date: '2099-01-01', eventTypeId: 'type-1', locationId: 'location-1', eventNameId: 'name-1', assignments: [{ userId: 'member-1', instrumentId: 'instrument-1' }] };
const eventType = { id: 'type-1', name: 'Culto' };
const location = { id: 'location-1', name: 'Templo' };
const eventName = { id: 'name-1', name: 'Santa Ceia' };
const tag = { id: 'tag-1', name: 'Adoração' };
const member = { uid: 'member-1', organizationId: 'org-a', roleId: 'role-1' };
const instrument = { id: 'instrument-1', name: 'Voz' };

function apiWith(eventNames: Promise<any[]>, tags: Promise<any[]>, overrides: Record<string, any> = {}) {
  return {
    songs: { list: vi.fn().mockResolvedValue([song]) }, scales: { list: vi.fn().mockResolvedValue([scale]) },
    bandScales: { list: vi.fn().mockResolvedValue([bandScale]) }, eventTypes: { list: vi.fn().mockResolvedValue([eventType]) },
    locations: { list: vi.fn().mockResolvedValue([location]) }, eventNames: { list: vi.fn(() => eventNames) }, tags: { list: vi.fn(() => tags) },
    roles: { list: vi.fn().mockResolvedValue([{ id: 'role-1', organizationId: 'org-a', name: 'Músico' }]), create: vi.fn().mockResolvedValue(undefined) },
    instruments: { list: vi.fn().mockResolvedValue([instrument]) }, users: { list: vi.fn().mockResolvedValue([member]) },
    fixedBandScales: { list: vi.fn().mockResolvedValue([]) }, ...overrides,
  } as any;
}

describe('useMusicData progressive taxonomy enrichment', () => {
  beforeEach(() => {
    localStorage.clear(); vi.clearAllMocks();
    mocks.useAuth.mockReturnValue({ user: { uid: 'u1' }, effectiveOrganizationId: 'org-a' });
  });

  it('becomes operational after five critical resources, then enriches names and tags without losing local song settings', async () => {
    const names = deferred<any[]>(); const tags = deferred<any[]>();
    const api = apiWith(names.promise, tags.promise); mocks.useApi.mockReturnValue(api);
    const { result } = renderHook(() => useMusicData());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.songs).toHaveLength(1);
    expect(result.current.songs[0].tags).toEqual([]);
    expect(result.current.populatedScales[0]).toMatchObject({ eventType, location, eventName: undefined });
    expect(result.current.populatedScales[0].songs[0]).toMatchObject({ selectedKey: 'D', key: 'D', bpm: 123 });

    await act(async () => { names.resolve([eventName]); await names.promise; });
    await waitFor(() => expect(result.current.populatedScales[0].eventName).toEqual(eventName));
    expect(result.current.populatedBandScales[0].eventName).toEqual(eventName);

    await act(async () => { tags.resolve([tag]); await tags.promise; });
    await waitFor(() => expect(result.current.songs[0].tags).toEqual([tag]));
    expect(result.current.populatedScales[0].songs[0]).toMatchObject({ tags: [tag], selectedKey: 'D', key: 'D', bpm: 123 });
  });

  it('preserves secondary assignments when taxonomy arrives later', async () => {
    const names = deferred<any[]>(); const tags = deferred<any[]>();
    mocks.useApi.mockReturnValue(apiWith(names.promise, tags.promise));
    const { result } = renderHook(() => useMusicData());
    await waitFor(() => expect(result.current.populatedBandScales[0]?.assignments).toHaveLength(1));

    await act(async () => { names.resolve([eventName]); tags.resolve([tag]); await Promise.all([names.promise, tags.promise]); });
    await waitFor(() => expect(result.current.populatedBandScales[0].eventName).toEqual(eventName));
    expect(result.current.populatedBandScales[0].assignments).toHaveLength(1);
    expect(result.current.populatedScales[0].bandScale?.assignments).toHaveLength(1);
  });

  it('keeps the critical shell usable when taxonomy fails', async () => {
    const names = deferred<any[]>(); const tags = deferred<any[]>();
    mocks.useApi.mockReturnValue(apiWith(names.promise, tags.promise));
    const { result } = renderHook(() => useMusicData());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { names.reject(new Error('no names')); tags.reject(new Error('no tags')); await Promise.allSettled([names.promise, tags.promise]); });
    expect(result.current.error).toBeNull();
    expect(result.current.populatedScales[0].eventType.name).toBe('Culto');
  });

  it('rejects late taxonomy from the previous tenant generation', async () => {
    const namesA = deferred<any[]>(); const tagsA = deferred<any[]>();
    const namesB = deferred<any[]>(); const tagsB = deferred<any[]>();
    const api = apiWith(namesA.promise, tagsA.promise);
    api.eventNames.list.mockImplementationOnce(() => namesA.promise).mockImplementationOnce(() => namesB.promise);
    api.tags.list.mockImplementationOnce(() => tagsA.promise).mockImplementationOnce(() => tagsB.promise);
    mocks.useApi.mockReturnValue(api);
    let auth = { user: { uid: 'u1' }, effectiveOrganizationId: 'org-a' };
    mocks.useAuth.mockImplementation(() => auth);
    const { result, rerender } = renderHook(() => useMusicData());
    await waitFor(() => expect(result.current.loading).toBe(false));
    auth = { ...auth, effectiveOrganizationId: 'org-b' }; rerender();
    await waitFor(() => expect(api.tags.list).toHaveBeenCalledTimes(2));
    await act(async () => { namesB.resolve([{ ...eventName, name: 'B Name' }]); tagsB.resolve([{ ...tag, name: 'B Tag' }]); await Promise.all([namesB.promise, tagsB.promise]); });
    await act(async () => { namesA.resolve([{ ...eventName, name: 'A Name' }]); tagsA.resolve([{ ...tag, name: 'A Tag' }]); await Promise.all([namesA.promise, tagsA.promise]); });
    expect(result.current.eventNames[0].name).toBe('B Name');
    expect(result.current.tags[0].name).toBe('B Tag');
  });

  it('does not downgrade a usable cached operational shell during refresh', async () => {
    const names = deferred<any[]>(); const tags = deferred<any[]>(); const roles = deferred<any[]>();
    const cachedBand = { ...bandScale, eventType, location, eventName, assignments: [{ user: member, instrument }] };
    const cachedSong = { ...song, tags: [tag], originalKey: 'D', bpm: 123 };
    writeMusicDataCache(localStorage, 'u1', 'org-a', {
      songs: [cachedSong], scales: [scale], bandScales: [bandScale], eventTypes: [eventType], locations: [location], eventNames: [eventName], tags: [tag],
      roles: [], instruments: [instrument], allUsers: [member], fixedBandScales: [], populatedBandScales: [cachedBand],
      populatedScales: [{ ...scale, eventType, location, eventName, songs: [cachedSong], bandScale: cachedBand }],
    });
    mocks.useApi.mockReturnValue(apiWith(names.promise, tags.promise, { roles: { list: vi.fn(() => roles.promise), create: vi.fn() } }));
    const { result } = renderHook(() => useMusicData());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.populatedScales[0].eventName).toEqual(eventName);
    expect(result.current.populatedScales[0].songs[0].tags).toEqual([tag]);
    expect(result.current.populatedBandScales[0].assignments).toHaveLength(1);
  });
});
