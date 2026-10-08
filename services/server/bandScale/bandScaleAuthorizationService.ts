import { adminDb as db } from "../../firebaseAdmin.js";

const ACTIVE = new Set(["active", "ativo"]);
const ALLOWED_MANAGERS = new Set([
  "owner", "dono", "admin", "administrador", "worship_leader",
  "leader", "lider", "líder", "lider / ministro", "líder / ministro",
  "ministro", "pastor"
]);
const validId = (value: string) => /^[A-Za-z0-9_-]{1,128}$/.test(value);

function isActive(data: any) {
  return ACTIVE.has(String(data?.status || "").trim().toLowerCase())
    && data?.disabled !== true && data?.removed !== true;
}
function matchesMember(data: any, userId: string, orgId: string) {
  const uid = data?.uid || data?.userId || data?.user_id;
  const org = data?.organizationId || data?.organization_id;
  return uid === userId && org === orgId;
}

export class BandScaleAuthorizationService {
  /**
   * The Hub's canonical organization membership is the source of truth.
   * A user may belong to multiple organizations independently of
   * users.organizationId, which is a legacy navigation/profile field.
   */
  static async checkCanManageScales(
    userId: string, orgId: string, dbInstance: any = db,
  ): Promise<boolean> {
    if (!dbInstance) throw new Error("Banco de dados não inicializado.");
    if (!validId(userId) || !validId(orgId)) return false;

    const [userSnap, orgSnap] = await Promise.all([
      dbInstance.collection("users").doc(userId).get(),
      dbInstance.collection("organizations").doc(orgId).get(),
    ]);
    if (!userSnap.exists || !orgSnap.exists) return false;

    const userData = userSnap.data() || {};
    const orgData = orgSnap.data() || {};
    if (userData.disabled === true || orgData.disabled === true ||
        ["disabled", "suspended", "archived"].includes(
          String(orgData.status || "").trim().toLowerCase())) return false;

    // Preserve existing ecosystem administrative access without changing
    // the role model of paying customers in this compatibility patch.
    if (userData.email === "pastordanielpcunha@gmail.com" ||
        userData.email === "danielcunhapastor@gmail.com") return true;

    if (orgData.ownerUid === userId || orgData.ownerUserId === userId ||
        orgData.ownerId === userId) return true;

    let role = "";
    const canonical = await dbInstance.collection("organizations").doc(orgId)
      .collection("members").doc(userId).get();

    if (canonical.exists) {
      const m = canonical.data() || {};
      if ((m.organizationId && m.organizationId !== orgId) || !isActive(m))
        return false;
      role = String(m.organizationRole || m.role || "member").trim().toLowerCase();
    } else {
      const [legacy1, legacy2] = await Promise.all([
        dbInstance.collection("organization_members").doc(userId + "_" + orgId).get(),
        dbInstance.collection("organization_members").doc(orgId + "_" + userId).get(),
      ]);
      const legacy = [legacy1, legacy2].find(s =>
        s.exists && matchesMember(s.data(), userId, orgId));
      if (legacy) {
        const m = legacy.data() || {};
        if (!isActive(m)) return false;
        role = String(m.organizationRole || m.role ||
          userData.organizationRole || userData.role || "member").trim().toLowerCase();
      } else {
        // Retain the historical single-org authorization only while a
        // migrated membership is absent. Never override an explicit removal.
        const belongs = userData.organizationId === orgId ||
          userData.activeOrganizationId === orgId ||
          userData.primaryOrganizationId === orgId;
        if (!belongs) return false;
        role = String(userData.organizationRole || userData.role || "member")
          .trim().toLowerCase();
      }
    }
    return ALLOWED_MANAGERS.has(role);
  }
}
