import { describe, expect, it } from 'vitest';
import { BandScaleAuthorizationService } from '../../services/server/bandScale/bandScaleAuthorizationService.js';

function fakeFirestore(records: Record<string,any>) {
  const ref = (path: string): any => ({
    doc: (id: string) => ref(path+'/'+id),
    collection: (id: string) => ref(path+'/'+id),
    get: async()=>({exists:Object.hasOwn(records,path),data:()=>records[path]}),
  });
  return {collection:(name:string)=>ref(name)};
}
const org={status:'active',ownerUid:'someOwner'};
const user={organizationId:'otherOrg',role:'member'};
const check=(records:Record<string,any>)=>
  BandScaleAuthorizationService.checkCanManageScales('userA','orgA',fakeFirestore(records) as any);

describe('canonical scale management RBAC',()=>{
  it('authorizes an active canonical worship leader from a secondary organization',async()=>{
    expect(await check({
      'users/userA':user,'organizations/orgA':org,
      'organizations/orgA/members/userA':{organizationId:'orgA',status:'active',role:'worship_leader'},
    })).toBe(true);
  });
  it('never imports a global profile member role over the Hub tenant-specific role',async()=>{
    expect(await check({
      'users/userA':{...user,role:'admin'},'organizations/orgA':org,
      'organizations/orgA/members/userA':{organizationId:'orgA',status:'active',role:'member'},
    })).toBe(false);
  });
  it('blocks inactive canonical membership even when user profile says admin in the same org',async()=>{
    expect(await check({
      'users/userA':{role:'admin',organizationId:'orgA'},'organizations/orgA':org,
      'organizations/orgA/members/userA':{organizationId:'orgA',status:'removed',role:'admin'},
    })).toBe(false);
  });
  it('allows a tenant owner without changing primary user organization',async()=>{
    expect(await check({
      'users/userA':user,'organizations/orgA':{...org,ownerUid:'userA'},
    })).toBe(true);
  });
  it('rejects a cross-tenant canonical payload despite a manager role',async()=>{
    expect(await check({
      'users/userA':user,'organizations/orgA':org,
      'organizations/orgA/members/userA':{organizationId:'anotherOrg',status:'active',role:'admin'},
    })).toBe(false);
  });
  it('accepts active legacy member only when uid and tenant match',async()=>{
    expect(await check({
      'users/userA':user,'organizations/orgA':org,
      'organization_members/userA_orgA':{uid:'userA',organizationId:'orgA',status:'active',organizationRole:'leader'},
    })).toBe(true);
  });
  it('never accepts a disabled legacy member or missing tenant',async()=>{
    expect(await check({
      'users/userA':{...user,role:'admin',organizationId:'orgA'},'organizations/orgA':org,
      'organization_members/userA_orgA':{uid:'userA',organizationId:'orgA',status:'inactive',role:'admin'},
    })).toBe(false);
    expect(await check({'users/userA':user})).toBe(false);
  });
  it('keeps legacy exact-org manager eligibility and rejects cross-org roles',async()=>{
    expect(await check({
      'users/userA':{organizationId:'orgA',role:'leader'},'organizations/orgA':org,
    })).toBe(true);
    expect(await check({
      'users/userA':{organizationId:'unrelated',role:'leader'},'organizations/orgA':org,
    })).toBe(false);
  });
});
