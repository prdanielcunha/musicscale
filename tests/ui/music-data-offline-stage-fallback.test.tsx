import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const testState = vi.hoisted(() => ({
  organizationId: 'org-A' as string | null,
  isOffline: false,
  musicData: null as any,
  readCache: vi.fn(),
  writeCache: vi.fn(),
}));

vi.mock('../../hooks/useMusicData', () => ({
  useMusicData: () => testState.musicData,
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ effectiveOrganizationId: testState.organizationId }),
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
    testState.organizationId = 'org-A';
    testState.isOffline = false;
    testState.musicData = canonicalData();
    testState.readCache.mockReset();
    testState.writeCache.mockReset();
    testState.readCache.mockResolvedValue(null);
    testState.writeCache.mockResolvedValue(undefined);
  });

  it('uses stage cache immediately when offline canonical loading cannot render', async () => {
    testState.isOffline = true;
    testState.musicData = canonicalData({ loading: true, songs: [], scales: [], populatedScales: [] });
    testState.readCache.mockResolvedValue(offlineSnapshot());

    const { result } = renderHook(() => useMusic(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
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

  it('keeps fresher in-memory canonical data when network drops after the app is already operational', async () => {
    testState.isOffline = true;
    testState.musicData = canonicalData();
    testState.readCache.mockResolvedValue(offlineSnapshot());

    const { result } = renderHook(() => useMusic(), { wrapper });
    await waitFor(() => expect(testState.readCache).toHaveBeenCalledWith('org-A'));

    expect(result.current.songs[0].id).toBe('canonical-song');
    expect(result.current.bandScales).toEqual([{ id: 'band-sensitive' }]);
  });

  it('refreshes canonical data when connectivity returns while keeping fallback eligible during refresh', async () => {
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
    expect(result.current.songs[0].id).toBe('canonical-song');
  });

  it('rejects a late cache read from organization A after canonical context switches to B', async () => {
    testState.isOffline = true;
    testState.musicData = canonicalData({ loading: true, songs: [], scales: [], populatedScales: [] });

    let resolveA!: (value: unknown) => void;
    let resolveB!: (value: unknown) => void;
    const promiseA = new Promise((resolve) => { resolveA = resolve; });
    const promiseB = new Promise((resolve) => { resolveB = resolve; });
    testState.readCache.mockImplementation((orgId: string) => orgId === 'org-A' ? promiseA : promiseB);

    const { result, rerender } = renderHook(() => useMusic(), { wrapper });
    await waitFor(() => expect(testState.readCache).toHaveBeenCalledWith('org-A'));

    act(() => {
      testState.organizationId = 'org-B';
      rerender();
    });
    await waitFor(() => expect(testState.readCache).toHaveBeenCalledWith('org-B'));

    await act(async () => {
      resolveA(offlineSnapshot('org-A', 'late-A'));
      await Promise.resolve();
    });
    expect(result.current.songs.find((entry) => entry.id === 'late-A-song')).toBeUndefined();

    await act(async () => {
      resolveB(offlineSnapshot('org-B', 'current-B'));
      await Promise.resolve();
    });
    await waitFor(() => expect(result.current.songs[0]?.id).toBe('current-B-song'));
  });
});
