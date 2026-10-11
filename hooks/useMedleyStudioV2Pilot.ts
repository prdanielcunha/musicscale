import { useAuth } from '../contexts/AuthContext';
import { shouldUseMedleyStudioV2 } from '../utils/medleyStudioRollout';

/**
 * Compatibility hook for existing Medley entry points. V2 is now the default
 * for an authenticated organization; there is no public browser opt-in.
 * An explicit canonical organization feature flag set to false is a reversible
 * fail-closed fallback to the legacy editor, without changing any customer data.
 */
export function useMedleyStudioV2Pilot() {
  const { user, organization, effectiveOrganizationId } = useAuth();
  return {
    enabled: shouldUseMedleyStudioV2(user?.uid, effectiveOrganizationId, organization),
  };
}
