import React, { createContext, useContext, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { MusicRepository } from '../services/MusicRepository';

type MusicScaleApi = MusicRepository & {
    musicScaleCommands: MusicRepository['musicScaleCommands'] & {
        save: (musicScaleId: string, payload: any, idempotencyKey: string) => Promise<any>;
    };
};

interface ApiContextType {
    api: MusicScaleApi | null;
}

const ApiContext = createContext<ApiContextType | undefined>(undefined);

const attachMusicScaleSaveCommand = (repository: MusicRepository, organizationId: string): MusicScaleApi => {
    (repository.musicScaleCommands as any).save = async (
        musicScaleId: string,
        payload: any,
        idempotencyKey: string
    ) => {
        const { auth } = await import('../services/firebase');
        const token = await auth.currentUser?.getIdToken();
        if (!token) throw new Error('Usuário não autenticado.');

        const res = await fetch(`/api/v1/music-scales/${musicScaleId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'Idempotency-Key': idempotencyKey,
                'X-Organization-Id': organizationId,
            },
            body: JSON.stringify(payload),
        });

        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            const err = new Error(errData.error || 'Erro ao salvar escala de música.');
            (err as any).correlationId = errData.correlationId;
            (err as any).status = res.status;
            (err as any).code = errData.code;
            throw err;
        }

        return await res.json();
    };

    return repository as MusicScaleApi;
};

export const ApiProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { userProfile, effectiveOrganizationId } = useAuth();

    const api = useMemo(() => {
        if (!effectiveOrganizationId) return null;
        const repository = new MusicRepository(effectiveOrganizationId, userProfile || {} as any);
        return attachMusicScaleSaveCommand(repository, effectiveOrganizationId);
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
