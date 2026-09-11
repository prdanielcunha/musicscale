import React, { createContext, useContext, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { MusicRepository } from '../services/MusicRepository';
import { readMusicDataCache } from '../lib/musicDataCache';
import { waitForStartupQuietWindow } from '../lib/startupWorkScheduler';

interface ApiContextType {
    api: MusicRepository | null;
}

const ApiContext = createContext<ApiContextType | undefined>(undefined);

type ListRepository = {
    list: (...args: any[]) => Promise<any>;
};

const deferColdStartList = (repository: ListRepository) => {
    const listNow = repository.list.bind(repository);
    repository.list = async (...args: any[]) => {
        await waitForStartupQuietWindow();
        return listNow(...args);
    };
};

const hasUsableMusicCache = (userId: string | undefined, organizationId: string): boolean => {
    if (!userId || typeof window === 'undefined') return false;

    try {
        const cache = readMusicDataCache<any>(window.localStorage, userId, organizationId);
        return cache.status === 'fresh' || cache.status === 'stale';
    } catch {
        return false;
    }
};

export const ApiProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { userProfile, effectiveOrganizationId } = useAuth();

    const api = useMemo(() => {
        if (!effectiveOrganizationId) return null;

        const repository = new MusicRepository(effectiveOrganizationId, userProfile || {} as any);
        const canPaintFromCache = hasUsableMusicCache(userProfile?.uid, effectiveOrganizationId);

        // These enrichments never gate the first operational home and are kept
        // away from the first mobile interaction frames on every cold start.
        [
            repository.eventNames,
            repository.tags,
            repository.roles,
            repository.instruments,
            repository.users,
            repository.fixedBandScales,
        ].forEach(deferColdStartList);

        // Returning users with a valid tenant-scoped cache can already paint a
        // correct operational shell. Revalidating the five critical collections
        // in the same frame only creates Firestore/CPU contention. Defer that
        // refresh until the cached shell has painted; true cache misses remain
        // immediate so first-ever access is not artificially delayed.
        if (canPaintFromCache) {
            [
                repository.songs,
                repository.scales,
                repository.bandScales,
                repository.eventTypes,
                repository.locations,
            ].forEach(deferColdStartList);
        }

        return repository;
    }, [effectiveOrganizationId, userProfile?.uid]);

    const contextValue = useMemo(() => ({ api }), [api]);

    return (
        <ApiContext.Provider value={contextValue}>
            {children}
        </ApiContext.Provider>
    );
};

export const useApi = () => {
    const context = useContext(ApiContext);
    if (context === undefined) {
        throw new Error('useApi must be used within an ApiProvider');
    }
    return context.api;
};

// Optional consumers are useful for isolated presentation/test boundaries.
// Runtime mutation actions still stay disabled unless the real ApiProvider exists.
export const useOptionalApi = (): MusicRepository | null => {
    const context = useContext(ApiContext);
    return context?.api ?? null;
};
