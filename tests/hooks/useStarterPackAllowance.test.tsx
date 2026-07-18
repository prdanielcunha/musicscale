import { renderHook, act, waitFor } from '@testing-library/react';
import { useStarterPackAllowance } from '../../hooks/useStarterPackAllowance';
import * as AuthContext from '../../contexts/AuthContext';
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('useStarterPackAllowance', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('handles 403 NO_ENTITLEMENT typed error', async () => {
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

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toEqual({
      code: 'NO_ENTITLEMENT',
      message: 'Not entitled',
      status: 403
    });
    expect(result.current.allowance).toBeNull();
  });

  it('handles 500 typed error with retry', async () => {
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
      organization: { id: 'org_1' },
      user: { getIdToken: async () => 'token_1' }
    } as any);

    let fetchCount = 0;
    global.fetch = vi.fn().mockImplementation(async () => {
      fetchCount++;
      if (fetchCount === 1) {
        return {
          ok: false,
          status: 500,
          json: async () => ({ error: 'STARTER_PACK_STATUS_FAILED', message: 'Failed' })
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ success: true, allowance: { limit: 10, used: 2, remaining: 8, completed: false, started: true, version: '1.0' } })
      };
    });

    const { result } = renderHook(() => useStarterPackAllowance());

    await waitFor(() => expect(result.current.loading).toBe(false));
    
    expect(result.current.error?.code).toBe('STARTER_PACK_STATUS_FAILED');
    expect(result.current.allowance).toBeNull();

    // Retry
    act(() => {
      result.current.refreshAllowance();
    });

    await waitFor(() => expect(result.current.allowance?.remaining).toBe(8));
    expect(result.current.error).toBeNull();
  });
});
