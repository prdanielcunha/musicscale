import { logger } from '../lib/logger';

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { Suggestion } from '../types';
import * as suggestionApi from '../services/suggestionsService';
import { useAuth } from '../contexts/AuthContext';

export const useSuggestions = () => {
    const { user, userRole, userProfile } = useAuth();
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let mounted = true;
        let unsubscribe: (() => void) | undefined;
        let timeoutId: NodeJS.Timeout;

        if (user && userProfile?.organizationId) {
            // Set loading to true only on initial user load or when re-subscribing
            setLoading(true);
            
            // Add a small delay before subscribing to prevent rapid mount/unmount crashes (React 18 strict mode / fast refresh)
            timeoutId = setTimeout(() => {
                if (!mounted) return;
                unsubscribe = suggestionApi.onSuggestionsUpdate(
                    userProfile.organizationId,
                    (newSuggestions) => {
                        if (!mounted) return;
                        setSuggestions(newSuggestions);
                        setLoading(false); // Stop loading once first data batch arrives
                        setError(null);
                    },
                    (err) => {
                        if (!mounted) return;
                        setError('Falha ao carregar indicações em tempo real.');
                        logger.error("Failed to load suggestions via hook", err);
                        setLoading(false);
                    }
                );
            }, 50);

            // Cleanup listener on unmount or user change
            return () => {
                mounted = false;
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
            // No user, clear data
            setSuggestions([]);
            setLoading(false);
        }
    }, [user, userRole, userProfile?.organizationId]);

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
