export const TAXONOMY_MANAGEMENT_CAPABILITIES = [
  'taxonomy.instruments.manage',
  'taxonomy.skills.manage',
  'taxonomy.eventTypes.manage',
  'taxonomy.eventNames.manage',
  'taxonomy.locations.manage',
  'taxonomy.tags.manage',
] as const;

function normalizeCapabilityList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is string => typeof entry === 'string');
  }

  if (value instanceof Set) {
    return Array.from(value).filter((entry): entry is string => typeof entry === 'string');
  }

  return [];
}

export function canonicalCapabilitiesFromContext(context: any): Set<string> {
  const directCapabilities = normalizeCapabilityList(context?.capabilities);
  const effectiveContext = context?.serverContext?.effectiveContext;
  const effectiveCapabilities = normalizeCapabilityList(effectiveContext?.effectiveCapabilities);
  const effectiveContextCapabilities = normalizeCapabilityList(effectiveContext?.capabilities);

  return new Set([
    ...directCapabilities,
    ...effectiveCapabilities,
    ...effectiveContextCapabilities,
  ]);
}

export function hasCanonicalTaxonomyManagement(context: any): boolean {
  const canonicalCapabilities = canonicalCapabilitiesFromContext(context);
  return TAXONOMY_MANAGEMENT_CAPABILITIES.every((requiredCapability) =>
    canonicalCapabilities.has(requiredCapability),
  );
}
