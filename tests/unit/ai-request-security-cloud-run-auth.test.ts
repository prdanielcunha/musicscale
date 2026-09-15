import { describe, expect, it, vi } from 'vitest';

vi.mock('../../services/server/ecosystemEntitlements', () => ({
  organizationHasEcosystemAccess: vi.fn().mockResolvedValue(false),
}));

vi.mock('../../services/server/musicScaleMemberProjection', () => ({
  resolveMusicScaleMemberProfile: vi.fn().mockResolvedValue({ roleId: null, source: 'none' }),
}));

import { authorizeAiRequest } from '../../services/server/aiRequestSecurity';

function createGlobalCeoDb() {
  return {
    collection: vi.fn((collectionName: string) => ({
      doc: vi.fn((docId: string) => ({
        get: vi.fn(async () => {
          if (collectionName === 'users' && docId === 'ceo-uid') {
            return {
              exists: true,
              data: () => ({ systemRole: 'ceo' }),
            };
          }

          if (collectionName === 'organizations' && docId === 'ceo-org') {
            return {
              exists: true,
              data: () => ({ status: 'active', plan: 'starter' }),
            };
          }

          return { exists: false, data: () => null };
        }),
      })),
    })),
  };
}

describe('AI request Firebase token verification on Cloud Run', () => {
  it('falls back only when revoked-token lookup is blocked by IAM and keeps CEO access global', async () => {
    const iamError = Object.assign(new Error('Insufficient permission to access Firebase Auth'), {
      code: 'auth/insufficient-permission',
    });

    const verifyIdToken = vi.fn()
      .mockRejectedValueOnce(iamError)
      .mockResolvedValueOnce({ uid: 'ceo-uid', email: 'ceo@example.com' });

    const result = await authorizeAiRequest({
      authHeader: 'Bearer valid-token',
      organizationId: 'ceo-org',
      claimedUserId: 'ceo-uid',
      requiredFeature: 'aiImport',
      requiredAnyPermissions: ['canManageRepertoire'],
      dbInstance: createGlobalCeoDb(),
      authInstance: { verifyIdToken },
    });

    expect(verifyIdToken).toHaveBeenNthCalledWith(1, 'valid-token', true);
    expect(verifyIdToken).toHaveBeenNthCalledWith(2, 'valid-token', false);
    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.context.uid).toBe('ceo-uid');
      expect(result.context.systemRole).toBe('ceo');
      expect(result.context.isGlobal).toBe(true);
      expect(result.context.organizationId).toBe('ceo-org');
    }
  });

  it('does not bypass invalid or expired Firebase tokens', async () => {
    const verifyIdToken = vi.fn().mockRejectedValue(
      Object.assign(new Error('Firebase ID token has expired'), { code: 'auth/id-token-expired' }),
    );

    const result = await authorizeAiRequest({
      authHeader: 'Bearer expired-token',
      organizationId: 'ceo-org',
      claimedUserId: 'ceo-uid',
      requiredFeature: 'aiImport',
      requiredAnyPermissions: ['canManageRepertoire'],
      dbInstance: createGlobalCeoDb(),
      authInstance: { verifyIdToken },
    });

    expect(verifyIdToken).toHaveBeenCalledTimes(1);
    expect(verifyIdToken).toHaveBeenCalledWith('expired-token', true);
    expect(result).toEqual({ ok: false, statusCode: 401, error: 'UNAUTHORIZED' });
  });
});
