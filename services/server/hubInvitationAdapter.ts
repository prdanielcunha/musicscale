import crypto from 'crypto';
import { writeMusicScaleMemberProjection, validateMusicScaleRole } from './musicScaleMemberProjection.js';

const FORBIDDEN_ROLES = new Set(['owner', 'dono', 'ceo', 'global_admin', 'ecosystem_owner', 'founder', 'support', 'suporte']);
const VALID_ID = /^[A-Za-z0-9_-]{1,128}$/;
const VALID_ACCEPT_REASON_CODES = new Set(['INVITATION_CAN_BE_ACCEPTED', 'ALREADY_MEMBER']);

export class HubInvitationError extends Error {
  constructor(public status: number, public reasonCode: string, public ambiguous = false) {
    super(reasonCode);
  }
}

export const normalizeEmail = (email: unknown) => String(email || '').trim().toLowerCase();
export const recipientEmailHash = (email: string) => crypto.createHash('sha256').update(normalizeEmail(email)).digest('hex');

export function resolveHubOrigin(value = process.env.MILLIONSNEST_HUB_ORIGIN): string {
  if (!value) throw new HubInvitationError(503, 'HUB_NOT_CONFIGURED');
  try {
    const url = new URL(value);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error();
    return url.origin;
  } catch {
    throw new HubInvitationError(503, 'HUB_NOT_CONFIGURED');
  }
}

function validateAcceptSuccess(data: any): any {
  const organizationId = typeof data?.organizationId === 'string' ? data.organizationId.trim() : '';
  const activeOrganizationId = typeof data?.activeOrganizationId === 'string' ? data.activeOrganizationId.trim() : '';
  const membershipRole = typeof data?.membershipRole === 'string' ? data.membershipRole.trim() : '';
  const reasonCode = typeof data?.reasonCode === 'string' ? data.reasonCode.trim() : '';

  if (
    data?.success !== true ||
    !VALID_ID.test(organizationId) ||
    activeOrganizationId !== organizationId ||
    !membershipRole ||
    typeof data?.alreadyMember !== 'boolean' ||
    !VALID_ACCEPT_REASON_CODES.has(reasonCode)
  ) {
    throw new HubInvitationError(502, 'INVALID_HUB_RESPONSE', true);
  }

  return { ...data, organizationId, activeOrganizationId, membershipRole, reasonCode };
}

export class HubInvitationAdapter {
  constructor(private options: { origin?: string; fetch?: typeof fetch; timeoutMs?: number } = {}) {}

  private async post(path: string, bearer: string, body: object): Promise<any> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.options.timeoutMs ?? 8000);
    try {
      const response = await (this.options.fetch || fetch)(`${resolveHubOrigin(this.options.origin)}${path}`, {
        method: 'POST', headers: { 'content-type': 'application/json', authorization: bearer },
        body: JSON.stringify(body), signal: controller.signal
      });
      let data: any = {};
      try { data = await response.json(); } catch { /* sanitized below */ }
      if (!response.ok) throw new HubInvitationError(response.status, String(data.reasonCode || data.error || 'HUB_REQUEST_FAILED'), response.status >= 500);
      if (data?.success !== true) throw new HubInvitationError(502, 'INVALID_HUB_RESPONSE', true);
      return data;
    } catch (error) {
      if (error instanceof HubInvitationError) throw error;
      throw new HubInvitationError(503, 'HUB_UNAVAILABLE', true);
    } finally { clearTimeout(timer); }
  }

  async create(bearer: string, organizationId: string, email: string) {
    const result = await this.post('/api/v1/invitations', bearer, { organizationId, email: normalizeEmail(email), role: 'member' });
    if (!result.invitePath?.startsWith(`/join/${organizationId}?token=`) || result.invitation?.organizationId !== organizationId || result.invitation?.role !== 'member')
      throw new HubInvitationError(502, 'INVALID_HUB_RESPONSE', true);
    return result;
  }

  async accept(bearer: string, token: string) {
    const result = await this.post('/api/v1/invitations/accept', bearer, { token });
    return validateAcceptSuccess(result);
  }
}

export function permitsLegacyInvitationFallback(error: unknown): boolean {
  return error instanceof HubInvitationError && error.status === 404 && error.reasonCode === 'INVITE_NOT_FOUND';
}

export async function prepareRoleIntent(db: any, organizationId: string, email: string, roleId: string, actorUid: string) {
  if (!VALID_ID.test(organizationId)) throw new HubInvitationError(400, 'INVALID_ORGANIZATION_ID');
  const role = await validateMusicScaleRole(db, organizationId, roleId);
  if (FORBIDDEN_ROLES.has(String(role?.name || '').trim().toLowerCase())) throw new HubInvitationError(403, 'CANNOT_INVITE_GLOBAL_OR_OWNER');
  const hash = recipientEmailHash(email), generationId = crypto.randomUUID();
  const ref = db.collection('organizations').doc(organizationId).collection('musicscale_invite_role_intents').doc(hash);
  await ref.set({ schemaVersion: 1, organizationId, recipientEmailHash: hash, roleId, createdByUid: actorUid, generationId, status: 'creating', createdAt: new Date(), updatedAt: new Date() });
  return { ref, generationId };
}

export async function finishRoleIntent(intent: any, generationId: string, hub: any) {
  const current = await intent.get();
  if (current.exists && current.data()?.generationId === generationId)
    await intent.set({ status: 'pending', hubInvitationId: hub.invitation.id, expiresAtMs: hub.invitation.expiresAtMs, updatedAt: new Date() }, { merge: true });
}

export async function abandonRoleIntent(intent: any, generationId: string) {
  const current = await intent.get();
  if (current.exists && current.data()?.generationId === generationId) await intent.delete();
}

export async function applyRoleIntent(db: any, organizationId: string, uid: string, email: string): Promise<boolean> {
  const ref = db.collection('organizations').doc(organizationId).collection('musicscale_invite_role_intents').doc(recipientEmailHash(email));
  const snap = await ref.get();
  if (!snap.exists || !['creating', 'pending'].includes(snap.data()?.status) || snap.data()?.organizationId !== organizationId) return false;
  try {
    const data = snap.data() || {};
    await validateMusicScaleRole(db, organizationId, data.roleId);
    const provenanceUid = typeof data.createdByUid === 'string' && VALID_ID.test(data.createdByUid) ? data.createdByUid : uid;
    await writeMusicScaleMemberProjection(db, organizationId, uid, provenanceUid, { roleId: data.roleId }, { source: 'hub_invitation_role_intent' });
    await ref.set({ status: 'applied', appliedToUid: uid, appliedAt: new Date(), updatedAt: new Date() }, { merge: true });
    return true;
  } catch {
    await ref.set({ status: 'invalid', updatedAt: new Date() }, { merge: true });
    return false;
  }
}

export function decodeLegacyNestedToken(token: string) {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf8');
    if (Buffer.from(decoded).toString('base64url') !== token.replace(/=+$/, '')) return null;
    const parts = decoded.split(':');
    return parts.length === 2 && parts.every(part => VALID_ID.test(part)) ? { organizationId: parts[0], inviteId: parts[1] } : null;
  } catch { return null; }
}

export { FORBIDDEN_ROLES, validateAcceptSuccess };
