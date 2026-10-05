import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildEffectiveAccessContext,
  canManageMusicScales,
  canManageSongs,
  hasMusicScaleCapability,
} from '../../utils/rbac';
import { resolveAiEntitlement } from '../../services/server/aiRequestSecurity';

const read = (file: string) =>
  fs.readFileSync(path.resolve(process.cwd(), file), 'utf8');

describe('post-purchase MusicScale access continuity', () => {
  it('does not pin inactive entitlement snapshots behind the normal active cache TTL', () => {
    const service = read('services/entitlementsService.ts');

    expect(service).toContain('activeCacheExpiryMs = 60000');
    expect(service).toContain('transitionalCacheExpiryMs = 2500');
    expect(service).toContain('getCacheExpiryMs');
    expect(service).toContain("entitlements.status === 'active' || entitlements.status === 'trialing'");
    expect(service).toContain('Date.now() - cached.fetchedAt < cacheExpiryMs');
  });

  it('force-refreshes entitlements when realtime billing becomes active or trialing', () => {
    const authContext = read('contexts/AuthContext.tsx');

    expect(authContext).toContain('entitlementReconciliationFingerprintRef');
    expect(authContext).toContain("const activeStatuses = new Set(['active', 'trialing'])");
    expect(authContext).toContain('entitlementsService.invalidateOrganizationCache(effectiveOrganizationId)');
    expect(authContext).toContain('entitlementsService.fetchEntitlements(');
    expect(authContext).toContain('true');
    expect(authContext).toContain('retryDelaysMs = [0, 350, 900, 1800]');
  });

  it('keeps a new organization owner able to create/edit songs and scales', () => {
    const access = buildEffectiveAccessContext(
      'owner-uid',
      'org-paid',
      'user',
      'owner',
      'active',
    );

    expect(canManageSongs(access)).toBe(true);
    expect(canManageMusicScales(access)).toBe(true);
    expect(hasMusicScaleCapability(access, 'songs.create')).toBe(true);
    expect(hasMusicScaleCapability(access, 'songs.update')).toBe(true);
    expect(hasMusicScaleCapability(access, 'scales.create')).toBe(true);
    expect(hasMusicScaleCapability(access, 'scales.update')).toBe(true);
    expect(hasMusicScaleCapability(access, 'scales.publish')).toBe(true);
  });

  it('keeps Pro AI import server-authorized from the canonical active entitlement', () => {
    const entitled = resolveAiEntitlement({
      orgData: {
        apps: {
          musicscale: {
            status: 'trialing',
            plan: 'pro',
            features: { aiImport: true },
          },
        },
      },
      requiredFeature: 'aiImport',
      isGlobal: false,
    });

    expect(entitled).toEqual({ ok: true });

    const missingFeature = resolveAiEntitlement({
      orgData: {
        apps: {
          musicscale: {
            status: 'trialing',
            plan: 'pro',
            features: { aiImport: false },
          },
        },
      },
      requiredFeature: 'aiImport',
      isGlobal: false,
    });

    expect(missingFeature.ok).toBe(false);
  });
});
