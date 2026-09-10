import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Suggestion } from '../../types';

const mocks = vi.hoisted(() => ({
  auth: {
    user: { uid: 'user-1' },
    effectiveOrganizationId: 'org-A' as string | null,
    userRole: 'member',
  },
  listeners: [] as Array<{
    organizationId: string;
    onUpdate: (suggestions: Suggestion[]) => void;
    onError: (error: Error) => void;
    unsubscribe: ReturnType<typeof vi.fn>;
  }>,
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => mocks.auth,
}));

// Startup scheduling is orthogonal to these tenant-isolation assertions. Keep
// the quiet-window contract enabled in production while letting this suite
// deterministically reach the listener after its existing 50ms boundary.
vi.mock('../../lib/startupWorkScheduler', () => ({
  waitForStartupQuietWindow: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../services/suggestionsService', () => ({
  onSuggestionsUpdate: vi.fn((
    organizationId: string,
    onUpdate: (suggestions: Suggestion[]) => void,
    onError: (error: Error) => void,
  ) => {
    const unsubscribe = vi.fn();
    mocks.listeners.push({ organizationId, onUpdate, onError, unsubscribe });
    return unsubscribe;
  }),
}));

import { useSuggestions } from '../../hooks/useSuggestions';
import { onSuggestionsUpdate } from '../../services/suggestionsService';

const suggestion = (id: string) => ({ id } as Suggestion);

async function startPendingListener() {
  await act(async () => {
    vi.advanceTimersByTime(50);
    await Promise.resolve();
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  mocks.auth.user = { uid: 'user-1' };
  mocks.auth.effectiveOrganizationId = 'org-A';
  mocks.auth.userRole = 'member';
  mocks.listeners = [];
  vi.mocked(onSuggestionsUpdate).mockClear();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('useSuggestions canonical tenant isolation', () => {
  it('subscribes to the effective organization for organization members', async () => {
    const { result } = renderHook(() => useSuggestions());
    await startPendingListener();

    expect(onSuggestionsUpdate).toHaveBeenCalledTimes(1);
    expect(mocks.listeners[0].organizationId).toBe('org-A');
    expect(result.current.loading).toBe(true);
  });

  it('clears A, unsubscribes A, rejects its late callback, and accepts B', async () => {
    const rendered = renderHook(() => useSuggestions());
    await startPendingListener();
    const listenerA = mocks.listeners[0];
    act(() => listenerA.onUpdate([suggestion('suggestion-A')]));
    expect(rendered.result.current.suggestions.map(item => item.id)).toEqual(['suggestion-A']);

    mocks.auth.effectiveOrganizationId = 'org-B';
    rendered.rerender();

    expect(listenerA.unsubscribe).toHaveBeenCalledTimes(1);
    expect(rendered.result.current.suggestions).toEqual([]);
    expect(rendered.result.current.loading).toBe(true);

    await startPendingListener();
    expect(mocks.listeners.map(listener => listener.organizationId)).toEqual(['org-A', 'org-B']);
    const listenerB = mocks.listeners[1];

    act(() => listenerA.onUpdate([suggestion('late-A')]));
    expect(rendered.result.current.suggestions).toEqual([]);

    act(() => listenerB.onUpdate([suggestion('suggestion-B')]));
    expect(rendered.result.current.suggestions.map(item => item.id)).toEqual(['suggestion-B']);
    expect(rendered.result.current.loading).toBe(false);
  });

  it('unsubscribes and resolves safely when the effective organization becomes null', async () => {
    const rendered = renderHook(() => useSuggestions());
    await startPendingListener();
    const listenerA = mocks.listeners[0];
    act(() => listenerA.onUpdate([suggestion('suggestion-A')]));

    mocks.auth.effectiveOrganizationId = null;
    rendered.rerender();

    expect(listenerA.unsubscribe).toHaveBeenCalledTimes(1);
    expect(rendered.result.current.suggestions).toEqual([]);
    expect(rendered.result.current.loading).toBe(false);
    act(() => listenerA.onUpdate([suggestion('late-A')]));
    expect(rendered.result.current.suggestions).toEqual([]);
  });

  it('does not duplicate a listener when the organization is unchanged', async () => {
    const rendered = renderHook(() => useSuggestions());
    await startPendingListener();

    rendered.rerender();
    act(() => { vi.advanceTimersByTime(100); });

    expect(onSuggestionsUpdate).toHaveBeenCalledTimes(1);
    expect(mocks.listeners[0].unsubscribe).not.toHaveBeenCalled();
  });

  it('keeps a global-role user scoped to the selected effective organization', async () => {
    mocks.auth.userRole = 'global_admin';
    mocks.auth.effectiveOrganizationId = 'org-global-selection';
    renderHook(() => useSuggestions());
    await startPendingListener();

    expect(onSuggestionsUpdate).toHaveBeenCalledTimes(1);
    expect(mocks.listeners[0].organizationId).toBe('org-global-selection');
  });
});
