/** Production-safe inventory. READ ONLY. No organization/user identifiers in logs or artifacts.
 * Results are aggregate counts, not a permission to restore or delete records.
 */
import { adminDb as db } from '../services/firebaseAdmin.js';
const MAX_ORGANIZATIONS=500,MAX_MEMBERS=5000,MAX_ROLES=3000,MAX_BANDS=3000;
const clean=(v:unknown)=>typeof v==='string'&&v.trim()?v.trim():null;
const id=(d:any)=>clean(d?.roleId)||clean(d?.internalRoleId);
async function main(){
  if(!db)throw Error('FIRESTORE_UNAVAILABLE');
  const [orgs,roles,fixed,scheduled]=await Promise.all([
    db.collection('organizations').limit(MAX_ORGANIZATIONS+1).get(),
    db.collection('roles').limit(MAX_ROLES+1).get(),
    db.collectionGroup('fixedBandScales').limit(MAX_BANDS+1).get(),
    db.collectionGroup('bandScales').limit(MAX_BANDS+1).get(),
  ]);
  if(orgs.size>MAX_ORGANIZATIONS||roles.size>MAX_ROLES||
     fixed.size>MAX_BANDS||scheduled.size>MAX_BANDS)
    throw Error('AUDIT_LIMIT_REACHED__INCOMPLETE__NO_RECOVERY_ALLOWED');
  const roleOwners=new Map(roles.docs.map(x=>[x.id,clean(x.data()?.organizationId)]));
  const result={
    organizations:orgs.size,membersScanned:0,canonicalActiveMembers:0,
    projectedRolePresent:0,projectedRoleTenantValid:0,
    projectionAbsentOrNoRole:0,recoverableRoleByCanonicalOrLegacy:0,
    recoverableOnlyFromBoundUser:0,unresolvedMissingRole:0,
    roleConflict:0,roleReferencesOtherTenantOrAbsent:0,
    fixedBandDocuments:fixed.size,fixedBandsWithAssignments:0,
    fixedBandsWithoutOrganizationId:0,
    eventBandDocuments:scheduled.size,
    eventBandsWithoutOrganizationId:0,
    generatedAt:new Date().toISOString(),
    containsIdentifiers:false,readOnly:true,
  };
  for(const doc of fixed.docs){
    const data=doc.data()||{};
    if(Array.isArray(data.assignments)&&data.assignments.length>0)
      result.fixedBandsWithAssignments++;
    if(!clean(data.organizationId))result.fixedBandsWithoutOrganizationId++;
  }
  for(const doc of scheduled.docs){
    if(!clean(doc.data()?.organizationId))result.eventBandsWithoutOrganizationId++;
  }
  for(const org of orgs.docs){
    const members=await org.ref.collection('members').get();
    result.membersScanned+=members.size;
    if(result.membersScanned>MAX_MEMBERS)
      throw Error('MEMBER_AUDIT_LIMIT_REACHED__INCOMPLETE__NO_RECOVERY_ALLOWED');
    for(const member of members.docs){
      const data=member.data()||{},orgId=org.id,uid=member.id;
      if(['active','ativo'].includes(String(data.status||'').toLowerCase()))
        result.canonicalActiveMembers++;
      const projection=await org.ref.collection('musicscale_members').doc(uid).get();
      const projected=id(projection.exists?projection.data():null);
      if(projected){
        result.projectedRolePresent++;
        if(roleOwners.get(projected)===orgId)result.projectedRoleTenantValid++;
        else result.roleReferencesOtherTenantOrAbsent++;
        continue;
      }
      result.projectionAbsentOrNoRole++;
      const [legacy1,legacy2,user]=await Promise.all([
        db.collection('organization_members').doc(uid+'_'+orgId).get(),
        db.collection('organization_members').doc(orgId+'_'+uid).get(),
        db.collection('users').doc(uid).get(),
      ]);
      const legacy=[legacy1,legacy2].find(s=>{
        if(!s.exists)return false;
        const d=s.data()||{};
        return (clean(d.organizationId)||clean(d.organization_id))===orgId &&
          (clean(d.uid)||clean(d.userId)||clean(d.user_id))===uid;
      });
      const userData=user.exists?user.data()||{}:{};
      // Active/primary org are mutable navigation state, NOT proof of ownership.
      const userRole=clean(userData.organizationId)===orgId?id(userData):null;
      const candidates=[id(data),id(legacy?.data()),userRole].filter(Boolean) as string[];
      const unique=[...new Set(candidates)];
      if(unique.length>1){result.roleConflict++;continue;}
      const candidate=unique[0];
      if(!candidate){result.unresolvedMissingRole++;continue;}
      if(roleOwners.get(candidate)!==orgId){
        result.roleReferencesOtherTenantOrAbsent++;continue;
      }
      if(id(data)||id(legacy?.data()))result.recoverableRoleByCanonicalOrLegacy++;
      else result.recoverableOnlyFromBoundUser++;
    }
  }
  // This line is deliberately the ONLY output. Never upload member/tenant details.
  console.log('MUSICSCALE_AGGREGATE_READ_ONLY_AUDIT='+JSON.stringify(result));
}
main().catch(e=>{console.error('MUSICSCALE_AUDIT_FAILED',e instanceof Error?e.message:'UNKNOWN');process.exitCode=1;});
