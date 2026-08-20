import { useEffect, useState } from 'react';
import { where } from 'firebase/firestore';
import { useApi } from '../contexts/ApiContext';
import { useAuth } from '../contexts/AuthContext';
import { useCapability } from './useCapability';
import type { LiveWorshipSession, WorshipCue } from '../types';

export type LiveWorshipSessionStatus = 'idle' | 'loading' | 'ready' | 'error';

export function useLiveWorshipSession(scaleId?: string) {
    const api = useApi();
    const { user } = useAuth();
    const { hasCapability } = useCapability();
    const canManageLiveSession = hasCapability('musicscale.scales.manage');
    const [liveSession, setLiveSession] = useState<LiveWorshipSession | null>(null);
    const [isLeader, setIsLeader] = useState(false);
    const [sessionStatus, setSessionStatus] = useState<LiveWorshipSessionStatus>('idle');

    useEffect(() => {
        let active = true;

        // A tenant/scale/user transition must never keep leadership from the
        // previous realtime subscription visible while the next one resolves.
        setLiveSession(null);
        setIsLeader(false);

        if (!api || !scaleId) {
            setSessionStatus('idle');
            return () => {
                active = false;
            };
        }

        setSessionStatus('loading');
        const unsubscribe = api.liveSessions.subscribe(
            (sessions) => {
                if (!active) return;

                const session = sessions[0] || null;
                setLiveSession(session);
                setIsLeader(!!session && !!user?.uid && session.leaderId === user.uid);
                setSessionStatus('ready');
            },
            (error) => {
                if (!active) return;
                console.error('Error subscribing to live session:', error);
                setLiveSession(null);
                setIsLeader(false);
                setSessionStatus('error');
            },
            where('id', '==', scaleId),
        );

        return () => {
            active = false;
            unsubscribe();
        };
    }, [api, scaleId, user?.uid]);

    const activateSession = async (mode: 'worship' | 'rehearsal' = 'worship') => {
        if (
            !api ||
            !scaleId ||
            !user ||
            !canManageLiveSession ||
            sessionStatus !== 'ready' ||
            (liveSession?.leaderId && liveSession.leaderId !== user.uid)
        ) {
            return;
        }

        await api.upsertLiveSession(scaleId, {
            mode,
            leaderId: user.uid,
            lastUpdated: Date.now(),
        });
    };

    const deactivateSession = async () => {
        if (!api || !scaleId || !canManageLiveSession || !isLeader || sessionStatus !== 'ready') return;
        await api.upsertLiveSession(scaleId, { leaderId: null });
    };

    const pushCue = async (cueType: WorshipCue['type'], message?: string) => {
        if (!api || !scaleId || !canManageLiveSession || !isLeader || sessionStatus !== 'ready') return;

        await api.upsertLiveSession(scaleId, {
            activeCue: {
                id: crypto.randomUUID(),
                type: cueType,
                message,
                timestamp: Date.now(),
            },
        });
    };

    const changeSong = async (songId: string) => {
        if (!api || !scaleId || !canManageLiveSession || !isLeader || sessionStatus !== 'ready') return;

        await api.upsertLiveSession(scaleId, {
            activeSongId: songId,
        });
    };

    const changeKeyOverride = async (songId: string, newKey: string) => {
        if (!api || !scaleId || !canManageLiveSession || !isLeader || sessionStatus !== 'ready') return;
        const currentOverrides = liveSession?.keyOverrides || {};
        await api.upsertLiveSession(scaleId, {
            keyOverrides: {
                ...currentOverrides,
                [songId]: newKey,
            },
        });
    };

    const updateSongsOrder = async (newOrder: string[]) => {
        if (!api || !scaleId || !canManageLiveSession || !isLeader || sessionStatus !== 'ready') return;
        await api.upsertLiveSession(scaleId, {
            songsOrder: newOrder,
        });
    };

    return {
        liveSession,
        isLeader,
        canManageLiveSession,
        sessionStatus,
        activateSession,
        deactivateSession,
        pushCue,
        changeSong,
        changeKeyOverride,
        updateSongsOrder,
    };
}
