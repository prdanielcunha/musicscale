import React, { createContext, useContext, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { MusicRepository } from '../services/MusicRepository';
import { waitForStartupQuietWindow } from '../lib/startupWorkScheduler';

interface ApiContextType {
    api: MusicRepository | null;
}

const ApiContext = createContext<ApiContextType | undefined>(undefined);

type ListRepository = {
    list: (...args: any[]) => Promise<any>;
};

/**
 * These collections are not required to paint the first operational home on
 * mobile. Starting all of them beside songs/scales made Firestore snapshots,
 * JSON/object allocation and React updates compete with the user's first taps.
 */
const deferColdStartList = (repository: ListRepository) => {
    const listNow = repository.list.bind(repository);
    repository.list = async (...args: any[]) => {
        await waitForStartupQuietWindow();
        return listNow(...args);
    };
};

export const ApiProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { userProfile, effectiveOrganizationId } = useAuth();

    const api = useMemo(() => {
        if (!effectiveOrganizationId) return null;

        const repository = new MusicRepository(effectiveOrganizationId, userProfile || {} as any);

        // Keep the first wave deliberately small: songs, scales, band scales,
        // event types and locations remain immediate. Everything below enriches
        // the already-usable shell and can safely start after its first paint.
        [
            repository.eventNames,
            repository.tags,
            repository.roles,
            repository.instruments,
            repository.users,
            repository.fixedBandScales,
        ].forEach(deferColdStartList);

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
