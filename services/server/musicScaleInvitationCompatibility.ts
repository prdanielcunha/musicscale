import crypto from 'crypto';
import { resolveOrganizationAuthorization } from './organizationAuthorization.js';
import {
  HubInvitationAdapter,
  HubInvitationError,
  abandonRoleIntent,
  applyRoleIntent,
  decodeLegacyNestedToken,
  finishRoleIntent,
  normalizeEmail,
  permitsLegacyInvitationFallback,
  prepareRoleIntent
} from './hubInvitationAdapter.js';

const VALID_ID = /^[A-Za-z0-9_-]{1,128}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const FORBIDDEN_ROLE_NAMES = new Set([
  'owner', 'dono', 'ceo', 'global_admin', 'ecosystem_owner', 'founder', 'support', 'suporte'
]);

export class InvitationCompatibilityError extends Error {
  constructor(public status: number, public reasonCode: string) {
    super(reasonCode);
  }
}

export interface InvitationPrincipal {
  uid: string;
  email: string;
  bearer: string;
}

export interface InvitationCompatibilityDependencies {
  db: any;
  auth: any;
  admin: any;
  logger?: { error?: (...args: any[]) => void };
  hubFactory?: () => { create: HubInvitationAdapter['create']; accept: HubInvitationAdapter['accept'] };
  resolveAuthorization?: typeof resolveOrganizationAuthorization;
  now?: () => Date;
  randomUUID?: () => string;
}

function isValidId(value: unknown): value is string {
  return typeof value === 'string' && VALID_ID.test(value);
}

function isValidEmail(value: unknown): value is string {
  return typeof value === 'string' && EMAIL_RE.test(value);
}

function safeRoleName(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

function deriveMusicscaleRole(roleName: string): string {
  const name = (roleName || '').toLowerCase();
  if (name.includes('administrador') || name.includes('admin')) return 'admin';
  if (name.includes('líder') || name.includes('lider') || name.includes('ministro')) return 'leader';
  if (name.includes('músico') || name.includes('musico') || name.includes('vocal')) return 'musician';
  if (name.includes('visitante') || name.includes('viewer')) return 'viewer';
  return 'custom';
}

function asDate(value: any): Date | null {
  if (value instanceof Date) return value;
  if (value && typeof value.toDate === 'function') {
    const date = value.toDate();
    return date instanceof Date ? date : null;
  }
  return null;
}

function timingSafeStringEqual(left: unknown, right: unknown): boolean {
  try {
    const a = Buffer.from(String(left ?? ''), 'utf8');
    const b = Buffer.from(String(right ?? ''), 'utf8');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function mapKnownError(error: any): { status: number; reasonCode: string } | null {
  if (error instanceof InvitationCompatibilityError) {
    return { status: error.status, reasonCode: error.reasonCode };
  }
  if (error instanceof HubInvitationError) {
    return { status: error.status, reasonCode: error.reasonCode };
  }
  const reasonCode = String(error?.message || '');
  if (['EMAIL_REQUIRED', 'EMAIL_MISMATCH', 'USER_NOT_FOUND', 'ROLE_ORGANIZATION_MISMATCH', 'CANNOT_ACCEPT_GLOBAL_OR_OWNER'].includes(reasonCode)) {
    return { status: 403, reasonCode };
  }
  if (reasonCode === 'ROLE_NOT_FOUND') return { status: 404, reasonCode };
  if (reasonCode === 'INVITE_ALREADY_CONSUMED') return { status: 409, reasonCode };
  if (['INVALID_TOKEN', 'INVITE_NOT_FOUND', 'INVALID_INVITE_ORG', 'TOKEN_EXPIRED', 'INVALID_ORG', 'INVITE_NOT_PENDING'].includes(reasonCode)) {
    return { status: 400, reasonCode };
  }
  return null;
}

export async function resolveAuthenticatedInvitationPrincipal(auth: any, authHeader: unknown): Promise<InvitationPrincipal> {
  if (typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
    throw new InvitationCompatibilityError(401, 'UNAUTHORIZED');
  }
  const idToken = authHeader.slice('Bearer '.length).trim();
  if (!idToken) throw new InvitationCompatibilityError(401, 'UNAUTHORIZED');

  let decoded: any;
  try {
    decoded = await auth.verifyIdToken(idToken, true);
  } catch {
    throw new InvitationCompatibilityError(401, 'UNAUTHORIZED');
  }

  const uid = String(decoded?.uid || '').trim();
  if (!VALID_ID.test(uid)) throw new InvitationCompatibilityError(401, 'UNAUTHORIZED');

  let userRecord: any;
  try {
    userRecord = await auth.getUser(uid);
  } catch {
    throw new InvitationCompatibilityError(503, 'AUTHENTICATED_USER_UNAVAILABLE');
  }

  const email = normalizeEmail(userRecord?.email);
  if (!isValidEmail(email)) {
    throw new InvitationCompatibilityError(403, 'AUTHENTICATED_EMAIL_REQUIRED');
  }

  return { uid, email, bearer: authHeader };
}

export async function acceptLegacyInvitation(
  deps: InvitationCompatibilityDependencies,
  principal: InvitationPrincipal,
  token: string
): Promise<{ success: true; organization_id: string }> {
  const { db, admin } = deps;
  const now = deps.now || (() => new Date());
  const randomUUID = deps.randomUUID || crypto.randomUUID;
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  let inviteSnapshot = await db.collection('invites').where('tokenHash', '==', tokenHash).limit(1).get();
  if (inviteSnapshot.empty) {
    inviteSnapshot = await db.collection('invites').where('token', '==', token).limit(1).get();
  }

  let isNestedLegacy = false;
  let nestedIdentity: { organizationId: string; inviteId: string } | null = null;
  let initialInviteDoc: any = inviteSnapshot.empty ? null : inviteSnapshot.docs[0];

  if (!initialInviteDoc) {
    nestedIdentity = decodeLegacyNestedToken(token);
    if (nestedIdentity) {
      const candidate = await db.collection('organizations').doc(nestedIdentity.organizationId)
        .collection('invites').doc(nestedIdentity.inviteId).get();
      const candidateData = candidate.exists ? candidate.data() : null;
      const boundOrg = candidateData?.organizationId || candidateData?.organization_id;
      if (candidate.exists && boundOrg === nestedIdentity.organizationId && candidate.id === nestedIdentity.inviteId) {
        initialInviteDoc = candidate;
        isNestedLegacy = true;
      }
    }
  }

  if (!initialInviteDoc) throw new InvitationCompatibilityError(400, 'INVALID_TOKEN');

  let inviteOrgIdResult = '';

  await db.runTransaction(async (transaction: any) => {
    const inviteDoc = await transaction.get(initialInviteDoc.ref);
    if (!inviteDoc.exists) throw new Error('INVITE_NOT_FOUND');
    const inviteData = inviteDoc.data() || {};

    const inviteOrgId = String(inviteData.organization_id || inviteData.organizationId || '').trim();
    if (!VALID_ID.test(inviteOrgId)) throw new Error('INVALID_INVITE_ORG');
    if (isNestedLegacy && (!nestedIdentity || inviteOrgId !== nestedIdentity.organizationId || inviteDoc.id !== nestedIdentity.inviteId)) {
      throw new Error('INVALID_TOKEN');
    }
    inviteOrgIdResult = inviteOrgId;

    const expiresAt = asDate(inviteData.expiresAt || inviteData.expires_at);
    if (!expiresAt || expiresAt.getTime() <= now().getTime()) throw new Error('TOKEN_EXPIRED');

    let tokenIsValid = false;
    if (isNestedLegacy) {
      tokenIsValid = true;
    } else if (inviteData.tokenHash) {
      tokenIsValid = timingSafeStringEqual(inviteData.tokenHash, tokenHash);
    } else if (inviteData.token) {
      tokenIsValid = timingSafeStringEqual(inviteData.token, token);
    }
    if (!tokenIsValid) throw new Error('INVALID_TOKEN');

    const status = String(inviteData.status || '').trim().toLowerCase();
    if (!isNestedLegacy && status === 'accepted') {
      if (inviteData.acceptedByUid === principal.uid) return;
      throw new Error('INVITE_ALREADY_CONSUMED');
    }
    if (status !== 'pending') throw new Error('INVITE_NOT_PENDING');

    if (inviteData.email && normalizeEmail(inviteData.email) !== principal.email) {
      throw new Error('EMAIL_MISMATCH');
    }

    const orgRef = db.collection('organizations').doc(inviteOrgId);
    const orgDoc = await transaction.get(orgRef);
    const orgData = orgDoc.exists ? (orgDoc.data() || {}) : null;
    const orgStatus = String(orgData?.status || '').trim().toLowerCase();
    if (!orgDoc.exists || orgData?.archived === true || orgStatus === 'archived') {
      throw new Error('INVALID_ORG');
    }

    const rawRoleId = inviteData.roleId || inviteData.internalRoleId || inviteData.requestedRoleId || null;
    let roleIdToAssign: string | null = null;
    let musicscaleRole: string | null = null;

    if (rawRoleId) {
      const cleanRoleId = String(rawRoleId).trim();
      if (!VALID_ID.test(cleanRoleId)) throw new Error('ROLE_NOT_FOUND');
      const roleDoc = await transaction.get(db.collection('roles').doc(cleanRoleId));
      if (!roleDoc.exists) throw new Error('ROLE_NOT_FOUND');
      const roleData = roleDoc.data() || {};
      if (roleData.organizationId !== inviteOrgId) throw new Error('ROLE_ORGANIZATION_MISMATCH');
      if (FORBIDDEN_ROLE_NAMES.has(safeRoleName(roleData.name))) throw new Error('CANNOT_ACCEPT_GLOBAL_OR_OWNER');
      roleIdToAssign = cleanRoleId;
      musicscaleRole = deriveMusicscaleRole(roleData.name || '');
    } else if (FORBIDDEN_ROLE_NAMES.has(safeRoleName(inviteData.role))) {
      throw new Error('CANNOT_ACCEPT_GLOBAL_OR_OWNER');
    }

    const userRef = db.collection('users').doc(principal.uid);
    const userDoc = await transaction.get(userRef);
    if (!userDoc.exists) throw new Error('USER_NOT_FOUND');
    const userData = userDoc.data() || {};

    const canonicalMemberRef = db.collection('organizations').doc(inviteOrgId).collection('members').doc(principal.uid);
    const canonicalMemberDoc = await transaction.get(canonicalMemberRef);
    const canonicalData: any = {
      uid: principal.uid,
      email: principal.email,
      displayName: userData.displayName || '',
      organizationId: inviteOrgId,
      organizationRole: 'member',
      role: 'member',
      status: 'active',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      invitedByUid: inviteData.createdByUid || null,
      inviteId: inviteDoc.id
    };
    if (!canonicalMemberDoc.exists) canonicalData.joinedAt = admin.firestore.FieldValue.serverTimestamp();
    transaction.set(canonicalMemberRef, canonicalData, { merge: true });

    if (roleIdToAssign) {
      const projectionRef = db.collection('organizations').doc(inviteOrgId).collection('musicscale_members').doc(principal.uid);
      const provenanceUid = isValidId(inviteData.createdByUid) ? inviteData.createdByUid : principal.uid;
      transaction.set(projectionRef, {
        uid: principal.uid,
        organizationId: inviteOrgId,
        roleId: roleIdToAssign,
        musicscaleRole,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedByUid: provenanceUid,
        source: isNestedLegacy ? 'legacy_nested_invite_migration' : 'legacy_root_invite_migration'
      }, { merge: true });
    }

    const legacyMemberRef = db.collection('organization_members').doc(`${principal.uid}_${inviteOrgId}`);
    transaction.set(legacyMemberRef, canonicalData, { merge: true });

    const userUpdate: any = {
      organizations: admin.firestore.FieldValue.arrayUnion(inviteOrgId)
    };
    if (!userData.activeOrganizationId) userUpdate.activeOrganizationId = inviteOrgId;
    if (!userData.primaryOrganizationId) userUpdate.primaryOrganizationId = inviteOrgId;
    transaction.update(userRef, userUpdate);

    if (!isNestedLegacy) {
      const inviteUpdates: any = {
        status: 'accepted',
        acceptedByUid: principal.uid,
        acceptedAt: admin.firestore.FieldValue.serverTimestamp(),
        tokenHash
      };
      if (inviteData.token) inviteUpdates.token = admin.firestore.FieldValue.delete();
      transaction.update(inviteDoc.ref, inviteUpdates);
    }

    const auditRef = db.collection('audit_logs').doc();
    transaction.set(auditRef, {
      action: isNestedLegacy ? 'organization.invite.legacy_nested_migrated' : 'organization.invite.legacy_root_migrated',
      actorUid: principal.uid,
      organizationId: inviteOrgId,
      inviteId: inviteDoc.id,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      correlationId: randomUUID()
    });
  });

  return { success: true, organization_id: inviteOrgIdResult };
}

export function createInvitationCompatibilityHandlers(deps: InvitationCompatibilityDependencies) {
  const resolveAuthorization = deps.resolveAuthorization || resolveOrganizationAuthorization;
  const hubFactory = deps.hubFactory || (() => new HubInvitationAdapter());

  const create = async (req: any, res: any) => {
    let preparedIntent: { ref: any; generationId: string } | undefined;
    try {
      if (!deps.db || !deps.auth) return res.status(503).json({ error: 'SERVICE_UNAVAILABLE' });
      const { organizationId, inviterUserId, email, roleId } = req.body || {};
      if (!isValidId(organizationId)) return res.status(400).json({ error: 'INVALID_ORGANIZATION_ID' });

      const authorization = await resolveAuthorization(req.headers?.authorization, organizationId, deps.db, deps.auth);
      if (authorization.statusCode) return res.status(authorization.statusCode).json({ error: authorization.error });
      const context = authorization.context!;

      if (inviterUserId && inviterUserId !== context.uid) return res.status(403).json({ error: 'ACTOR_ID_MISMATCH' });
      if (!context.systemRole && !context.isOwner && context.organizationRole !== 'admin' && !context.capabilities.includes('organization.members.manage')) {
        return res.status(403).json({ error: 'FORBIDDEN' });
      }

      const safeEmail = normalizeEmail(email);
      if (!isValidEmail(safeEmail)) return res.status(400).json({ error: 'INVALID_EMAIL' });
      const safeRoleId = typeof roleId === 'string' ? roleId.trim() : '';
      if (!safeRoleId) return res.status(400).json({ error: 'ROLE_ID_REQUIRED' });

      const intent = await prepareRoleIntent(deps.db, organizationId, safeEmail, safeRoleId, context.uid);
      preparedIntent = intent;
      const hub = await hubFactory().create(req.headers.authorization, organizationId, safeEmail);
      await finishRoleIntent(intent.ref, intent.generationId, hub);
      return res.json({ success: true, link: hub.invitePath, reasonCode: hub.reasonCode, invitation: hub.invitation });
    } catch (error: any) {
      if (error instanceof HubInvitationError) {
        if (preparedIntent && !error.ambiguous) await abandonRoleIntent(preparedIntent.ref, preparedIntent.generationId);
        return res.status(error.status).json({ error: error.reasonCode, reasonCode: error.reasonCode });
      }
      const mapped = mapKnownError(error);
      if (mapped) return res.status(mapped.status).json({ error: mapped.reasonCode, reasonCode: mapped.reasonCode });
      deps.logger?.error?.('[API] Invitation create failed');
      return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
    }
  };

  const accept = async (req: any, res: any) => {
    try {
      if (!deps.db || !deps.auth || !deps.admin) return res.status(503).json({ error: 'SERVICE_UNAVAILABLE' });
      const principal = await resolveAuthenticatedInvitationPrincipal(deps.auth, req.headers?.authorization);
      const token = req.body?.token;
      if (typeof token !== 'string' || token.length === 0 || token.length > 4096) {
        return res.status(400).json({ error: 'INVALID_TOKEN' });
      }
      if (req.body?.userId && req.body.userId !== principal.uid) return res.status(403).json({ error: 'ACTOR_ID_MISMATCH' });

      try {
        const hub = await hubFactory().accept(principal.bearer, token);
        const roleProjectionApplied = await applyRoleIntent(deps.db, hub.organizationId, principal.uid, principal.email);
        return res.json({ ...hub, roleProjectionApplied });
      } catch (hubError) {
        if (!permitsLegacyInvitationFallback(hubError)) {
          const mapped = mapKnownError(hubError);
          if (mapped) return res.status(mapped.status).json({ error: mapped.reasonCode, reasonCode: mapped.reasonCode });
          return res.status(503).json({ error: 'HUB_UNAVAILABLE', reasonCode: 'HUB_UNAVAILABLE' });
        }
      }

      const legacyResult = await acceptLegacyInvitation(deps, principal, token);
      return res.json(legacyResult);
    } catch (error: any) {
      const mapped = mapKnownError(error);
      if (mapped) return res.status(mapped.status).json({ error: mapped.reasonCode, reasonCode: mapped.reasonCode });
      deps.logger?.error?.('[API] Invitation acceptance failed');
      return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
    }
  };

  return { create, accept };
}
