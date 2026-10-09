import { describe, expect, it } from 'vitest';
import { collectTenantMemberDirectoryCandidates } from '../../services/server/memberDirectoryCandidates.js';

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
