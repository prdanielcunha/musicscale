/**
 * Read-only matching for MusicScale legacy ministry metadata.
 *
 * This helper is deliberately tenant-agnostic: callers MUST supply the role
 * name index for the same verified organization and only already-validated
 * tenant-bound historical fields. It never modifies or proposes assignments.
 */
export function normalizeMinistryAuditName(value: unknown): string {
  return typeof value === 'string'
    ? value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase()
    : '';
}

export function collectVerifiedMinistryNameMatches(
  tenantRoleNames: ReadonlyMap<string, readonly string[]> | undefined,
  candidateValues: readonly unknown[],
): string[] {
  if (!tenantRoleNames) return [];

  const candidateNames = new Set<string>();
  for (const source of candidateValues) {
    const values = Array.isArray(source) ? source : [source];
    for (const value of values) {
      const normalized = normalizeMinistryAuditName(value);
      if (normalized) candidateNames.add(normalized);
    }
  }

  const verifiedRoleIds = new Set<string>();
  for (const normalized of candidateNames) {
    for (const id of tenantRoleNames.get(normalized) || []) {
      if (typeof id === 'string' && id.trim()) verifiedRoleIds.add(id);
    }
  }
  return [...verifiedRoleIds];
}
