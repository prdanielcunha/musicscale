import { useAuth } from '../contexts/AuthContext';
import { useEcosystem } from '../contexts/EcosystemContext';

export type MusicScaleCapability = 
  | 'musicscale.songs.edit'
  | 'musicscale.scales.manage'
  | 'musicscale.members.manage'
  | 'musicscale.performance.use'
  | 'musicscale.taxonomy.manage'
  | 'manageOrganization';

const TAXONOMY_CAPABILITIES = [
  'taxonomy.instruments.manage',
  'taxonomy.skills.manage',
  'taxonomy.eventTypes.manage',
  'taxonomy.eventNames.manage',
  'taxonomy.locations.manage',
  'taxonomy.tags.manage',
] as const;

function canonicalCapabilitiesFromContext(context: any): Set<string> {
  const directCapabilities = Array.isArray(context?.capabilities)
    ? context.capabilities
    : [];
  const effectiveCapabilities = Array.isArray(
    context?.serverContext?.effectiveContext?.effectiveCapabilities,
  )
    ? context.serverContext.effectiveContext.effectiveCapabilities
    : [];

  return new Set([...directCapabilities, ...effectiveCapabilities]);
}

export function hasCanonicalTaxonomyManagement(context: any): boolean {
  const canonicalCapabilities = canonicalCapabilitiesFromContext(context);
  return TAXONOMY_CAPABILITIES.every((requiredCapability) =>
    canonicalCapabilities.has(requiredCapability),
  );
}

export function useCapability() {
  const { permissions, isGlobalAdmin } = useAuth();
  const { context } = useEcosystem();

  const hasCapability = (capability: MusicScaleCapability | string): boolean => {
    if (isGlobalAdmin) return true;
    if (permissions?.[capability as string]) return true;

    const canonicalCapabilities = canonicalCapabilitiesFromContext(context);
    if (canonicalCapabilities.has(capability)) return true;

    if (capability === 'musicscale.taxonomy.manage') {
      return hasCanonicalTaxonomyManagement(context);
    }

    return false;
  };

  return { hasCapability };
}
