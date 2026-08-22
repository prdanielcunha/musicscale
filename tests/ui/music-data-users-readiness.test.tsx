import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { writeMusicDataCache } from '../../lib/musicDataCache';
import { useMusicData } from '../../hooks/useMusicData';

const mocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
  useApi: vi.fn(),
  retentionCleanup: vi.fn(),
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => mocks.useAuth(),
}));

vi.mock('../../contexts/ApiContext', () => ({
  useApi: () => mocks.useApi(),
}));

vi.mock('../../services/offline/ScaleRetentionService', () => ({
  scaleRetentionService: {
    runRetentionCleanup: mocks.retentionCleanup,
  },
}));

vi.mock('../../lib/startupTelemetry', () => ({
  markStartupMetric: vi.fn(),
  markStartupFailure: vi.fn(),
  recordStartupGauge: vi.fn(),
}));

vi.mock('../../lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    warn: vi.fn(),
  },
}));

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function createApi(overrides: Record<string, unknown> = {}) {
  return {
    songs: { list: vi.fn().mockResolvedValue([]) },
    scales: { list: vi.fn().mockResolvedValue([]) },
    bandScales: { list: vi.fn().mockResolvedValue([]) },
    eventTypes: { list: vi.fn().mockResolvedValue([]) },
    locations: { list: vi.fn().mockResolvedValue([]) },
    eventNames: { list: vi.fn().mockResolvedValue([]) },
    tags: { list: vi.fn().mockResolvedValue([]) },
    roles: {
      list: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue(undefined),
    },
    instruments: { list: vi.fn().mockResolvedValue([]) },
    users: { list: vi.fn().mockResolvedValue([]) },
    fixedBandScales: { list: vi.fn().mockResolvedValue([]) },
    ...overrides,
  } as any;
}

const authA = {
  user: { uid: 'u1' },
  effectiveOrganizationId: 'org-a',
};

const userA = {
  uid: 'member-a',
  displayName: 'Member A',
  email: 'a@example.com',
  organizationId: 'org-a',
  roleId: 'role-a',
  specialtyIds: ['spec-a'],
};

const userB = {
  uid: 'member-b',
  displayName: 'Member B',
  email: 'b@example.com',
  organizationId: 'org-b',
  roleId: 'role-b',
  specialtyIds: ['spec-b'],
};

describe('useMusicData users readiness', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    mocks.retentionCleanup.mockResolvedValue(undefined);
    mocks.useAuth.mockReturnValue(authA);
  });

  it('marks primary MusicData operational while users remain secondary/loading', async () => {
    const users = deferred<any[]>();
    const api = createApi({ users: { list: vi.fn(() => users.promise) } });
    mocks.useApi.mockReturnValue(api);

    const { result } = renderHook(() => useMusicData());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.usersStatus).toBe('loading');
    expect(api.users.list).toHaveBeenCalledTimes(1);

    await act(async () => {
      users.resolve([userA]);
      await users.promise;
    });

    await waitFor(() => expect(result.current.usersStatus).toBe('ready'));
  });

  it('applies users success even when an unrelated secondary resource fails', async () => {
    const users = deferred<any[]>();
    const roles = deferred<any[]>();
    const api = createApi({
      users: { list: vi.fn(() => users.promise) },
      roles: { list: vi.fn(() => roles.promise), create: vi.fn().mockResolvedValue(undefined) },
    });
    mocks.useApi.mockReturnValue(api);

    const { result } = renderHook(() => useMusicData());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      users.resolve([userA]);
      await users.promise;
    });

    await waitFor(() => expect(result.current.usersStatus).toBe('ready'));
    expect(result.current.allUsers.map((user: any) => user.uid)).toEqual(['member-a']);

    await act(async () => {
      roles.reject(new Error('roles unavailable'));
      await Promise.resolve();
    });

    expect(result.current.usersStatus).toBe('ready');
    expect(result.current.allUsers.map((user: any) => user.uid)).toEqual(['member-a']);
    expect(api.users.list).toHaveBeenCalledTimes(1);
  });

  it('reports users error without converting the unresolved roster into authoritative empty data', async () => {
    const users = deferred<any[]>();
    const api = createApi({ users: { list: vi.fn(() => users.promise) } });
    mocks.useApi.mockReturnValue(api);

    const { result } = renderHook(() => useMusicData());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      users.reject(new Error('users unavailable'));
      await Promise.resolve();
    });

    await waitFor(() => expect(result.current.usersStatus).toBe('error'));
    expect(result.current.allUsers).toEqual([]);
  });

  it('restores ready only when the tenant-scoped cache contains an allUsers array', async () => {
    const users = deferred<any[]>();
    const api = createApi({ users: { list: vi.fn(() => users.promise) } });
    mocks.useApi.mockReturnValue(api);

    writeMusicDataCache(localStorage, 'u1', 'org-a', {
      songs: [],
      scales: [],
      bandScales: [],
      eventTypes: [],
      locations: [],
      eventNames: [],
      tags: [],
      roles: [],
      instruments: [],
      allUsers: [userA],
      fixedBandScales: [],
      populatedScales: [],
      populatedBandScales: [],
    });

    const { result } = renderHook(() => useMusicData());

    await waitFor(() => expect(result.current.usersStatus).toBe('ready'));
    expect(result.current.allUsers.map((user: any) => user.uid)).toEqual(['member-a']);

    users.reject(new Error('network unavailable'));
    await Promise.resolve();
    expect(result.current.usersStatus).toBe('ready');
  });

  it('rejects a stale users callback after organization A switches to B', async () => {
    const usersA = deferred<any[]>();
    const usersB = deferred<any[]>();
    const usersList = vi.fn()
      .mockImplementationOnce(() => usersA.promise)
      .mockImplementationOnce(() => usersB.promise);
    const api = createApi({ users: { list: usersList } });
    mocks.useApi.mockReturnValue(api);

    let authState = { ...authA };
    mocks.useAuth.mockImplementation(() => authState);

    const { result, rerender } = renderHook(() => useMusicData());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.usersStatus).toBe('loading');

    authState = { ...authState, effectiveOrganizationId: 'org-b' };
    rerender();

    await waitFor(() => expect(usersList).toHaveBeenCalledTimes(2));
    expect(result.current.usersStatus).toBe('loading');
    expect(result.current.allUsers).toEqual([]);

    await act(async () => {
      usersA.resolve([userA]);
      await usersA.promise;
    });

    expect(result.current.usersStatus).toBe('loading');
    expect(result.current.allUsers).toEqual([]);

    await act(async () => {
      usersB.resolve([userB]);
      await usersB.promise;
    });

    await waitFor(() => expect(result.current.usersStatus).toBe('ready'));
    expect(result.current.allUsers.map((user: any) => user.uid)).toEqual(['member-b']);
  });
});
