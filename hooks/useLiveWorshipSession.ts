import { useState, useEffect } from 'react';
import { useApi } from '../contexts/ApiContext';
import { LiveWorshipSession, WorshipCue, PopulatedSong } from '../types';
import { where } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';

export function useLiveWorshipSession(scaleId?: string) {
    const api = useApi();
    const { user } = useAuth();
    const [liveSession, setLiveSession] = useState<LiveWorshipSession | null>(null);
    const [isLeader, setIsLeader] = useState(false);

    useEffect(() => {
        if (!api || !scaleId) return;

        const unsubscribe = api.liveSessions.subscribe(
            (sessions) => {
                if (sessions.length > 0) {
                    const session = sessions[0];
                    setLiveSession(session);
                    // Check if current user is leader of this session
                    if (session.leaderId && session.leaderId === user?.uid) {
                        setIsLeader(true);
                    } else if (!session.leaderId) {
                        setIsLeader(false);
                    }
                } else {
                    setLiveSession(null);
                    setIsLeader(false);
                }
            },
            (error) => {
                console.error("Error subscribing to live session:", error);
            },
            where('id', '==', scaleId)
        );

        return () => unsubscribe();
    }, [api, scaleId, user?.uid]);

    const activateSession = async (mode: 'worship' | 'rehearsal' = 'worship') => {
        if (!api || !scaleId || !user) return;
        
        await api.upsertLiveSession(scaleId, {
            mode,
            leaderId: user.uid,
            lastUpdated: Date.now()
        });
    };

    const deactivateSession = async () => {
        if (!api || !scaleId) return;
        await api.upsertLiveSession(scaleId, { leaderId: null });
    };

    const pushCue = async (cueType: WorshipCue['type'], message?: string) => {
        if (!api || !scaleId || !isLeader) return;
        
        await api.upsertLiveSession(scaleId, {
            activeCue: {
                id: crypto.randomUUID(),
                type: cueType,
                message,
                timestamp: Date.now()
            }
        });
    };

    const changeSong = async (songId: string) => {
        if (!api || !scaleId || !isLeader) return;
        
        await api.upsertLiveSession(scaleId, {
            activeSongId: songId
        });
    };

    const changeKeyOverride = async (songId: string, newKey: string) => {
        if (!api || !scaleId || !isLeader) return;
        const currentOverrides = liveSession?.keyOverrides || {};
        await api.upsertLiveSession(scaleId, {
            keyOverrides: {
                ...currentOverrides,
                [songId]: newKey
            }
        });
    };
    
    const updateSongsOrder = async (newOrder: string[]) => {
        if (!api || !scaleId || !isLeader) return;
        await api.upsertLiveSession(scaleId, {
            songsOrder: newOrder
        });
    };

    return {
        liveSession,
        isLeader,
        activateSession,
        deactivateSession,
        pushCue,
        changeSong,
        changeKeyOverride,
        updateSongsOrder
    };
}
