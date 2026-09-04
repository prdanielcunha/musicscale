import { useEffect, useState } from 'react';
import { where } from 'firebase/firestore';
import { useApi } from '../contexts/ApiContext';
import { useAuth } from '../contexts/AuthContext';
import { useCapability } from './useCapability';
import type { LiveWorshipSession, WorshipCue } from '../types';
import {
    deriveLiveWorshipAuthority,
    getActiveLiveWorshipSession,
    type LiveWorshipSessionStatus,
} from '../utils/liveWorshipAuthority';

export type { LiveWorshipSessionStatus } from '../utils/liveWorshipAuthority';

export function useLiveWorshipSession(scaleId?: string) {
    const api = useApi();
    const { user } = useAuth();
    const { hasCapability } = useCapability();
    // Dedicated Stage capability is preferred. Existing scale managers keep
    // every Live Worship ability as a non-regression compatibility fallback
    // until role presets are migrated to musicscale.live.conduct.
    const canManageLiveSession =
        hasCapability('musicscale.live.conduct') ||
        hasCapability('musicscale.scales.manage');
    const [sessionRecord, setSessionRecord] = useState<LiveWorshipSession | null>(null);
    const [sessionStatus, setSessionStatus] = useState<LiveWorshipSessionStatus>('idle');

    useEffect(() => {
        let active = true;

        // A tenant/scale/user transition must never expose the previous
        // subscription while the next realtime scope resolves.
        setSessionRecord(null);

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
                setSessionRecord(sessions[0] || null);
                setSessionStatus('ready');
            },
            (error) => {
                if (!active) return;
                console.error('Error subscribing to live session:', error);
                setSessionRecord(null);
                setSessionStatus('error');
            },
            where('id', '==', scaleId),
        );

        return () => {
            active = false;
            unsubscribe();
        };
    }, [api, scaleId, user?.uid]);

    const authority = deriveLiveWorshipAuthority({
        session: sessionRecord,
        status: sessionStatus,
        userId: user?.uid,
        canManageLiveSession,
    });
    const liveSession = getActiveLiveWorshipSession(sessionRecord, sessionStatus);

    const activateSession = async (mode: 'worship' | 'rehearsal' = 'worship') => {
        if (!api || !scaleId || !user || !authority.canStartLiveSession) return false;

        try {
            await api.upsertLiveSession(scaleId, {
                mode,
                leaderId: user.uid,
                activeCue: null,
                activeSongId: null,
                activeSection: null,
                lastUpdated: Date.now(),
            });
            return true;
        } catch (error) {
            console.error('Error activating live session:', error);
            return false;
        }
    };

    const deactivateSession = async () => {
        if (!api || !scaleId || !authority.canControlLiveSession) return false;
        try {
            await api.upsertLiveSession(scaleId, {
                leaderId: null,
                activeCue: null,
                activeSection: null,
            });
            return true;
        } catch (error) {
            console.error('Error deactivating live session:', error);
            return false;
        }
    };

    const pushCue = async (cueType: WorshipCue['type'], message?: string) => {
        if (!api || !scaleId || !authority.canControlLiveSession) return false;

        try {
            await api.upsertLiveSession(scaleId, {
                activeCue: {
                    id: crypto.randomUUID(),
                    type: cueType,
                    message,
                    timestamp: Date.now(),
                },
            });
            return true;
        } catch (error) {
            console.error('Error pushing live cue:', error);
            return false;
        }
    };

    const changeSong = async (songId: string) => {
        if (!api || !scaleId || !authority.canControlLiveSession) return false;

        try {
            await api.upsertLiveSession(scaleId, {
                activeSongId: songId,
                activeSection: null,
            });
            return true;
        } catch (error) {
            console.error('Error changing live song:', error);
            return false;
        }
    };

    const changeSection = async (
        songId: string,
        sectionIndex: number,
        label: string,
    ) => {
        if (!api || !scaleId || !user || !authority.canControlLiveSession) return false;

        try {
            await api.upsertLiveSession(scaleId, {
                activeSection: {
                    songId,
                    sectionIndex,
                    label,
                    commandId: crypto.randomUUID(),
                    timestamp: Date.now(),
                    actorId: user.uid,
                },
            });
            return true;
        } catch (error) {
            console.error('Error changing live section:', error);
            return false;
        }
    };

    const changeKeyOverride = async (songId: string, newKey: string) => {
        if (!api || !scaleId || !authority.canControlLiveSession) return false;
        const currentOverrides = liveSession?.keyOverrides || {};
        try {
            await api.upsertLiveSession(scaleId, {
                keyOverrides: {
                    ...currentOverrides,
                    [songId]: newKey,
                },
            });
            return true;
        } catch (error) {
            console.error('Error changing live key override:', error);
            return false;
        }
    };

    const updateSongsOrder = async (newOrder: string[]) => {
        if (!api || !scaleId || !authority.canControlLiveSession) return false;
        try {
            await api.upsertLiveSession(scaleId, {
                songsOrder: newOrder,
            });
            return true;
        } catch (error) {
            console.error('Error updating live song order:', error);
            return false;
        }
    };

    return {
        liveSession,
        isLeader: authority.isLeader,
        isLive: authority.isLive,
        canManageLiveSession,
        canConductLiveSession: canManageLiveSession,
        canStartLiveSession: authority.canStartLiveSession,
        canControlLiveSession: authority.canControlLiveSession,
        sessionStatus,
        activateSession,
        deactivateSession,
        pushCue,
        changeSong,
        changeSection,
        changeKeyOverride,
        updateSongsOrder,
    };
}
