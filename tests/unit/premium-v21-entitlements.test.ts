import { describe, expect, it } from 'vitest';
import { PLAN_FEATURES, PLAN_LIMITS } from '../../services/entitlementsConstants';
import { applyEcosystemEntitlements, hasEcosystemEntitlementRole } from '../../services/effectiveEntitlements';
import { organizationHasEcosystemAccess } from '../../services/server/ecosystemEntitlements';
import { resolveAiQuotaLimits, evaluateAiQuota } from '../../services/server/aiFinOpsPolicy';

describe('Premium V2.1 effective entitlements', () => {
  const base = { organizationId: 'org-a', plan: 'starter', status: 'inactive', features: PLAN_FEATURES.starter, limits: PLAN_LIMITS.starter };
  it('unlocks every current and future product key without changing billing plan or tenant', () => {
    const input = { ...base, features: { ...base.features, futureFeature: false }, limits: { ...base.limits, storageBytes: 1024 }, organizationRole: 'member' };
    const effective = applyEcosystemEntitlements(input, 'org-a', true);
    expect(Object.values(effective.features).every(Boolean)).toBe(true);
    expect(Object.values(effective.limits).every(value => value === -1)).toBe(true);
    expect(effective.organizationRole).toBe('member');
    expect(effective.organizationId).toBe('org-a');
    expect(effective.plan).toBe('starter');
    expect(effective.accessSource).toBe('ecosystem');
    expect(input.features.futureFeature).toBe(false);
  });
  it('never applies an override to a different tenant', () => {
    expect(applyEcosystemEntitlements(base, 'org-b', true)).toBe(base);
    expect(applyEcosystemEntitlements(base, '', true)).toBe(base);
  });
  it.each(['starter', 'advanced', 'pro'] as const)('preserves ordinary %s and trial contracts', plan => {
    for (const status of ['active', 'trialing', 'past_due', 'expired']) {
      const input = { ...base, plan, status, features: PLAN_FEATURES[plan], limits: { ...PLAN_LIMITS[plan], ...(plan === 'pro' && status === 'trialing' ? { libraryImportsPerMonth: 20 } : {}) } };
      expect(applyEcosystemEntitlements(input, 'org-a', false)).toBe(input);
    }
  });
  it('resolves the organization benefit from its actual owner, never the caller global role', async () => {
    const read: string[] = [];
    const db = { collection: (name: string) => ({ doc: (uid: string) => ({ get: async () => { read.push(`${name}/${uid}`); return { exists: true, data: () => ({ systemRole: uid === 'ceo-user' ? 'ceo' : 'member' }) }; } }) }) };
    const owned = { ownerUid: 'ceo-user' };
    expect(await organizationHasEcosystemAccess(db, 'org-a', owned)).toBe(true);
    expect(await organizationHasEcosystemAccess(db, 'org-b', { ownerUid: 'another-user' })).toBe(false);
    expect(await organizationHasEcosystemAccess(db, 'org-a', { ...owned, archived: true })).toBe(false);
    expect(owned).toEqual({ ownerUid: 'ceo-user' });
    expect(read).toEqual(['users/ceo-user', 'users/another-user']);
  });
  it('keeps a global actor operationally global without upgrading the common tenant they visit', async () => {
    const owners: Record<string, string> = { 'ecosystem-owner': 'ceo', 'common-owner': 'member' };
    const db = { collection: () => ({ doc: (uid: string) => ({ get: async () => ({ exists: true, data: () => ({ systemRole: owners[uid] }) }) }) }) };
    const globalActor = { uid: 'global-actor', systemRole: 'global_admin' };
    const ecosystemTenant = { ownerUid: 'ecosystem-owner' };
    const commonTenant = { ownerUid: 'common-owner' };

    const ecosystemAccess = await organizationHasEcosystemAccess(db, 'ecosystem-org', ecosystemTenant);
    const commonAccess = await organizationHasEcosystemAccess(db, 'common-org', commonTenant);

    expect(globalActor.systemRole).toBe('global_admin');
    expect(applyEcosystemEntitlements({ ...base, organizationId: 'ecosystem-org' }, 'ecosystem-org', ecosystemAccess).accessSource).toBe('ecosystem');
    expect(applyEcosystemEntitlements({ ...base, organizationId: 'common-org' }, 'common-org', commonAccess).accessSource).not.toBe('ecosystem');
    expect(commonAccess).toBe(false);
  });
  it('does not interpret organization ownership or email as an ecosystem role', () => {
    expect(hasEcosystemEntitlementRole({ role: 'owner', email: 'ceo@example.com' })).toBe(false);
    expect(hasEcosystemEntitlementRole({ globalRole: ' ECOSYSTEM_OWNER ' })).toBe(true);
  });
  it('removes local AI product quotas while preserving ordinary Pro quotas', () => {
    const usage = { monthlyRequestCount: 10000, dailyRequestCount: 10000, monthlyEstimatedTokens: 1e10, dailyEstimatedTokens: 1e10 };
    expect(evaluateAiQuota({ limits: resolveAiQuotaLimits({ plan: 'pro' }), usage, estimatedInputTokens: 100 }).allowed).toBe(false);
    expect(evaluateAiQuota({ limits: resolveAiQuotaLimits({ plan: 'pro', ecosystemAccess: true }), usage, estimatedInputTokens: 100 }).allowed).toBe(true);
  });
});
