import { adminDb, adminAuth, admin } from '../firebaseAdmin.js';

export const VALID_ECOSYSTEM_ROLES = [
  'ceo', 
  'global_admin', 
  'ecosystem_owner', 
  'founder'
];

export interface AuthenticatedEcosystemContext {
  uid: string;
  email?: string;
  systemRole: string | null;
  hasCurationAccess: boolean;
}

export async function validateEcosystemAuthToken(authHeader: string | undefined, dbInstance: any, authInstance: any): Promise<{ statusCode?: number, error?: string, safeCode?: string, diagnostic?: any, context?: AuthenticatedEcosystemContext }> {
    if (!dbInstance || !authInstance) {
      return { statusCode: 503, error: "SERVICE_UNAVAILABLE: Serviço de autorização temporariamente indisponível." };
    }

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return { statusCode: 401, error: "UNAUTHORIZED: Token ausente ou formato inválido." };
    }

    const token = authHeader.split(" ")[1];
    let decodedToken;
    try {
      decodedToken = await authInstance.verifyIdToken(token, true);
    } catch (e: any) {
      console.error("[ecosystemAuth] verifyIdToken failed:", e);
      return { statusCode: 401, error: "UNAUTHORIZED: Token inválido ou expirado." };
    }

    const uid = decodedToken.uid;
    const email = decodedToken.email;

    // Get real role from target source of truth in Firestore
    let userSnap;
    try {
        userSnap = await dbInstance.collection('users').doc(uid).get();
    } catch (err: any) {
        console.error("[ecosystemAuth] Db fetch failed (permission/network):", err.message);
        return { statusCode: 503, error: "Serviço temporariamente indisponível. Falha ao acessar a base de dados de autorização." };
    }
    
    if (!userSnap.exists) {
      return { statusCode: 403, error: "FORBIDDEN: Perfil não encontrado." };
    }

    const userData = userSnap.data() || {};
    
    const checkFieldStatus = (fieldVal: any) => {
        if (fieldVal === undefined || fieldVal === null) return "missing";
        const valStr = String(fieldVal).trim().toLowerCase();
        if (VALID_ECOSYSTEM_ROLES.includes(valStr)) {
            return `present_valid:${valStr}`;
        }
        return "present_invalid";
    };

    const sysRoleStatus = checkFieldStatus(userData?.systemRole);
    const ecoRoleStatus = checkFieldStatus(userData?.ecosystemRole);
    const glbRoleStatus = checkFieldStatus(userData?.globalRole);

    let finalValidRole: string | null = null;
    const rolesToTry = [userData?.systemRole, userData?.ecosystemRole, userData?.globalRole];
    for (const r of rolesToTry) {
        if (r) {
            const rNorm = String(r).trim().toLowerCase();
            if (VALID_ECOSYSTEM_ROLES.includes(rNorm)) {
                finalValidRole = rNorm;
                break;
            }
        }
    }

    if (!finalValidRole) {
      return { 
        statusCode: 403, 
        error: "FORBIDDEN: Acesso administrativo negado.",
        safeCode: "GLOBAL_ROLE_NOT_FOUND",
        diagnostic: {
            uidPresent: true,
            userDocFound: true,
            checkedPath: "users/{uid}",
            checkedFields: {
                systemRole: sysRoleStatus,
                ecosystemRole: ecoRoleStatus,
                globalRole: glbRoleStatus
            },
            acceptedRoles: VALID_ECOSYSTEM_ROLES,
            message: "O backend não encontrou um papel global canônico em users/{uid}."
        }
      };
    }

    return {
      context: {
        uid,
        email,
        systemRole: finalValidRole,
        hasCurationAccess: true
      } as AuthenticatedEcosystemContext
    };
}

/**
 * Validates the Bearer token, fetches the user from Firestore to get the real system role,
 * and sets the context. Never trusts roles sent by body, query or client.
 */
export async function requireEcosystemRole(req: any, res: any, next: any) {
  try {
    const result = await validateEcosystemAuthToken(req.headers.authorization, adminDb, adminAuth);
    
    if (result.error) {
      const responsePayload: any = { error: result.error };
      if (result.safeCode) responsePayload.safeCode = result.safeCode;
      if (result.diagnostic) responsePayload.diagnostic = result.diagnostic;
      return res.status(result.statusCode || 500).json(responsePayload);
    }

    req.ecosystemContext = result.context;
    next();
  } catch (err: any) {
    console.error("[ecosystemAuth] Error in requireEcosystemRole:", err);
    return res.status(500).json({ error: "INTERNAL_AUTHORIZATION_ERROR" });
  }
}
