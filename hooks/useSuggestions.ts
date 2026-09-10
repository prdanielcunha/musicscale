import { logger } from '../lib/logger';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { Suggestion } from '../types';
import * as suggestionApi from '../services/suggestionsService';
import { useAuth } from '../contexts/AuthContext';
import { waitForStartupQuietWindow } from '../lib/startupWorkScheduler';

export const useSuggestions = () => {
    const { user, effectiveOrganizationId } = useAuth();
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const generationRef = useRef(0);

    useEffect(() => {
        const currentGeneration = ++generationRef.current;
        let mounted = true;
        let unsubscribe: (() => void) | undefined;
        let timeoutId: NodeJS.Timeout;

        // Never retain data or errors from the previously active tenant.
        setSuggestions([]);
        setError(null);

        if (user && effectiveOrganizationId) {
            setLoading(true);

            // Suggestions are useful, but they are not part of the first usable
            // screen. On cold mobile start, wait until the critical home has
            // painted before attaching another realtime Firestore listener.
            timeoutId = setTimeout(() => {
                void waitForStartupQuietWindow().then(() => {
                    if (!mounted || generationRef.current !== currentGeneration) return;
                    unsubscribe = suggestionApi.onSuggestionsUpdate(
                        effectiveOrganizationId,
                        (newSuggestions) => {
                            if (!mounted || generationRef.current !== currentGeneration) return;
                            setSuggestions(newSuggestions);
                            setLoading(false);
                            setError(null);
                        },
                        (err) => {
                            if (!mounted || generationRef.current !== currentGeneration) return;
                            setError('Falha ao carregar indicações em tempo real.');
                            logger.error("Failed to load suggestions via hook", err);
                            setLoading(false);
                        }
                    );
                });
            }, 50);

            return () => {
                mounted = false;
                generationRef.current++;
                clearTimeout(timeoutId);
                if (unsubscribe) {
                    try {
                        unsubscribe();
                    } catch (e) {
                         logger.error("Error unsubscribing manually", e);
                    }
                }
            };
        } else {
            setSuggestions([]);
            setLoading(false);
        }
    }, [user, effectiveOrganizationId]);

    // This function is now a no-op because the real-time listener handles all updates automatically.
    // It's kept to satisfy the interface expected by consumers like ModalContext.
    const refreshSuggestions = useCallback(async () => {
        // The listener handles all updates.
    }, []);

    return useMemo(() => ({
        suggestions,
        loading,
        error,
        refreshSuggestions,
    }), [suggestions, loading, error, refreshSuggestions]);
};
