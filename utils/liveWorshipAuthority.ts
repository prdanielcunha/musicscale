import type { LiveWorshipSession } from '../types';

export type LiveWorshipSessionStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface LiveWorshipAuthorityInput {
  session: LiveWorshipSession | null;
  status: LiveWorshipSessionStatus;
  userId?: string | null;
  canManageLiveSession: boolean;
}

export interface LiveWorshipAuthority {
  isLive: boolean;
  isLeader: boolean;
  canStartLiveSession: boolean;
  canControlLiveSession: boolean;
}

export function deriveLiveWorshipAuthority({
  session,
  status,
  userId,
  canManageLiveSession,
}: LiveWorshipAuthorityInput): LiveWorshipAuthority {
  const isReady = status === 'ready';
  const leaderId = isReady ? session?.leaderId || null : null;
  const isLive = !!leaderId;
  const isLeader = !!userId && !!leaderId && leaderId === userId;

  return {
    isLive,
    isLeader,
    canStartLiveSession:
      canManageLiveSession && isReady && (!leaderId || isLeader),
    // The persisted leaderId remains the session host for backward compatibility,
    // but live direction is collaborative: every authorized conductor can control
    // an active session without taking ownership away from the current host.
    canControlLiveSession: canManageLiveSession && isReady && isLive,
  };
}

export function getActiveLiveWorshipSession(
  session: LiveWorshipSession | null,
  status: LiveWorshipSessionStatus,
): LiveWorshipSession | null {
  if (status !== 'ready' || !session?.leaderId) return null;
  return session;
}
