import { useCallback, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useEcosystem } from '../contexts/EcosystemContext';
import {
  canonicalCapabilitiesFromContext,
  hasCanonicalTaxonomyManagement,
} from '../utils/taxonomyAccess';

export type MusicScaleCapability = 
  | 'musicscale.songs.edit'
  | 'musicscale.scales.manage'
  | 'musicscale.members.manage'
  | 'musicscale.performance.use'
  | 'musicscale.live.conduct'
  | 'musicscale.taxonomy.manage'
  | 'manageOrganization';

export function useCapability() {
  const { permissions, isGlobalAdmin } = useAuth();
  const { context } = useEcosystem();

  const canonicalCapabilities = useMemo(
    () => canonicalCapabilitiesFromContext(context),
    [context],
  );

  const hasCapability = useCallback((capability: MusicScaleCapability | string): boolean => {
    if (isGlobalAdmin) return true;
    if (permissions?.[capability as string]) return true;
    if (canonicalCapabilities.has(capability)) return true;

    if (capability === 'musicscale.taxonomy.manage') {
      return hasCanonicalTaxonomyManagement(context);
    }

    return false;
  }, [canonicalCapabilities, context, isGlobalAdmin, permissions]);

  return { hasCapability };
}
