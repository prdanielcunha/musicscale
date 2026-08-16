import React, { createContext, useContext, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { MusicRepository } from '../services/MusicRepository';

interface ApiContextType {
    api: MusicRepository | null;
}

const ApiContext = createContext<ApiContextType | undefined>(undefined);

export const ApiProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { userProfile, effectiveOrganizationId } = useAuth();

    const api = useMemo(() => {
        if (!effectiveOrganizationId) return null;
        return new MusicRepository(effectiveOrganizationId, userProfile || {} as any);
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
