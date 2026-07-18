import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { StarterPackAllowance } from '../utils/starterPackAllowance';

export function useStarterPackAllowance() {
  const { organization, user } = useAuth();
  const [allowance, setAllowance] = useState<StarterPackAllowance | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAllowance = useCallback(async (signal?: AbortSignal) => {
    if (!organization?.id || !user) {
      setAllowance(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/v1/onboarding/starter-pack/status', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-organization-id': organization.id
        },
        signal
      });

      if (!response.ok) {
        throw new Error('Failed to fetch starter pack allowance');
      }

      const data = await response.json();
      if (data.success && data.allowance) {
        setAllowance(data.allowance);
      } else {
        throw new Error('Invalid response format');
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      console.error('Failed to load starter pack allowance:', err);
      setError(err.message || 'Error loading allowance');
      setAllowance(null);
    } finally {
      setLoading(false);
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
    allowance,
    loading,
    error,
    refreshAllowance: () => fetchAllowance()
  };
}
