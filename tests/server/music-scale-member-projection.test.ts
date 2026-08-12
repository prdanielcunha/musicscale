import { describe, expect, it } from 'vitest';
import {
  resolveMusicScaleMemberProfile,
  sanitizeMusicScaleMemberPatch,
  validateMusicScaleRole,
  writeMusicScaleMemberProjection
} from '../../services/server/musicScaleMemberProjection';

function mockDb(seed: Record<string, any>) {
  const writes: Array<{ path: string; data: any }> = [];
  const ref = (path: string): any => ({
    collection: (name: string) => ref(`${path}/${name}`),
    doc: (id: string) => ref(`${path}/${id}`),
    get: async () => ({ exists: Object.prototype.hasOwnProperty.call(seed, path), data: () => seed[path] }),
    set: async (data: any) => writes.push({ path, data })
  });
  return { db: { collection: (name: string) => ref(name) }, writes };
}

describe('MusicScale member projection', () => {
  it('prefers projection without changing the canonical organization role', async () => {
    const { db } = mockDb({
      'organizations/org-a/musicscale_members/user-1': { roleId: 'role-projection', musicscaleRole: 'admin' }
    });
    const canonical = { organizationRole: 'member', roleId: 'role-legacy' };
    const result = await resolveMusicScaleMemberProfile(db, 'org-a', 'user-1', canonical);
    expect(result).toMatchObject({ roleId: 'role-projection', source: 'projection' });
    expect(canonical.organizationRole).toBe('member');
  });

  it('keeps old users working through canonical tenant-bound fallback', async () => {
    const { db } = mockDb({});
    await expect(resolveMusicScaleMemberProfile(db, 'org-a', 'user-1', {
      organizationRole: 'member', roleId: 'role-admin'
    })).resolves.toMatchObject({ roleId: 'role-admin', source: 'legacy_canonical_membership' });
  });

  it('accepts only a mirror bound to the requested tenant and uid', async () => {
    const { db } = mockDb({
      'organization_members/user-1_org-b': { uid: 'user-1', organizationId: 'org-a', roleId: 'wrong' },
      'organization_members/org-b_user-1': { uid: 'user-1', organizationId: 'org-b', roleId: 'right' }
    });
    await expect(resolveMusicScaleMemberProfile(db, 'org-b', 'user-1')).resolves.toMatchObject({
      roleId: 'right', source: 'legacy_membership_mirror'
    });
  });

  it('rejects a role belonging to another tenant', async () => {
    const { db } = mockDb({ 'roles/role-a': { organizationId: 'org-a' } });
    await expect(validateMusicScaleRole(db, 'org-b', 'role-a')).rejects.toThrow('ROLE_ORGANIZATION_MISMATCH');
  });

  it('writes only allowlisted MusicScale fields to the projection', async () => {
    const { db, writes } = mockDb({ 'roles/role-a': { organizationId: 'org-a' } });
    await writeMusicScaleMemberProjection(db, 'org-a', 'user-1', 'admin-1', {
      roleId: 'role-a', musicscaleRole: 'admin', specialtyIds: ['vocal'],
      organizationRole: 'owner', systemRole: 'ceo', status: 'active'
    });
    expect(writes).toHaveLength(1);
    expect(writes[0].path).toBe('organizations/org-a/musicscale_members/user-1');
    expect(writes[0].data).toMatchObject({ roleId: 'role-a', musicscaleRole: 'admin', specialtyIds: ['vocal'] });
    expect(writes[0].data).not.toHaveProperty('organizationRole');
    expect(writes[0].data).not.toHaveProperty('systemRole');
    expect(writes[0].data).not.toHaveProperty('status');
  });

  it('sanitizes fields without accepting authority metadata', () => {
    expect(sanitizeMusicScaleMemberPatch({ roleId: ' role-a ', organizationRole: 'admin', globalRole: 'ceo' }))
      .toEqual({ roleId: 'role-a' });
  });
});
