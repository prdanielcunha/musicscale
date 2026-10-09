import { describe, expect, it } from 'vitest';
import { collectTenantMemberDirectoryCandidates, isVerifiedTenantMemberForMusicScaleWrite } from '../../services/server/memberDirectoryCandidates.js';

const snapshot = (id: string, payload: Record<string, unknown>) =>
  ({ id, data: () => payload });

const canonical = [
  snapshot('activeA', {status:'active',organizationId:'orgA',organizationRole:'member'}),
  snapshot('removedA', {status:'removed',organizationId:'orgA'}),
  snapshot('implicitA', {organizationId:'orgA',organizationRole:'owner'}),
];

describe('read-only member directory compatibility', () => {
  it('lists canonical active/missing-status members and tenant-bound active legacy users', () => {
    const rows=collectTenantMemberDirectoryCandidates({
      organizationId:'orgA', canonical, legacy:[
        snapshot('a_orgA', {uid:'legacyA',organizationId:'orgA',status:'active',displayName:'Legacy Member'}),
        snapshot('orgA_b', {userId:'legacyB',organization_id:'orgA',status:'ativo'}),
      ],
    });
    expect(rows.map(r=>r.id)).toEqual(['activeA','implicitA','legacyA','legacyB']);
  });

  it('does not restore explicitly inactive canonical roles from an active legacy mirror', () => {
    const rows=collectTenantMemberDirectoryCandidates({
      organizationId:'orgA', canonical,
      legacy:[snapshot('removedA_orgA', {uid:'removedA',organizationId:'orgA',status:'active'})],
    });
    expect(rows.map(r=>r.id)).not.toContain('removedA');
  });

  it('rejects foreign tenant, revoked, missing-status and malformed legacy memberships', () => {
    const rows=collectTenantMemberDirectoryCandidates({
      organizationId:'orgA', canonical:[], legacy:[
        snapshot('wrong', {uid:'other',organizationId:'orgB',status:'active'}),
        snapshot('disabled', {uid:'disabled',organizationId:'orgA',status:'active',disabled:true}),
        snapshot('removed', {uid:'removed',organizationId:'orgA',status:'removed'}),
        snapshot('no-status', {uid:'unknown',organizationId:'orgA'}),
        snapshot('no-uid', {organizationId:'orgA',status:'active'}),
        snapshot('malformed', {uid:'../foreign',organizationId:'orgA',status:'active'}),
      ],
    });
    expect(rows).toHaveLength(0);
  });

  it('includes only the separately verified organization owner when canonical membership was never created', () => {
    const rows=collectTenantMemberDirectoryCandidates({
      organizationId:'orgA', canonical, legacy:[], ownerUid:'realOwner',
    });
    const owner=rows.find(r=>r.id==='realOwner');
    expect(owner?.data()).toMatchObject({organizationId:'orgA',organizationRole:'owner',status:'active'});
    expect(collectTenantMemberDirectoryCandidates({
      organizationId:'orgA', canonical:[snapshot('realOwner',{status:'inactive'})],
      legacy:[], ownerUid:'realOwner',
    })).toEqual([]);
  });
});


describe('verified membership for safe MusicScale profile writes', () => {
  const makeDb = (rows: Record<string, Record<string, unknown>>) => ({
    collection: (name: string) => {
      const ref = (path: string): any => ({
        doc: (id: string) => ref(`${path}/${id}`),
        collection: (child: string) => ref(`${path}/${child}`),
        get: async () => ({
          exists: Object.prototype.hasOwnProperty.call(rows, path),
          data: () => rows[path]
        })
      });
      return ref(name);
    },
  });

  it('allows an active canonical member and independently verified legacy member', async () => {
    const db = makeDb({
      'organizations/orgA/members/active': { status: 'active', organizationId: 'orgA' },
      'organization_members/old_orgA': { uid: 'old', organizationId: 'orgA', status: 'active' }
    });
    await expect(isVerifiedTenantMemberForMusicScaleWrite(db, 'orgA', 'active')).resolves.toBe(true);
    await expect(isVerifiedTenantMemberForMusicScaleWrite(db, 'orgA', 'old')).resolves.toBe(true);
  });

  it('denies revoked canonical membership even if legacy entry is active or target is verified owner', async () => {
    const db = makeDb({
      'organizations/orgA/members/revoked': { status: 'removed' },
      'organization_members/revoked_orgA': { uid: 'revoked', organizationId: 'orgA', status: 'active' }
    });
    await expect(isVerifiedTenantMemberForMusicScaleWrite(db, 'orgA', 'revoked', 'revoked')).resolves.toBe(false);
  });

  it('rejects inactive, cross-tenant or unbound legacy entries and unverified users', async () => {
    const db = makeDb({
      'organization_members/wrong_orgA': { uid: 'wrong', organizationId: 'orgB', status: 'active' },
      'organization_members/inactive_orgA': { uid: 'inactive', organizationId: 'orgA', status: 'inactive' },
      'organization_members/missing_orgA': { uid: 'missing', status: 'active' }
    });
    for (const uid of ['wrong', 'inactive', 'missing', 'unknown']) {
      await expect(isVerifiedTenantMemberForMusicScaleWrite(db, 'orgA', uid)).resolves.toBe(false);
    }
    await expect(isVerifiedTenantMemberForMusicScaleWrite(db, 'orgA', 'owner', 'owner')).resolves.toBe(true);
    await expect(isVerifiedTenantMemberForMusicScaleWrite(db, 'orgB', 'owner', 'owner')).resolves.toBe(true);
  });
});
