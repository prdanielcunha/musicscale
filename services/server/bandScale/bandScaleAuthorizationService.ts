import { adminDb as db } from "../../firebaseAdmin.js";

export class BandScaleAuthorizationService {
  /**
   * Verifies if a user has scale management permissions in a given organization.
   * This handles owners, administrators, worship leaders, and leaders as per our RBAC.
   */
  static async checkCanManageScales(userId: string, orgId: string): Promise<boolean> {
    if (!db) {
      throw new Error("Banco de dados não inicializado.");
    }

    // 1. Check if the user exists and is a Global Administrator
    const userDocRef = db.collection("users").doc(userId);
    const userSnap = await userDocRef.get();

    if (!userSnap.exists) {
      return false;
    }

    const userData = userSnap.data() || {};
    
    // Global Admins bypass normal permissions
    if (userData.email === "pastordanielpcunha@gmail.com" || userData.email === "danielcunhapastor@gmail.com") {
      return true;
    }

    // 2. Check if the user belongs to the requested organization
    const belongsToOrg = 
      userData.organizationId === orgId ||
      userData.activeOrganizationId === orgId ||
      userData.primaryOrganizationId === orgId;

    if (!belongsToOrg) {
      return false;
    }

    // 3. Resolve user role in current organization
    let userRole = (userData.role || userData.organizationRole || "member").toLowerCase();

    // Check organization members subcollection for explicit roles/memberships
    const memberSnap1 = await db.collection("organization_members").doc(`${userId}_${orgId}`).get();
    const memberSnap2 = await db.collection("organization_members").doc(`${orgId}_${userId}`).get();

    if (memberSnap1.exists) {
      const mData = memberSnap1.data() || {};
      userRole = (mData.role || mData.organizationRole || userRole).toLowerCase();
    } else if (memberSnap2.exists) {
      const mData = memberSnap2.data() || {};
      userRole = (mData.role || mData.organizationRole || userRole).toLowerCase();
    }

    // 4. Verify organization owner
    const orgDoc = await db.collection("organizations").doc(orgId).get();
    if (orgDoc.exists) {
      const orgData = orgDoc.data() || {};
      if (orgData.ownerUid === userId || orgData.ownerUserId === userId) {
        return true;
      }
    }

    // 5. Match roles that have 'canManageScales' permission by default
    const allowedRoles = [
      "owner",
      "dono",
      "admin",
      "administrador",
      "worship_leader",
      "leader",
      "lider",
      "líder",
      "lider / ministro",
      "líder / ministro",
      "ministro",
      "pastor"
    ];

    if (allowedRoles.includes(userRole)) {
      return true;
    }

    return false;
  }
}
