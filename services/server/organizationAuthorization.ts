import { logger } from '../../lib/logger.js';

export interface AuthenticatedOrganizationContext {
  uid: string;
  email?: string;
  systemRole: string | null;
  organizationRole?: string | null;
  isActive: boolean;
  isOwner: boolean;
  capabilities: string[];
}

export async function resolveOrganizationAuthorization(
  authHeader: string | undefined,
  organizationId: string,
  dbInstance: any,
  authInstance: any
): Promise<{ statusCode?: number; error?: string; context?: AuthenticatedOrganizationContext }> {
  if (!dbInstance || !authInstance) {
    return { statusCode: 503, error: "SERVICE_UNAVAILABLE" };
  }

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { statusCode: 401, error: "UNAUTHORIZED" };
  }

  const token = authHeader.split("Bearer ")[1].trim();

  let decodedToken;
  try {
    decodedToken = await authInstance.verifyIdToken(token, true);
  } catch (err) {
    return { statusCode: 401, error: "UNAUTHORIZED" };
  }

  const { uid, email } = decodedToken;

  try {
    const userDoc = await dbInstance.collection('users').doc(uid).get();
    if (!userDoc.exists) {
      return { statusCode: 403, error: "FORBIDDEN" };
    }
    const userData = userDoc.data();

    const systemRoleRaw = userData?.systemRole;
    let systemRole = null;
    if (typeof systemRoleRaw === 'string') {
      const normalized = systemRoleRaw.trim().toLowerCase();
      if (['ceo', 'global_admin', 'ecosystem_owner', 'founder'].includes(normalized)) {
        systemRole = normalized;
      }
    }

    const orgDoc = await dbInstance.collection('organizations').doc(organizationId).get();
    if (!orgDoc.exists) {
      return { statusCode: 403, error: "FORBIDDEN" };
    }
    
    const orgData = orgDoc.data();
    const normalizedOrgStatus = String(orgData?.status || "").trim().toLowerCase();
    if (normalizedOrgStatus === 'archived' || orgData?.archived === true) {
      return { statusCode: 403, error: "FORBIDDEN" };
    }

    const isOwner = orgData?.ownerUid === uid || orgData?.ownerUserId === uid || orgData?.ownerId === uid;

    let isActive = false;
    let organizationRole = null;
    const capabilitiesSet = new Set<string>();

    const extractCapabilities = (data: any) => {
      const sources = ['capabilities', 'permissions', 'effectiveCapabilities'];
      const allowed = ['organization.settings.manage', 'organization.members.manage'];
      
      for (const src of sources) {
        if (data?.[src]) {
          if (Array.isArray(data[src])) {
            data[src].forEach((cap: any) => {
              const c = String(cap).trim();
              if (allowed.includes(c)) capabilitiesSet.add(c);
            });
          } else if (typeof data[src] === 'object') {
            Object.keys(data[src]).forEach(k => {
              if (data[src][k] === true && allowed.includes(k.trim())) {
                capabilitiesSet.add(k.trim());
              }
            });
          }
        }
      }
    };

    let roleIdToFetch = null;

    // 1. Check canonical membership
    const canonicalMemberRef = dbInstance.collection('organizations').doc(organizationId).collection('members').doc(uid);
    const canonicalMemberDoc = await canonicalMemberRef.get();

    if (canonicalMemberDoc.exists) {
      const memberData = canonicalMemberDoc.data();
      const status = (memberData?.status || '').trim().toLowerCase();
      if (status === 'active' || status === 'ativo') {
        isActive = true;
        organizationRole = (memberData?.organizationRole || memberData?.role || '').trim().toLowerCase() || null;
        extractCapabilities(memberData);
        roleIdToFetch = memberData?.roleId || memberData?.internalRoleId || null;
      }
    } else {
      // 2. Fallback to legacy
      const legacyRef1 = dbInstance.collection('organization_members').doc(`${uid}_${organizationId}`);
      const legacyDoc1 = await legacyRef1.get();
      let legacyData = null;

      if (legacyDoc1.exists) {
        legacyData = legacyDoc1.data();
      } else {
        const legacyRef2 = dbInstance.collection('organization_members').doc(`${organizationId}_${uid}`);
        const legacyDoc2 = await legacyRef2.get();
        if (legacyDoc2.exists) {
          legacyData = legacyDoc2.data();
        }
      }

      if (legacyData) {
        const status = (legacyData.status || '').trim().toLowerCase();
        if (status === 'active' || status === 'ativo') {
          isActive = true;
          organizationRole = (legacyData.organizationRole || legacyData.role || '').trim().toLowerCase() || null;
          extractCapabilities(legacyData);
          roleIdToFetch = legacyData.roleId || legacyData.internalRoleId || null;
        }
      }
    }

    if (isActive && roleIdToFetch) {
      try {
        const roleDoc = await dbInstance.collection('roles').doc(roleIdToFetch).get();
        if (roleDoc.exists) {
          const roleData = roleDoc.data();
          if (roleData?.organizationId === organizationId) {
            if (roleData?.permissions?.canManageUsers === true) {
              capabilitiesSet.add('organization.members.manage');
            }
          }
        }
      } catch (e) {
        logger.error(`[organizationAuthorization] Error fetching role ${roleIdToFetch}:`, e);
      }
    }

    // Implicit active for owners in legacy/fallback scenarios
    if (isOwner) {
       isActive = true;
    }

    // Default owner/admin capabilities if active
    if (isActive && (isOwner || organizationRole === 'admin' || organizationRole === 'owner')) {
       capabilitiesSet.add('organization.settings.manage');
       capabilitiesSet.add('organization.members.manage');
    }

    return {
      context: {
        uid,
        email,
        systemRole,
        organizationRole,
        isActive,
        isOwner,
        capabilities: Array.from(capabilitiesSet)
      }
    };
  } catch (err: any) {
    logger.error("[organizationAuthorization] Error resolving org auth:", err);
    return { statusCode: 503, error: "SERVICE_UNAVAILABLE" };
  }
}
