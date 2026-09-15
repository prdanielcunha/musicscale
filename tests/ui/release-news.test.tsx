import React from 'react';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let uid = 'release-user-a';
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: uid ? { uid } : null }) }));
import { useReleaseNews } from '../../hooks/useReleaseNews';
import { FEATURE_RELEASE } from '../../lib/appRelease';

describe('release acknowledgment', () => {
  beforeEach(() => { localStorage.clear(); uid = 'release-user-a'; });
  it('synchronizes two mounted consumers and survives remount', () => {
    const first = renderHook(() => useReleaseNews());
    const second = renderHook(() => useReleaseNews());
    expect(first.result.current.hasUnseenRelease).toBe(true);
    act(() => first.result.current.markReleaseSeen());
    expect(second.result.current.hasUnseenRelease).toBe(false);
    first.unmount(); second.unmount();
    const third = renderHook(() => useReleaseNews());
    expect(third.result.current.hasUnseenRelease).toBe(false);
  });
  it('acknowledges in memory when storage has an older value but refuses writes', () => {
    uid = 'release-user-storage-failure';
    localStorage.setItem('musicscale_release_seen:' + uid, 'older-release');
    const hook = renderHook(() => useReleaseNews());
    const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    try {
      act(() => hook.result.current.markReleaseSeen());
      expect(hook.result.current.hasUnseenRelease).toBe(false);
    } finally { write.mockRestore(); }
  });
  it('does not transfer acknowledgment between signed-in users', () => {
    uid = 'release-user-isolation-a';
    const hook = renderHook(() => useReleaseNews());
    act(() => hook.result.current.markReleaseSeen());
    uid = 'release-user-isolation-b';
    hook.rerender();
    expect(hook.result.current.hasUnseenRelease).toBe(true);
  });
  it('reacts to another browser tab and does not alert signed-out visitors', () => {
    uid = 'release-user-tab';
    const hook = renderHook(() => useReleaseNews());
    act(() => {
      localStorage.setItem('musicscale_release_seen:' + uid, FEATURE_RELEASE.id);
      window.dispatchEvent(new Event('storage'));
    });
    expect(hook.result.current.hasUnseenRelease).toBe(false);
    uid = '';
    hook.rerender();
    expect(hook.result.current.hasUnseenRelease).toBe(false);
  });
});
