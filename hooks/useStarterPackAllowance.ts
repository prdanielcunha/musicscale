import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { StarterPackAllowance } from '../utils/starterPackAllowance';

export interface StarterPackError {
  message: string;
  code?: string;
  status?: number;
  correlationId?: string;
}

export function useStarterPackAllowance() {
  const { organization, user } = useAuth();
  const [allowance, setAllowance] = useState<StarterPackAllowance | null>(null);
  const [starterPack, setStarterPack] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<StarterPackError | null>(null);
  const retryCount = useRef(0);

  const fetchAllowance = useCallback(async (signal?: AbortSignal, isRetry = false) => {
    if (!organization?.id || !user) {
      setAllowance(null);
        setStarterPack([]);
      setLoading(false);
      return;
    }

    if (!isRetry) {
      setLoading(true);
      setError(null);
      retryCount.current = 0;
    }

    try {
      const forceRefresh = isRetry && retryCount.current === 1;
      const token = await user.getIdToken(forceRefresh);
      
      const response = await fetch('/api/v1/onboarding/starter-pack', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-organization-id': organization.id
        },
        signal
      });

      if (!response.ok) {
        if (response.status === 401 && retryCount.current < 1) {
          retryCount.current += 1;
          return fetchAllowance(signal, true);
        }

        let errData: any = {};
        try {
          errData = await response.json();
        } catch {
          // ignore
        }
        
        let message = errData.message || 'Falha ao buscar os dados do pacote inicial';
        if (response.status === 401) message = 'Sessão expirada ou inválida. Faça login novamente.';
        if (response.status === 403) message = errData.message || 'Sem permissão ou sem assinatura do MusicScale.';
        if (response.status === 404) message = 'Organização não encontrada.';
        
        setError({
          message,
          code: errData.error || (response.status === 401 ? 'UNAUTHORIZED' : 'UNKNOWN_ERROR'),
          status: response.status,
          correlationId: errData.correlationId
        });
        setAllowance(null);
        setStarterPack([]);
        setLoading(false);
        return;
      }

      const data = await response.json();

      if (data.success && data.allowance) {
        setAllowance(data.allowance);
        if (data.starterPack) setStarterPack(data.starterPack);
        setError(null);
      } else if (!data.allowance) {
        setError({
          message: 'Estamos atualizando o acesso ao pacote inicial. Tente novamente em instantes.',
          code: 'BACKEND_ALLOWANCE_CONTRACT_UNAVAILABLE'
        });
        setAllowance(null);
        setStarterPack([]);
        setLoading(false);
      } else {
        throw new Error('Formato de resposta inválido');
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      console.error('Failed to load starter pack allowance:', err);
      setError({
        message: 'Erro de conexão. Tente novamente mais tarde.',
        code: 'NETWORK_ERROR'
      });
      setAllowance(null);
    } finally {
      if (!isRetry || retryCount.current >= 1) {
        setLoading(false);
      }
    }
  }, [organization?.id, user]);

  useEffect(() => {
    const controller = new AbortController();
    
    // Clear allowance immediately on organization change
    setAllowance(null);
    setLoading(true);
    
    fetchAllowance(controller.signal);

    return () => {
      controller.abort();
    };
  }, [fetchAllowance, organization?.id]);

  return {
    starterPack,
    allowance,
    loading,
    error,
    refreshAllowance: () => fetchAllowance()
  };
}
