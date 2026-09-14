import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { PLAN_FEATURES, PLAN_LIMITS } from '../../services/entitlementsConstants';
import { applyEcosystemEntitlements, hasEcosystemEntitlementRole } from '../../services/effectiveEntitlements';
import { organizationHasEcosystemAccess } from '../../services/server/ecosystemEntitlements';

const read = (file: string) => fs.readFileSync(path.resolve(process.cwd(), file), 'utf8');

describe('CEO / ecosystem-owner AI entitlement hotfix', () => {
  it('unlocks all current and future organization product keys for ecosystem-owner benefit', () => {
    const base = {
      organizationId: 'familia-obpc',
      plan: 'starter',
      status: 'inactive',
      features: { ...PLAN_FEATURES.starter, futureFeature: false },
      limits: { ...PLAN_LIMITS.starter, futureQuota: 1 },
    };

    const effective = applyEcosystemEntitlements(base, 'familia-obpc', true);
    expect(Object.values(effective.features).every(Boolean)).toBe(true);
    expect(Object.values(effective.limits).every(value => value === -1)).toBe(true);
    expect(effective.organizationId).toBe('familia-obpc');
    expect(effective.accessSource).toBe('ecosystem');
  });

  it('recognizes canonical CEO fields but not ordinary tenant roles', () => {
    expect(hasEcosystemEntitlementRole({ systemRole: 'ceo' })).toBe(true);
    expect(hasEcosystemEntitlementRole({ ecosystemRole: 'ecosystem_owner' })).toBe(true);
    expect(hasEcosystemEntitlementRole({ globalRole: 'founder' })).toBe(true);
    expect(hasEcosystemEntitlementRole({ role: 'owner' })).toBe(false);
    expect(hasEcosystemEntitlementRole({ systemRole: 'global_admin' })).toBe(false);
  });

  it('inherits the product benefit from the actual organization owner', async () => {
    const db = {
      collection: () => ({
        doc: (uid: string) => ({
          get: async () => ({
            exists: true,
            data: () => uid === 'owner-ceo' ? { ecosystemRole: 'ceo' } : { systemRole: 'member' },
          }),
        }),
      }),
    };

    expect(await organizationHasEcosystemAccess(db, 'familia-obpc', { ownerUserId: 'owner-ceo' })).toBe(true);
    expect(await organizationHasEcosystemAccess(db, 'other-org', { ownerUserId: 'member-owner' })).toBe(false);
  });

  it('makes the AI/package UI consume the canonical AuthContext entitlement snapshot', () => {
    const hook = read('hooks/useMusicScaleEntitlements.ts');
    const adminHook = read('hooks/useEcosystemAdmin.ts');
    expect(hook).toContain('entitlements?.organizationId === effectiveOrganizationId');
    expect(hook).not.toContain('entitlementsService.fetchEntitlements');
    expect(adminHook).toContain('const { isGlobalAdmin } = useAuth();');
  });

  it('keeps the server authoritative for both CEO role aliases and owner-inherited AI access', () => {
    const aiSecurity = read('services/server/aiRequestSecurity.ts');
    const server = read('server.ts');
    expect(aiSecurity).toContain('userData?.ecosystemRole');
    expect(aiSecurity).toContain('userData?.globalRole');
    expect(aiSecurity).toContain('organizationHasEcosystemAccess');
    expect(server).toContain('applyEcosystemEntitlements');
    expect(server).toContain('organizationHasEcosystemAccess');
  });
});
