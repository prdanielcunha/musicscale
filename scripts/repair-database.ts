import { adminDb as db } from "../services/firebaseAdmin.js";
import admin from "firebase-admin";

async function repair() {
  if (!db) {
    console.error("Firebase Admin DB is not initialized.");
    process.exit(1);
  }

  console.log("=== STARTING MUSICSCALE CANONICAL IDENTITY REPAIR ===");

  const ayessaEmail = "ayessacris@gmail.com";
  const obpcOrgId = "z4lw2OHc8TZIx0jLQTpZkjtWLT93";
  let ayessaUid = "Joe76ipuSlSg5XBixcgFobIfF243"; // From diagnosis

  // 1. Audit & Fix Ayessa Cristina
  console.log(`\n--- 1. Auditing user: ${ayessaEmail} ---`);
  const ayessaUserRef = db.collection("users").doc(ayessaUid);
  const ayessaUserSnap = await ayessaUserRef.get();

  if (ayessaUserSnap.exists) {
    const data = ayessaUserSnap.data() || {};
    const updates: any = {};
    if (data.systemRole !== "ceo") {
      updates.systemRole = "ceo";
      console.log(`Setting systemRole to 'ceo' for Ayessa Cristina (${ayessaUid}).`);
    }
    if (data.role !== "CEO") {
      updates.role = "CEO";
    }
    if (data.appRole !== "CEO") {
      updates.appRole = "CEO";
    }
    // Also, point her primary / active organization to Família OBPC
    if (data.primaryOrganizationId !== obpcOrgId) {
      updates.primaryOrganizationId = obpcOrgId;
      console.log(`Setting primaryOrganizationId to OBPC (${obpcOrgId}) for Ayessa.`);
    }
    if (data.activeOrganizationId !== obpcOrgId) {
      updates.activeOrganizationId = obpcOrgId;
      console.log(`Setting activeOrganizationId to OBPC (${obpcOrgId}) for Ayessa.`);
    }
    if (data.organizationId !== obpcOrgId) {
      updates.organizationId = obpcOrgId;
    }

    if (Object.keys(updates).length > 0) {
      await ayessaUserRef.update(updates);
      console.log("Ayessa user profile updated successfully.");
    } else {
      console.log("Ayessa user profile is already up to date.");
    }
  } else {
    console.log(`User profile for Ayessa (${ayessaUid}) does not exist. Creating...`);
    await ayessaUserRef.set({
      uid: ayessaUid,
      email: ayessaEmail,
      displayName: "Ayessa Cristina",
      systemRole: "ceo",
      role: "CEO",
      appRole: "CEO",
      primaryOrganizationId: obpcOrgId,
      activeOrganizationId: obpcOrgId,
      organizationId: obpcOrgId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  }

  // 2. Audit & Fix Organization Família OBPC
  console.log(`\n--- 2. Auditing Organization: ${obpcOrgId} ---`);
  const orgRef = db.collection("organizations").doc(obpcOrgId);
  const orgSnap = await orgRef.get();
  if (orgSnap.exists) {
    const data = orgSnap.data() || {};
    const updates: any = {};
    if (data.ownerUid !== ayessaUid) {
      updates.ownerUid = ayessaUid;
      console.log(`Setting ownerUid to Ayessa (${ayessaUid}) for OBPC.`);
    }
    if (data.ownerUserId !== ayessaUid) {
      updates.ownerUserId = ayessaUid;
      console.log(`Setting ownerUserId to Ayessa (${ayessaUid}) for OBPC.`);
    }
    if (data.ownerId !== ayessaUid) {
      updates.ownerId = ayessaUid;
    }
    if (data.owner_user_id !== ayessaUid) {
      updates.owner_user_id = ayessaUid;
    }
    if (Object.keys(updates).length > 0) {
      await orgRef.update(updates);
      console.log("OBPC organization updated successfully.");
    } else {
      console.log("OBPC organization is already up to date.");
    }
  } else {
    console.log(`Organization ${obpcOrgId} does not exist. Creating...`);
    await orgRef.set({
      name: "Organização de Família OBPC",
      ownerUid: ayessaUid,
      ownerUserId: ayessaUid,
      ownerId: ayessaUid,
      status: "active",
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
  }

  // 3. Ensure Ayessa is an OWNER in OBPC Organization Members Subcollection
  console.log(`\n--- 3. Auditing Subcollection Membership: organizations/${obpcOrgId}/members/${ayessaUid} ---`);
  const subMemberRef = db.collection("organizations").doc(obpcOrgId).collection("members").doc(ayessaUid);
  const subMemberSnap = await subMemberRef.get();
  const targetMemberData = {
    uid: ayessaUid,
    userId: ayessaUid,
    email: ayessaEmail,
    displayName: "Ayessa Cristina",
    role: "owner",
    organizationRole: "owner",
    musicscaleRole: "owner",
    status: "active",
    joinedAt: admin.firestore.FieldValue.serverTimestamp()
  };

  if (!subMemberSnap.exists) {
    await subMemberRef.set(targetMemberData);
    console.log("Created subcollection member document as owner.");
  } else {
    const data = subMemberSnap.data() || {};
    if (data.role !== "owner" || data.organizationRole !== "owner" || data.musicscaleRole !== "owner") {
      await subMemberRef.update({
        role: "owner",
        organizationRole: "owner",
        musicscaleRole: "owner"
      });
      console.log("Updated subcollection member role to 'owner'.");
    } else {
      console.log("Subcollection membership is correct.");
    }
  }

  // 4. Ensure Ayessa is an OWNER in Global organization_members collection
  console.log(`\n--- 4. Auditing Global Membership: organization_members/${ayessaUid}_${obpcOrgId} ---`);
  const globalMemberRef = db.collection("organization_members").doc(`${ayessaUid}_${obpcOrgId}`);
  const globalMemberSnap = await globalMemberRef.get();
  
  if (!globalMemberSnap.exists) {
    await globalMemberRef.set({
      uid: ayessaUid,
      userId: ayessaUid,
      email: ayessaEmail,
      displayName: "Ayessa Cristina",
      organizationId: obpcOrgId,
      role: "owner",
      organizationRole: "owner",
      musicscaleRole: "owner",
      status: "active",
      joinedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log("Created global organization_members document as owner.");
  } else {
    const data = globalMemberSnap.data() || {};
    if (data.role !== "owner" || data.organizationRole !== "owner" || data.musicscaleRole !== "owner") {
      await globalMemberRef.update({
        role: "owner",
        organizationRole: "owner",
        musicscaleRole: "owner"
      });
      console.log("Updated global organization_members role to 'owner'.");
    } else {
      console.log("Global organization_members is correct.");
    }
  }

  // 5. Audit all users and align their organization_members roles
  console.log("\n--- 5. Auditing all users organization memberships ---");
  const usersSnap = await db.collection("users").get();
  for (const userDoc of usersSnap.docs) {
    const userData = userDoc.data();
    const uid = userDoc.id;
    const orgId = userData.organizationId || userData.activeOrganizationId || userData.primaryOrganizationId;
    if (orgId) {
      // If the user's role/systemRole is global admin or CEO, make sure they are owner/admin
      const sysRole = (userData.systemRole || "").toLowerCase();
      if (sysRole === "ceo" || sysRole === "admin" || sysRole === "global_admin") {
        console.log(`Checking membership for global privileged user ${userData.email} (${uid}) in org ${orgId}`);
        const mRef = db.collection("organization_members").doc(`${uid}_${orgId}`);
        const mSnap = await mRef.get();
        if (!mSnap.exists) {
          await mRef.set({
            uid,
            userId: uid,
            email: userData.email || "",
            displayName: userData.displayName || "",
            organizationId: orgId,
            role: "owner",
            organizationRole: "owner",
            musicscaleRole: "owner",
            status: "active",
            joinedAt: admin.firestore.FieldValue.serverTimestamp()
          });
          console.log(`Added missing membership for global privileged user ${userData.email}.`);
        } else {
          const mData = mSnap.data() || {};
          if (mData.role !== "owner" && mData.role !== "admin") {
            await mRef.update({
              role: "owner",
              organizationRole: "owner",
              musicscaleRole: "owner"
            });
            console.log(`Updated membership for global privileged user ${userData.email} to 'owner'.`);
          }
        }
      }
    }
  }

  console.log("\n=== MUSICSCALE REPAIR COMPLETED SUCCESSFULLY ===");
}

repair().catch((err) => {
  console.error("Repair failed:", err);
  process.exit(1);
});
