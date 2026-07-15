import React, { useEffect, useRef, useState } from 'react';
import { getPerformanceState, clearPerformanceState } from '../../services/offline/database';
import { useAuth } from '../../contexts/AuthContext';
import { useMusic } from '../../contexts/MusicDataContext';
import { useModals } from '../../contexts/ModalContext';

export const PerformanceRecovery: React.FC = () => {
    const { loading: authLoading } = useAuth();
    const { populatedScales, songs, loading: musicLoading } = useMusic();
    const { openSongDetail } = useModals();
    
    const [recoveryState, setRecoveryState] = useState<any>(null);
    const hasRecovered = useRef(false);

    useEffect(() => {
        let isMounted = true;
        const fetchState = async () => {
            try {
                const state = await getPerformanceState();
                if (!isMounted) return;

                if (!state || !state.songId) {
                    return;
                }

                if (Date.now() - state.timestamp > 2 * 60 * 60 * 1000) {
                    await clearPerformanceState();
                    return;
                }

                setRecoveryState(state);
            } catch (e) {
                console.error("Failed to fetch performance state:", e);
            }
        };

        fetchState();

        return () => {
            isMounted = false;
        };
    }, []);

    useEffect(() => {
        if (!recoveryState || authLoading || musicLoading || hasRecovered.current) {
            return;
        }

        const executeRecovery = async () => {
            hasRecovered.current = true;
            try {
                const songToRecover = songs.find(s => s.id === recoveryState.songId);
                if (!songToRecover) {
                    return;
                }

                let scaleContext = null;
                if (recoveryState.scaleId && populatedScales) {
                    const scale = populatedScales.find(s => s.id === recoveryState.scaleId);
                    if (scale) {
                        const index = scale.songs.findIndex(s => s.id === songToRecover.id);
                        if (index !== -1) {
                            scaleContext = {
                                scaleId: scale.id,
                                songs: scale.songs,
                                currentIndex: index
                            };
                        }
                    }
                }

                openSongDetail(songToRecover, false, scaleContext, true);

                const timerId = setTimeout(() => {
                    window.dispatchEvent(new Event('musicscale:restored'));
                }, 500);
                
                return () => clearTimeout(timerId);
            } catch (e) {
                console.error("Failed to execute performance recovery:", e);
            }
        };

        const cleanup = executeRecovery();
        return () => {
            cleanup.then(fn => fn && fn());
        };
    }, [recoveryState, authLoading, musicLoading, songs, populatedScales, openSongDetail]);

    return null;
};
