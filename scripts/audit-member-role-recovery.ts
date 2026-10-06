import { adminDb as db } from "../services/firebaseAdmin.js";
import { mkdir, writeFile } from "node:fs/promises";

type Hit = { organizationId:string; uid:string; projectionRoleId:string|null; canonicalRoleId:string|null; legacyRoleId:string|null; userRoleId:string|null; recoverableRoleId:string|null; source:string; conflict:boolean };

const clean=(v:any)=>typeof v==="string"&&v.trim()?v.trim():null;
async function main(){
 if(!db) throw new Error("Firebase Admin DB is not initialized.");
 const out:Hit[]=[]; let orgs=0,members=0,recoverable=0,missing=0,conflicts=0;
 const orgSnap=await db.collection("organizations").get();
 for(const org of orgSnap.docs){
   orgs++; const organizationId=org.id;
   const memberSnap=await org.ref.collection("members").get();
   for(const member of memberSnap.docs){
     members++; const uid=member.id; const canonical=member.data()||{};
     const [projection,user,...legacySnaps]=await Promise.all([
       org.ref.collection("musicscale_members").doc(uid).get(),
       db.collection("users").doc(uid).get(),
       db.collection("organization_members").doc(`${uid}_${organizationId}`).get(),
       db.collection("organization_members").doc(`${organizationId}_${uid}`).get()
     ]);
     const projectionRoleId=projection.exists?clean(projection.data()?.roleId)||clean(projection.data()?.internalRoleId):null;
     const canonicalRoleId=clean(canonical.roleId)||clean(canonical.internalRoleId);
     let legacyRoleId:string|null=null;
     for(const snap of legacySnaps){ if(!snap.exists) continue; const d=snap.data()||{}; const oid=clean(d.organizationId)||clean(d.organization_id); const mid=clean(d.uid)||clean(d.userId)||clean(d.user_id); if(oid===organizationId&&mid===uid){legacyRoleId=clean(d.roleId)||clean(d.internalRoleId); if(legacyRoleId) break;} }
     const userData=user.exists?user.data()||{}:{}; const userOrg=clean(userData.organizationId)||clean(userData.activeOrganizationId)||clean(userData.primaryOrganizationId);
     const userRoleId=userOrg===organizationId?(clean(userData.roleId)||clean(userData.internalRoleId)):null;
     const candidates=[projectionRoleId,canonicalRoleId,legacyRoleId,userRoleId].filter(Boolean) as string[];
     const unique=[...new Set(candidates)]; const conflict=unique.length>1;
     const recoverableRoleId=projectionRoleId||(!conflict?(canonicalRoleId||legacyRoleId||userRoleId):null);
     const source=projectionRoleId?"projection":canonicalRoleId?"canonical":legacyRoleId?"legacy":userRoleId?"user":"none";
     if(conflict) conflicts++; else if(!projectionRoleId&&recoverableRoleId) recoverable++; else if(!recoverableRoleId) missing++;
     if(!projectionRoleId||conflict) out.push({organizationId,uid,projectionRoleId,canonicalRoleId,legacyRoleId,userRoleId,recoverableRoleId,source,conflict});
   }
 }
 await mkdir("tmp/firestore-audit",{recursive:true});
 const summary={organizations:orgs,members,affected:out.length,recoverable,missing,conflicts,generatedAt:new Date().toISOString()};
 await writeFile("tmp/firestore-audit/member-role-recovery.summary.json",JSON.stringify(summary,null,2));
 await writeFile("tmp/firestore-audit/member-role-recovery.audit.json",JSON.stringify(out,null,2));
 console.log(JSON.stringify(summary));
}
main().catch(e=>{console.error(e);process.exit(1)});