import { renderHook, act, waitFor } from '@testing-library/react';
import { useStarterPackAllowance } from '../../hooks/useStarterPackAllowance';
import * as AuthContext from '../../contexts/AuthContext';
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('useStarterPackAllowance', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  const mockValidAllowance = { limit: 10, used: 0, remaining: 10, completed: false, started: false, version: '1.0' };
  
  it('1-4, 7-8: fetches correctly and reads both from single response', async () => {
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
      organization: { id: 'org_1' },
      user: { getIdToken: async () => 'token_1' }
    } as any);

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        allowance: { limit: 10, used: 3, remaining: 7, completed: false, started: true, version: '1.0' },
        starterPack: [{ id: 's1' }]
      })
    });
    global.fetch = fetchMock;

    const { result } = renderHook(() => useStarterPackAllowance());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // 1 & 2
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/onboarding/starter-pack',
      expect.objectContaining({
        headers: expect.objectContaining({
          'x-organization-id': 'org_1'
        })
      })
    );
    expect(fetchMock.mock.calls.some(call => call[0].includes('/status'))).toBe(false);

    // 3, 7, 8
    expect(result.current.allowance?.remaining).toBe(7);
    expect(result.current.starterPack.length).toBe(1);
    expect(result.current.error).toBeNull();
  });

  it('4: starterPack absent results in empty array', async () => {
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
      organization: { id: 'org_1' },
      user: { getIdToken: async () => 'token_1' }
    } as any);

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        allowance: mockValidAllowance
        // no starterPack
      })
    });

    const { result } = renderHook(() => useStarterPackAllowance());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.starterPack).toEqual([]);
    expect(result.current.allowance?.remaining).toBe(10);
  });

  it('5 & 6 & 17: allowance absent or invalid returns BACKEND_ALLOWANCE_CONTRACT_UNAVAILABLE with no fallback', async () => {
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
      organization: { id: 'org_1' },
      user: { getIdToken: async () => 'token_1' }
    } as any);

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        allowance: {} // invalid empty object
      })
    });

    const { result } = renderHook(() => useStarterPackAllowance());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error?.code).toBe('BACKEND_ALLOWANCE_CONTRACT_UNAVAILABLE');
    expect(result.current.allowance).toBeNull(); // No fallback
  });

  it('9 & 10: 401 renews token once, second 401 does not loop', async () => {
    const getIdTokenMock = vi.fn().mockResolvedValue('token_1');
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
      organization: { id: 'org_1' },
      user: { getIdToken: getIdTokenMock }
    } as any);

    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: 'UNAUTHORIZED' })
    });
    global.fetch = fetchMock;

    const { result } = renderHook(() => useStarterPackAllowance());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(getIdTokenMock).toHaveBeenCalledWith(true); // forceRefresh
    expect(result.current.error?.code).toBe('UNAUTHORIZED');
  });

  it('11: 403 returns typed error', async () => {
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
      organization: { id: 'org_1' },
      user: { getIdToken: async () => 'token_1' }
    } as any);
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ error: 'NO_ENTITLEMENT', message: 'Not entitled' })
    });
    const { result } = renderHook(() => useStarterPackAllowance());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error?.code).toBe('NO_ENTITLEMENT');
  });

  it('12 & 13: 500 allows manual retry, replaces error', async () => {
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
      organization: { id: 'org_1' },
      user: { getIdToken: async () => 'token_1' }
    } as any);
    
    let fetchCount = 0;
    global.fetch = vi.fn().mockImplementation(async () => {
      fetchCount++;
      if (fetchCount === 1) return { ok: false, status: 500, json: async () => ({}) };
      return { ok: true, status: 200, json: async () => ({ success: true, allowance: mockValidAllowance }) };
    });

    const { result } = renderHook(() => useStarterPackAllowance());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error?.status).toBe(500);

    await act(async () => {
      result.current.refreshAllowance();
    });
    await waitFor(() => expect(result.current.allowance?.remaining).toBe(10));
    expect(result.current.error).toBeNull();
  });

  it('14 & 15: organization change immediately clears allowance and starterPack', async () => {
    let currentOrg = 'org_1';
    const mockUser = { getIdToken: async () => 'token' };
    vi.spyOn(AuthContext, 'useAuth').mockImplementation(() => ({
      organization: { id: currentOrg },
      user: mockUser
    } as any));

    // Fetch will never resolve during the first render
    global.fetch = vi.fn().mockImplementation(() => new Promise(() => {}));

    const { result, rerender } = renderHook(() => useStarterPackAllowance());
    
    // Switch org
    act(() => {
      currentOrg = 'org_2';
      rerender();
    });

    // Should be loading new org and states should be cleared immediately
    expect(result.current.loading).toBe(true);
    expect(result.current.allowance).toBeNull();
    expect(result.current.starterPack).toEqual([]);
  });
});
