import { adminDb as db } from "../services/firebaseAdmin.js";

const clean=(v:any)=>typeof v==="string"&&v.trim()?v.trim():null;
async function main(){
 if(!db) throw new Error("Firebase Admin DB is not initialized.");
 let scanned=0,repaired=0,skippedMissing=0,skippedConflict=0,skippedInvalidRole=0;
 const orgSnap=await db.collection("organizations").get();
 for(const org of orgSnap.docs){
   const organizationId=org.id;
   const memberSnap=await org.ref.collection("members").get();
   for(const member of memberSnap.docs){
     scanned++; const uid=member.id; const canonical=member.data()||{};
     const projectionRef=org.ref.collection("musicscale_members").doc(uid);
     const [projection,user,...legacySnaps]=await Promise.all([
       projectionRef.get(), db.collection("users").doc(uid).get(),
       db.collection("organization_members").doc(`${uid}_${organizationId}`).get(),
       db.collection("organization_members").doc(`${organizationId}_${uid}`).get()
     ]);
     if(projection.exists && clean(projection.data()?.roleId)) continue;
     const canonicalRole=clean(canonical.roleId)||clean(canonical.internalRoleId);
     let legacyRole:string|null=null; let legacyData:any=null;
     for(const snap of legacySnaps){if(!snap.exists)continue;const d=snap.data()||{};const oid=clean(d.organizationId)||clean(d.organization_id);const mid=clean(d.uid)||clean(d.userId)||clean(d.user_id);if(oid===organizationId&&mid===uid){const rr=clean(d.roleId)||clean(d.internalRoleId);if(rr){legacyRole=rr;legacyData=d;break;}}}
     const ud=user.exists?user.data()||{}:{}; const userOrg=clean(ud.organizationId)||clean(ud.activeOrganizationId)||clean(ud.primaryOrganizationId);
     const userRole=userOrg===organizationId?(clean(ud.roleId)||clean(ud.internalRoleId)):null;
     // Canonical/nested membership is authoritative. A generic user role such as member/admin must not override it.
     const authoritative=canonicalRole||legacyRole;
     const candidate=authoritative||userRole;
     if(!candidate){skippedMissing++;continue;}
     if(canonicalRole&&legacyRole&&canonicalRole!==legacyRole){skippedConflict++;continue;}
     const roleDoc=await db.collection("roles").doc(candidate).get();
     if(!roleDoc.exists || clean(roleDoc.data()?.organizationId)!==organizationId){skippedInvalidRole++;continue;}
     const sourceData=canonicalRole?canonical:(legacyRole?legacyData:ud);
     const patch:any={uid,organizationId,roleId:candidate,updatedAt:new Date(),source:"global_role_recovery_2026_10_06"};
     for(const k of ["musicscaleRole","ministryFunction","specialtyIds"]){if(sourceData?.[k]!==undefined)patch[k]=sourceData[k];}
     await projectionRef.set(patch,{merge:true}); repaired++;
   }
 }
 console.log(JSON.stringify({scanned,repaired,skippedMissing,skippedConflict,skippedInvalidRole}));
}
main().catch(e=>{console.error(e);process.exit(1)});