import { describe, expect, it } from 'vitest';
import type { LiveWorshipSession } from '../../types';
import {
  deriveLiveWorshipAuthority,
  getActiveLiveWorshipSession,
  type LiveWorshipSessionStatus,
} from '../../utils/liveWorshipAuthority';

function session(leaderId: string | null): LiveWorshipSession {
  return {
    id: 'scale-1',
    scaleId: 'scale-1',
    activeSongId: 'song-old',
    activeCue: {
      id: 'cue-old',
      type: 'chorus',
      timestamp: 1,
    },
    keyOverrides: { 'song-old': 'D' },
    songsOrder: ['song-old'],
    spontaneousSongs: [],
    mode: 'worship',
    lastUpdated: 1,
    leaderId,
  };
}

function authority(
  status: LiveWorshipSessionStatus,
  leaderId: string | null,
  userId: string | null,
  canManageLiveSession: boolean,
) {
  return deriveLiveWorshipAuthority({
    session: session(leaderId),
    status,
    userId,
    canManageLiveSession,
  });
}

describe('Live Worship authority', () => {
  it('does not expose stale leadership while realtime state is loading', () => {
    expect(authority('loading', 'user-1', 'user-1', true)).toEqual({
      isLive: false,
      isLeader: false,
      canStartLiveSession: false,
      canControlLiveSession: false,
    });
  });

  it('allows an authorized manager to start when no leader exists', () => {
    expect(authority('ready', null, 'user-1', true)).toEqual({
      isLive: false,
      isLeader: false,
      canStartLiveSession: true,
      canControlLiveSession: false,
    });
  });

  it('allows only the current authorized leader to control a live session', () => {
    expect(authority('ready', 'user-1', 'user-1', true)).toEqual({
      isLive: true,
      isLeader: true,
      canStartLiveSession: true,
      canControlLiveSession: true,
    });
  });

  it('does not let another authorized manager take over an active leader through UI state', () => {
    expect(authority('ready', 'user-2', 'user-1', true)).toEqual({
      isLive: true,
      isLeader: false,
      canStartLiveSession: false,
      canControlLiveSession: false,
    });
  });

  it('does not expose start/control authority to a member without scales.manage', () => {
    expect(authority('ready', null, 'user-1', false)).toEqual({
      isLive: false,
      isLeader: false,
      canStartLiveSession: false,
      canControlLiveSession: false,
    });
  });

  it('treats error state as non-live even if a stale record still names the user', () => {
    expect(authority('error', 'user-1', 'user-1', true)).toEqual({
      isLive: false,
      isLeader: false,
      canStartLiveSession: false,
      canControlLiveSession: false,
    });
  });

  it('hides residual activeSong/cue/key data when the persisted session has no active leader', () => {
    const inactive = session(null);
    expect(getActiveLiveWorshipSession(inactive, 'ready')).toBeNull();
  });

  it('returns active session data only after ready state confirms an active leader', () => {
    const active = session('user-1');
    expect(getActiveLiveWorshipSession(active, 'loading')).toBeNull();
    expect(getActiveLiveWorshipSession(active, 'ready')).toBe(active);
  });
});
