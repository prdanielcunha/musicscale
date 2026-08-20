import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const testState = vi.hoisted(() => ({
  userId: 'user-A' as string | null,
  organizationId: 'org-A' as string | null,
  isOffline: false,
  musicData: null as any,
  readCache: vi.fn(),
  writeCache: vi.fn(),
  readCanonicalCache: vi.fn(),
}));

vi.mock('../../hooks/useMusicData', () => ({
  useMusicData: () => testState.musicData,
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: testState.userId ? { uid: testState.userId } : null,
    effectiveOrganizationId: testState.organizationId,
  }),
}));

vi.mock('../../contexts/OfflineContext', () => ({
  useOffline: () => ({
    isOffline: testState.isOffline,
    isSlowConnection: false,
    syncPending: false,
  }),
}));

vi.mock('../../services/offline/stageReadCache', () => ({
  readOfflineStageReadCache: (...args: any[]) => testState.readCache(...args),
  writeOfflineStageReadCache: (...args: any[]) => testState.writeCache(...args),
}));

vi.mock('../../lib/musicDataCache', () => ({
  readMusicDataCache: (...args: any[]) => testState.readCanonicalCache(...args),
}));

import { MusicDataProvider, useMusic } from '../../contexts/MusicDataContext';

function canonicalData(overrides: Record<string, unknown> = {}) {
  return {
    songs: [{ id: 'canonical-song', organizationId: 'org-A', title: 'Canonical', tags: [] }],
    scales: [{ id: 'canonical-scale', organizationId: 'org-A' }],
    populatedScales: [{
      id: 'canonical-scale',
      organizationId: 'org-A',
      date: '2026-08-23',
      songs: [{ id: 'canonical-song', organizationId: 'org-A', title: 'Canonical', tags: [] }],
    }],
    bandScales: [{ id: 'band-sensitive' }],
    populatedBandScales: [{ id: 'band-sensitive', assignments: [{ user: { uid: 'member' } }] }],
    eventTypes: [{ id: 'canonical-type', name: 'Canonical type' }],
    locations: [{ id: 'canonical-location', name: 'Canonical location' }],
    eventNames: [],
    tags: [],
    roles: [{ id: 'role-sensitive' }],
    instruments: [{ id: 'instrument-sensitive' }],
    allUsers: [{ uid: 'member-sensitive' }],
    usersStatus: 'ready',
    fixedBandScales: [{ id: 'fixed-sensitive' }],
    loading: false,
    error: null,
    refreshData: vi.fn(async () => {}),
    ...overrides,
  };
}

function offlineSnapshot(orgId = 'org-A', prefix = 'offline') {
  return {
    songs: [{ id: `${prefix}-song`, organizationId: orgId, title: 'Offline', tags: [] }],
    scales: [{ id: `${prefix}-scale`, organizationId: orgId }],
    populatedScales: [{
      id: `${prefix}-scale`,
      organizationId: orgId,
      date: '2026-08-23',
      songs: [{ id: `${prefix}-song`, organizationId: orgId, title: 'Offline', tags: [] }],
      eventType: { id: `${prefix}-type`, name: 'Culto' },
      location: { id: `${prefix}-location`, name: 'Templo' },
    }],
    eventTypes: [{ id: `${prefix}-type`, name: 'Culto' }],
    locations: [{ id: `${prefix}-location`, name: 'Templo' }],
    eventNames: [],
    tags: [],
    updatedAt: Date.now(),
  };
}

const wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <MusicDataProvider>{children}</MusicDataProvider>
);

describe('MusicDataProvider offline stage fallback', () => {
  beforeEach(() => {
    testState.userId = 'user-A';
    testState.organizationId = 'org-A';
    testState.isOffline = false;
    testState.musicData = canonicalData();
    testState.readCache.mockReset();
    testState.writeCache.mockReset();
    testState.readCanonicalCache.mockReset();
    testState.readCache.mockResolvedValue(null);
    testState.writeCache.mockResolvedValue(undefined);
    testState.readCanonicalCache.mockReturnValue({ status: 'miss', data: null, ageMs: 0 });
  });

  it('uses UID+tenant stage cache when offline canonical loading cannot render', async () => {
    testState.isOffline = true;
    testState.musicData = canonicalData({ loading: true, songs: [], scales: [], populatedScales: [] });
    testState.readCache.mockResolvedValue(offlineSnapshot());

    const { result } = renderHook(() => useMusic(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(testState.readCache).toHaveBeenCalledWith('user-A', 'org-A');
    expect(result.current.error).toBeNull();
    expect(result.current.songs[0].id).toBe('offline-song');
    expect(result.current.populatedScales[0].id).toBe('offline-scale');
    expect(result.current.bandScales).toEqual([]);
    expect(result.current.populatedBandScales).toEqual([]);
    expect(result.current.roles).toEqual([]);
    expect(result.current.instruments).toEqual([]);
    expect(result.current.allUsers).toEqual([]);
    expect(result.current.usersStatus).toBe('error');
  });

  it('keeps fresher in-memory canonical data when network drops after the app is operational', async () => {
    testState.isOffline = true;
    testState.musicData = canonicalData();
    testState.readCache.mockResolvedValue(offlineSnapshot());

    const { result } = renderHook(() => useMusic(), { wrapper });
    await waitFor(() => expect(testState.readCache).toHaveBeenCalledWith('user-A', 'org-A'));

    expect(result.current.songs[0].id).toBe('canonical-song');
    expect(result.current.bandScales).toEqual([{ id: 'band-sensitive' }]);
  });

  it('keeps offline stage data visible through reconnect only while canonical refresh is loading', async () => {
    const refreshData = vi.fn(async () => {});
    testState.isOffline = true;
    testState.musicData = canonicalData({
      loading: true,
      error: null,
      songs: [],
      scales: [],
      populatedScales: [],
      refreshData,
    });
    testState.readCache.mockResolvedValue(offlineSnapshot());

    const { result, rerender } = renderHook(() => useMusic(), { wrapper });
    await waitFor(() => expect(result.current.songs[0]?.id).toBe('offline-song'));

    act(() => {
      testState.isOffline = false;
      rerender();
    });

    await waitFor(() => expect(refreshData).toHaveBeenCalledTimes(1));
    expect(result.current.songs[0].id).toBe('offline-song');

    act(() => {
      testState.musicData = canonicalData({ refreshData });
      rerender();
    });

    await waitFor(() => expect(result.current.songs[0]?.id).toBe('canonical-song'));
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('does not blank an error-backed offline fallback before reconnect revalidation settles', async () => {
    let resolveRefresh!: () => void;
    const refreshData = vi.fn(() => new Promise<void>((resolve) => {
      resolveRefresh = resolve;
    }));
    testState.isOffline = true;
    testState.musicData = canonicalData({
      loading: false,
      error: 'Offline network failure',
      songs: [],
      scales: [],
      populatedScales: [],
      refreshData,
    });
    testState.readCache.mockResolvedValue(offlineSnapshot());

    const { result, rerender } = renderHook(() => useMusic(), { wrapper });
    await waitFor(() => expect(result.current.songs[0]?.id).toBe('offline-song'));

    act(() => {
      testState.isOffline = false;
      rerender();
    });

    await waitFor(() => expect(refreshData).toHaveBeenCalledTimes(1));
    expect(result.current.songs[0]?.id).toBe('offline-song');
    expect(result.current.error).toBeNull();

    await act(async () => {
      testState.musicData = canonicalData({ refreshData });
      resolveRefresh();
      rerender();
      await Promise.resolve();
    });

    await waitFor(() => expect(result.current.songs[0]?.id).toBe('canonical-song'));
  });

  it('drops fallback if reconnect settles with an online canonical error', async () => {
    const refreshData = vi.fn(async () => {});
    testState.isOffline = true;
    testState.musicData = canonicalData({
      loading: true,
      songs: [],
      scales: [],
      populatedScales: [],
      refreshData,
    });
    testState.readCache.mockResolvedValue(offlineSnapshot());

    const { result, rerender } = renderHook(() => useMusic(), { wrapper });
    await waitFor(() => expect(result.current.songs[0]?.id).toBe('offline-song'));

    act(() => {
      testState.isOffline = false;
      rerender();
    });
    await waitFor(() => expect(refreshData).toHaveBeenCalledTimes(1));
    expect(result.current.songs[0]?.id).toBe('offline-song');

    act(() => {
      testState.musicData = canonicalData({
        loading: false,
        error: 'Canonical authorization failed',
        songs: [],
        scales: [],
        populatedScales: [],
        refreshData,
      });
      rerender();
    });

    await waitFor(() => expect(result.current.error).toBe('Canonical authorization failed'));
    expect(result.current.songs).toEqual([]);
  });

  it('does not convert an online canonical denial into cache access after going offline', async () => {
    testState.musicData = canonicalData({
      loading: false,
      error: 'Canonical authorization failed',
      songs: [],
      scales: [],
      populatedScales: [],
    });
    testState.readCache.mockResolvedValue(offlineSnapshot());

    const { result, rerender } = renderHook(() => useMusic(), { wrapper });
    await waitFor(() => expect(testState.readCache).toHaveBeenCalledWith('user-A', 'org-A'));
    expect(result.current.error).toBe('Canonical authorization failed');

    act(() => {
      testState.isOffline = true;
      rerender();
    });

    await waitFor(() => expect(result.current.error).toBe('Canonical authorization failed'));
    expect(result.current.songs).toEqual([]);
  });

  it('rejects a late cache read after user changes within the same tenant', async () => {
    testState.isOffline = true;
    testState.musicData = canonicalData({ loading: true, songs: [], scales: [], populatedScales: [] });

    let resolveA!: (value: unknown) => void;
    let resolveB!: (value: unknown) => void;
    const promiseA = new Promise((resolve) => { resolveA = resolve; });
    const promiseB = new Promise((resolve) => { resolveB = resolve; });
    testState.readCache.mockImplementation((userId: string) => userId === 'user-A' ? promiseA : promiseB);

    const { result, rerender } = renderHook(() => useMusic(), { wrapper });
    await waitFor(() => expect(testState.readCache).toHaveBeenCalledWith('user-A', 'org-A'));

    act(() => {
      testState.userId = 'user-B';
      rerender();
    });
    await waitFor(() => expect(testState.readCache).toHaveBeenCalledWith('user-B', 'org-A'));

    await act(async () => {
      resolveA(offlineSnapshot('org-A', 'late-A'));
      await Promise.resolve();
    });
    expect(result.current.songs.find((entry) => entry.id === 'late-A-song')).toBeUndefined();

    await act(async () => {
      resolveB(offlineSnapshot('org-A', 'current-B'));
      await Promise.resolve();
    });
    await waitFor(() => expect(result.current.songs[0]?.id).toBe('current-B-song'));
  });

  it('persists stage data with the canonical cache issuedAt instead of rejuvenating it', async () => {
    const now = Date.UTC(2026, 7, 20, 12, 0, 0);
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(now);
    testState.readCanonicalCache.mockReturnValue({
      status: 'fresh',
      data: { canonical: true },
      ageMs: 60_000,
    });

    const { unmount } = renderHook(() => useMusic(), { wrapper });

    await waitFor(() => expect(testState.writeCache).toHaveBeenCalledTimes(1), { timeout: 1500 });
    expect(testState.writeCache).toHaveBeenCalledWith(
      'user-A',
      'org-A',
      testState.musicData.songs,
      testState.musicData.populatedScales,
      now - 60_000,
    );

    unmount();
    nowSpy.mockRestore();
  });
});
