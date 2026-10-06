import { adminDb as db } from "../services/firebaseAdmin.js";
import { mkdir, writeFile } from "node:fs/promises";

type Hit = {
  organizationId:string;
  uid:string;
  projectionRoleId:string|null;
  canonicalRoleId:string|null;
  legacyRoleId:string|null;
  userRoleId:string|null;
  recoverableRoleId:string|null;
  source:string;
  conflict:boolean;
  legacyUserBound:boolean;
  recoverableProfileFields:string[];
};

const clean=(v:any)=>typeof v==="string"&&v.trim()?v.trim():null;
const hasOwn=(v:any,key:string)=>Boolean(v&&Object.prototype.hasOwnProperty.call(v,key));
const hasString=(v:any)=>Boolean(clean(v));
const hasArray=(v:any)=>Array.isArray(v);

async function main(){
 if(!db) throw new Error("Firebase Admin DB is not initialized.");
 const out:Hit[]=[];
 let orgs=0,members=0,recoverable=0,profileRecoverable=0,missing=0,conflicts=0;
 const orgSnap=await db.collection("organizations").get();

 for(const org of orgSnap.docs){
   orgs++;
   const organizationId=org.id;
   const memberSnap=await org.ref.collection("members").get();

   for(const member of memberSnap.docs){
     members++;
     const uid=member.id;
     const canonical=member.data()||{};
     const [projection,user,...legacySnaps]=await Promise.all([
       org.ref.collection("musicscale_members").doc(uid).get(),
       db.collection("users").doc(uid).get(),
       db.collection("organization_members").doc(`${uid}_${organizationId}`).get(),
       db.collection("organization_members").doc(`${organizationId}_${uid}`).get()
     ]);

     const projectionData=projection.exists?projection.data()||{}:{};
     const projectionRoleId=clean(projectionData.roleId)||clean(projectionData.internalRoleId);
     const canonicalRoleId=clean(canonical.roleId)||clean(canonical.internalRoleId);

     let legacyRoleId:string|null=null;
     let legacyData:any={};
     for(const snap of legacySnaps){
       if(!snap.exists) continue;
       const d=snap.data()||{};
       const oid=clean(d.organizationId)||clean(d.organization_id);
       const mid=clean(d.uid)||clean(d.userId)||clean(d.user_id);
       if(oid===organizationId&&mid===uid){
         legacyData=d;
         legacyRoleId=clean(d.roleId)||clean(d.internalRoleId);
         break;
       }
     }

     const userData=user.exists?user.data()||{}:{};
     // Match the historical tenant query exactly. active/primary org is mutable
     // navigation state and is not proof that legacy MusicScale fields belong here.
     const legacyUserBound=clean(userData.organizationId)===organizationId;
     const boundUserData=legacyUserBound?userData:{};
     const userRoleId=legacyUserBound?(clean(userData.roleId)||clean(userData.internalRoleId)):null;

     const candidates=[projectionRoleId,canonicalRoleId,legacyRoleId,userRoleId].filter(Boolean) as string[];
     const unique=[...new Set(candidates)];
     const conflict=unique.length>1;
     const recoverableRoleId=projectionRoleId||(!conflict?(canonicalRoleId||legacyRoleId||userRoleId):null);
     const source=projectionRoleId?"projection":canonicalRoleId?"canonical":legacyRoleId?"legacy":userRoleId?"user":"none";

     const recoverableProfileFields:string[]=[];
     if(!hasString(projectionData.musicscaleRole)){
       if(
         hasString(canonical.musicscaleRole) ||
         hasString(legacyData.musicscaleRole) ||
         hasString(boundUserData.musicscaleRole) ||
         hasString(boundUserData.role)
       ) recoverableProfileFields.push("musicscaleRole");
     }
     if(!hasOwn(projectionData,"ministryFunction")){
       if(
         hasOwn(canonical,"ministryFunction") ||
         hasOwn(legacyData,"ministryFunction") ||
         hasOwn(boundUserData,"ministryFunction")
       ) recoverableProfileFields.push("ministryFunction");
     }
     if(!hasOwn(projectionData,"specialtyIds")){
       if(
         hasArray(canonical.specialtyIds) ||
         hasArray(legacyData.specialtyIds) ||
         hasArray(boundUserData.specialtyIds)
       ) recoverableProfileFields.push("specialtyIds");
     }

     if(conflict) conflicts++;
     else if(!projectionRoleId&&recoverableRoleId) recoverable++;
     else if(!recoverableRoleId) missing++;

     if(recoverableProfileFields.length>0) profileRecoverable++;

     if(!projectionRoleId||conflict||recoverableProfileFields.length>0){
       out.push({
         organizationId,uid,projectionRoleId,canonicalRoleId,legacyRoleId,userRoleId,
         recoverableRoleId,source,conflict,legacyUserBound,recoverableProfileFields
       });
     }
   }
 }

 await mkdir("tmp/firestore-audit",{recursive:true});
 const summary={
   organizations:orgs,
   members,
   affected:out.length,
   recoverable,
   profileRecoverable,
   missing,
   conflicts,
   generatedAt:new Date().toISOString()
 };
 await writeFile("tmp/firestore-audit/member-role-recovery.summary.json",JSON.stringify(summary,null,2));
 await writeFile("tmp/firestore-audit/member-role-recovery.audit.json",JSON.stringify(out,null,2));
 console.log(JSON.stringify(summary));
}

main().catch(e=>{console.error(e);process.exit(1)});
