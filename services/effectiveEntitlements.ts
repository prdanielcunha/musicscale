import type { MusicScaleEntitlements } from './entitlementsConstants.js';

export const ECOSYSTEM_ENTITLEMENT_ROLES = ['ceo', 'ecosystem_owner', 'founder'] as const;

export function hasEcosystemEntitlementRole(profile: Record<string, unknown> | null | undefined): boolean {
  return ['systemRole', 'ecosystemRole', 'globalRole'].some(field =>
    ECOSYSTEM_ENTITLEMENT_ROLES.some(role => role === String(profile?.[field] || '').trim().toLowerCase()));
}

/** Product entitlements only. This function never grants membership or RBAC. */
export function applyEcosystemEntitlements<T extends Pick<MusicScaleEntitlements, 'organizationId' | 'features' | 'limits'>>(base: T, authorizedOrganizationId: string, ecosystemAccess: boolean): T & { accessSource?: 'ecosystem' } {
  if (!ecosystemAccess || !authorizedOrganizationId || base.organizationId !== authorizedOrganizationId) return base;
  return {
    ...base,
    accessSource: 'ecosystem',
    accessAllowed: true,
    status: 'active',
    // Enumerate the effective contract: new product keys inherit the override.
    features: Object.fromEntries(Object.keys(base.features).map(key => [key, true])) as unknown as T['features'],
    limits: Object.fromEntries(Object.keys(base.limits).map(key => [key, -1])) as unknown as T['limits'],
  };
}
