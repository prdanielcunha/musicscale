import { describe, expect, it } from 'vitest';
import { validateBandScaleAssignedUsers } from '../../services/server/bandScale/assignmentMembershipValidator.js';

function dbWith(records: Record<string,any>) {
  const ref = (path: string): any => ({
    path,
    doc: (id: string) => ref(path + '/' + id),
    collection: (name: string) => ref(path + '/' + name),
    get: async () => ({
      exists: Object.prototype.hasOwnProperty.call(records,path),
      data: () => records[path],
    }),
  });
  return { collection: (name: string) => ref(name) };
}
const user={displayName:'Demo Member',organizationId:'otherOrg'};
const member={status:'active',organizationId:'orgA',organizationRole:'member'};
describe('fixed-band assignment membership: canonical Hub data',()=>{
  it('accepts an active canonical member even when user primary org is elsewhere',async()=>{
    const db=dbWith({
      'users/userA':user,
      'organizations/orgA/members/userA':member,
    });
    await expect(validateBandScaleAssignedUsers(db,['userA'],'orgA')).resolves.toBeUndefined();
  });
  it('denies a removed member even if old user profile points to the same tenant',async()=>{
    const db=dbWith({
      'users/userA':{organizationId:'orgA'},
      'organizations/orgA/members/userA':{...member,status:'removed'},
    });
    await expect(validateBandScaleAssignedUsers(db,['userA'],'orgA')).rejects.toThrow(/associação ativa/);
  });
  it('never accepts a canonical record whose organizationId points elsewhere',async()=>{
    const db=dbWith({
      'users/userA':user,
      'organizations/orgA/members/userA':{...member,organizationId:'otherOrg'},
    });
    await expect(validateBandScaleAssignedUsers(db,['userA'],'orgA')).rejects.toThrow(/associação ativa/);
  });
  it('allows a strictly tenant-bound active historical member',async()=>{
    const db=dbWith({
      'users/userA':user,
      'organization_members/userA_orgA':{status:'active',organizationId:'orgA',uid:'userA'},
    });
    await expect(validateBandScaleAssignedUsers(db,['userA'],'orgA')).resolves.toBeUndefined();
  });
  it('denies inactive legacy membership even when a user profile looks valid',async()=>{
    const db=dbWith({
      'users/userA':{organizationId:'orgA'},
      'organization_members/userA_orgA':{status:'inactive',organizationId:'orgA',uid:'userA'},
    });
    await expect(validateBandScaleAssignedUsers(db,['userA'],'orgA')).rejects.toThrow(/associação ativa/);
  });
  it('maintains the old exact-org fallback when no membership was ever migrated',async()=>{
    const db=dbWith({'users/userA':{organizationId:'orgA',status:'active'}});
    await expect(validateBandScaleAssignedUsers(db,['userA'],'orgA')).resolves.toBeUndefined();
  });
  it('never uses a mutable activeOrganizationId to authorize an assignment',async()=>{
    const db=dbWith({'users/userA':{organizationId:'otherOrg',activeOrganizationId:'orgA'}});
    await expect(validateBandScaleAssignedUsers(db,['userA'],'orgA')).rejects.toThrow(/não pertence/);
  });
  it('allows an owner whose role is proved by the tenant document despite missing membership materialization',async()=>{
    const db=dbWith({
      'users/ownerA':{displayName:'Owner',organizationId:'differentOrg'},
      'organizations/orgA':{ownerUid:'ownerA',status:'active'},
    });
    await expect(validateBandScaleAssignedUsers(db,['ownerA'],'orgA')).resolves.toBeUndefined();
  });
  it('does not use a user-provided owner role to assign a different organization member',async()=>{
    const db=dbWith({
      'users/foreign':{organizationId:'otherOrg',role:'owner'},
      'organizations/orgA':{ownerUid:'actualOwner',status:'active'},
    });
    await expect(validateBandScaleAssignedUsers(db,['foreign'],'orgA')).rejects.toThrow(/não pertence/);
  });
  it('keeps explicitly removed canonical membership blocked even for the tenant owner',async()=>{
    const db=dbWith({
      'users/ownerA':{organizationId:'otherOrg'},
      'organizations/orgA':{ownerUid:'ownerA',status:'active'},
      'organizations/orgA/members/ownerA':{status:'removed',organizationId:'orgA'},
    });
    await expect(validateBandScaleAssignedUsers(db,['ownerA'],'orgA')).rejects.toThrow(/associação ativa/);
  });
  it('does not authorize a missing owner membership against an archived organization',async()=>{
    const db=dbWith({
      'users/ownerA':{organizationId:'otherOrg'},
      'organizations/orgA':{ownerUid:'ownerA',status:'archived'},
    });
    await expect(validateBandScaleAssignedUsers(db,['ownerA'],'orgA')).rejects.toThrow(/não pertence/);
  });
  it('rejects missing or disabled users, malformed IDs and an absent DB',async()=>{
    await expect(validateBandScaleAssignedUsers(dbWith({}),['userA'],'orgA')).rejects.toThrow(/não encontrado/);
    await expect(validateBandScaleAssignedUsers(dbWith({'users/userA':{disabled:true}}),['userA'],'orgA')).rejects.toThrow(/desativado/);
    await expect(validateBandScaleAssignedUsers(dbWith({}),['../foreign'],'orgA')).rejects.toThrow(/inválido/);
    await expect(validateBandScaleAssignedUsers(null,['userA'],'orgA')).rejects.toThrow(/não disponível/);
  });
});
