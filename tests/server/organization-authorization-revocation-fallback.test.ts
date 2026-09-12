import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../services/server/musicScaleMemberProjection.js', () => ({
  resolveMusicScaleMemberProfile: vi.fn().mockResolvedValue({ roleId: null, source: 'none' }),
}));

import { resolveOrganizationAuthorization } from '../../services/server/organizationAuthorization.js';

function makeDb() {
  const docs = new Map<string, any>([
    ['users/user_1', { systemRole: 'member' }],
    ['organizations/org_1', { status: 'active', ownerUid: 'user_1' }],
    ['organizations/org_1/members/user_1', { status: 'active', role: 'owner', organizationRole: 'owner' }],
  ]);

  const docRef = (path: string): any => ({
    collection: (name: string) => collectionRef(`${path}/${name}`),
    get: async () => ({
      exists: docs.has(path),
      data: () => docs.get(path),
    }),
  });

  const collectionRef = (path: string): any => ({
    doc: (id: string) => docRef(`${path}/${id}`),
  });

  return {
    collection: (name: string) => collectionRef(name),
  };
}

describe('resolveOrganizationAuthorization revocation IAM fallback', () => {
  let verifyIdToken: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    verifyIdToken = vi.fn();
  });

  it('retries without revocation lookup only when Firebase IAM blocks that lookup', async () => {
    const permissionError: any = new Error('Permission denied while checking token revocation');
    permissionError.code = 'auth/insufficient-permission';

    verifyIdToken
      .mockRejectedValueOnce(permissionError)
      .mockResolvedValueOnce({ uid: 'user_1', email: 'user@example.com' });

    const result = await resolveOrganizationAuthorization(
      'Bearer valid-token',
      'org_1',
      makeDb(),
      { verifyIdToken },
    );

    expect(result.error).toBeUndefined();
    expect(result.context).toMatchObject({ uid: 'user_1', isOwner: true, isActive: true });
    expect(verifyIdToken).toHaveBeenNthCalledWith(1, 'valid-token', true);
    expect(verifyIdToken).toHaveBeenNthCalledWith(2, 'valid-token', false);
  });

  it('does not bypass normal invalid or expired token failures', async () => {
    const expiredError: any = new Error('Firebase ID token has expired');
    expiredError.code = 'auth/id-token-expired';
    verifyIdToken.mockRejectedValueOnce(expiredError);

    const result = await resolveOrganizationAuthorization(
      'Bearer expired-token',
      'org_1',
      makeDb(),
      { verifyIdToken },
    );

    expect(result).toEqual({ statusCode: 401, error: 'INVALID_ID_TOKEN' });
    expect(verifyIdToken).toHaveBeenCalledTimes(1);
    expect(verifyIdToken).toHaveBeenCalledWith('expired-token', true);
  });

  it('keeps explicit checkRevoked false callers on a single standard Firebase verification', async () => {
    verifyIdToken.mockResolvedValueOnce({ uid: 'user_1' });

    const result = await resolveOrganizationAuthorization(
      'Bearer valid-token',
      'org_1',
      makeDb(),
      { verifyIdToken },
      { checkRevoked: false },
    );

    expect(result.error).toBeUndefined();
    expect(verifyIdToken).toHaveBeenCalledTimes(1);
    expect(verifyIdToken).toHaveBeenCalledWith('valid-token', false);
  });
});
