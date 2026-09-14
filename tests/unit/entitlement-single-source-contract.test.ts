import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => fs.readFileSync(path.resolve(process.cwd(), file), 'utf8');

describe('canonical MusicScale entitlement source', () => {
  it('makes plan/AI gates consume the AuthContext entitlement snapshot instead of refetching independently', () => {
    const hook = read('hooks/useMusicScaleEntitlements.ts');

    expect(hook).toContain('entitlements,');
    expect(hook).toContain('isEntitlementsLoaded,');
    expect(hook).toContain('refreshSubscriptionAccess,');
    expect(hook).toContain('entitlements?.organizationId === effectiveOrganizationId');
    expect(hook).not.toContain('entitlementsService.fetchEntitlements');
    expect(hook).not.toContain('musicscale.entitlements.cached.');
    expect(hook).not.toContain('globalCachedEntitlements');
  });

  it('keeps the AI import gate wired to the canonical feature hook', () => {
    const modal = read('components/songs/AiSongImportModal.tsx');
    expect(modal).toContain("useMusicScaleFeature('aiImport')");
  });

  it('uses AuthContext canonical global-role reconciliation for ecosystem admin consumers', () => {
    const adminHook = read('hooks/useEcosystemAdmin.ts');
    expect(adminHook).toContain('const { isGlobalAdmin } = useAuth();');
    expect(adminHook).toContain('isEcosystemAdmin: isGlobalAdmin');
    expect(adminHook).not.toContain('isEcosystemAdmin = isGlobalPrivilegedUser(undefined, userProfile)');
  });

  it('retains owner-scoped ecosystem inheritance without turning global access into tenant ownership', () => {
    const ownerAccess = read('services/server/ecosystemEntitlements.ts');
    const effective = read('services/effectiveEntitlements.ts');

    expect(ownerAccess).toContain('resolveOrganizationOwnerUserId');
    expect(ownerAccess).toContain('hasEcosystemEntitlementRole(ownerSnap.data())');
    expect(ownerAccess).toContain('Caller-global/admin state is deliberately irrelevant');
    expect(effective).toContain("ECOSYSTEM_ENTITLEMENT_ROLES = ['ceo', 'ecosystem_owner', 'founder']");
    expect(effective).toContain('Object.keys(base.features).map(key => [key, true])');
    expect(effective).toContain('Object.keys(base.limits).map(key => [key, -1])');
  });
});
