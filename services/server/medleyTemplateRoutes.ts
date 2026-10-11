import { createHash, randomUUID } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { resolveOrganizationAuthorization } from './organizationAuthorization.js';

const validId = /^[A-Za-z0-9_-]{1,128}$/;
const privilegedRoles = ['owner', 'admin', 'worship_leader', 'leader', 'lider', 'pastor', 'minister', 'ministro'];
const active = (value: unknown) => ['active', 'ativo'].includes(String(value || '').toLowerCase());
const normalize = (v: unknown) => String(v || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export function medleyTemplateRoutes(db: any, auth: any) {
  const authorize = async (req: any, write = false) => {
    const orgId = String(req.headers['x-organization-id'] || '');
    if (!validId.test(orgId)) return { status: 400, code: 'INVALID_ORGANIZATION_ID' };
    const result = await resolveOrganizationAuthorization(req.headers.authorization, orgId, db, auth);
    if (!result.context) return { status: result.statusCode || 403, code: result.error || 'FORBIDDEN' };
    const uid = result.context.uid;
    const orgSnap = await db.collection('organizations').doc(orgId).get();
    if (!orgSnap.exists) return { status: 404, code: 'ORGANIZATION_NOT_FOUND' };
    const org = orgSnap.data() || {};
    if (['inactive', 'suspended', 'archived', 'disabled'].includes(normalize(org.status)) || org.disabled === true) {
      return { status: 403, code: 'ORGANIZATION_INACTIVE' };
    }
    const subscription = await db.collection('subscriptions').doc(orgId).get();
    if (!['active', 'trialing'].includes(normalize(subscription.data()?.status)) &&
        !['active', 'trialing'].includes(normalize(org.apps?.musicscale?.status))) {
      return { status: 403, code: 'MUSICSCALE_INACTIVE' };
    }
    const canonical = await db.collection('organizations').doc(orgId).collection('members').doc(uid).get();
    const legacyA = canonical.exists ? null : await db.collection('organization_members').doc(uid + '_' + orgId).get();
    const legacyB = canonical.exists || legacyA?.exists ? null : await db.collection('organization_members').doc(orgId + '_' + uid).get();
    const membership = canonical.exists ? canonical : legacyA?.exists ? legacyA : legacyB;
    const member = membership?.exists ? membership.data() : null;
    if (member && !active(member.status)) return { status: 403, code: 'MEMBERSHIP_INACTIVE' };
    const isOwner = [org.ownerUid, org.ownerId, org.ownerUserId, org.owner_user_id].includes(uid);
    const isGlobal = ['ceo', 'global_admin', 'ecosystem_owner', 'founder'].includes(normalize(result.context.systemRole));
    if (!member && !isOwner && !isGlobal) return { status: 403, code: 'MEMBERSHIP_REQUIRED' };
    if (write && !isGlobal && !isOwner &&
        ![member?.role, member?.organizationRole].some(role => privilegedRoles.includes(normalize(role))) &&
        member?.permissions?.canManageScales !== true) {
      return { status: 403, code: 'MEDLEY_PERMISSION_DENIED' };
    }
    return { orgId, uid };
  };
  const error = (res: any, cause: any) => {
    if (cause?.status) return res.status(cause.status).json({ error: cause.code });
    console.error('[MedleyTemplateRoutes] Failure', cause);
    return res.status(503).json({ error: 'MEDLEY_TEMPLATE_SERVICE_UNAVAILABLE' });
  };
  return {
    list: async (req: any, res: any) => {
      res.set('Cache-Control', 'private, no-store');
      try {
        const access = await authorize(req);
        if (!('orgId' in access)) return error(res, access);
        const docs = await db.collection('medleyTemplates').where('organizationId', '==', access.orgId).limit(150).get();
        return res.status(200).json({ items: docs.docs.map((doc: any) => ({ ...doc.data(), id: doc.id })) });
      } catch (e) { return error(res, e); }
    },
    create: async (req: any, res: any) => {
      res.set('Cache-Control', 'private, no-store');
      try {
        const access = await authorize(req, true);
        if (!('orgId' in access)) return error(res, access);
        const { name, arrangement, parentTemplateId } = req.body || {};
        if (typeof name !== 'string' || !name.trim() || name.length > 120 ||
            !arrangement || !Array.isArray(arrangement.steps) ||
            arrangement.steps.length < 1 || arrangement.steps.length > 30 ||
            Buffer.byteLength(JSON.stringify(arrangement), 'utf8') > 400 * 1024) {
          return res.status(400).json({ error: 'INVALID_MEDLEY_TEMPLATE' });
        }
        const ids: string[] = [...new Set<string>(arrangement.steps.map((step: any) => step?.songId))];
        if (ids.some(id => typeof id !== 'string' || !validId.test(id))) {
          return res.status(400).json({ error: 'INVALID_SONG_REFERENCE' });
        }
        const sources = await Promise.all(ids.map(id => db.collection('songs').doc(id).get()));
        if (sources.some(song => !song.exists || song.data()?.organizationId !== access.orgId)) {
          return res.status(403).json({ error: 'CROSS_TENANT_SONG' });
        }
        if (parentTemplateId) {
          if (typeof parentTemplateId !== 'string' || !validId.test(parentTemplateId)) {
            return res.status(400).json({ error: 'INVALID_PARENT_ID' });
          }
          const parent = await db.collection('medleyTemplates').doc(parentTemplateId).get();
          if (!parent.exists || parent.data()?.organizationId !== access.orgId) {
            return res.status(403).json({ error: 'CROSS_TENANT_PARENT' });
          }
        }
        const key = String(req.headers['idempotency-key'] || randomUUID());
        if (!validId.test(key)) return res.status(400).json({ error: 'INVALID_IDEMPOTENCY_KEY' });
        const id = 'ms_' + createHash('sha256').update(access.orgId + ':' + access.uid + ':' + key).digest('hex').slice(0, 32);
        const ref = db.collection('medleyTemplates').doc(id);
        const fingerprint = createHash('sha256').update(JSON.stringify({ name, arrangement, parentTemplateId })).digest('hex');
        await db.runTransaction(async (tx: any) => {
          const previous = await tx.get(ref);
          if (previous.exists) {
            if (previous.data()?.createdBy?.uid !== access.uid || previous.data()?.fingerprint !== fingerprint) {
              throw { status: 409, code: 'IDEMPOTENCY_CONFLICT' };
            }
            return;
          }
          tx.create(ref, {
            organizationId: access.orgId, name: name.trim(), arrangement,
            schemaVersion: 2, status: 'ready', ...(parentTemplateId ? { parentTemplateId } : {}),
            fingerprint, createdBy: { uid: access.uid }, createdAt: FieldValue.serverTimestamp(),
          });
          tx.create(db.collection('audits').doc(), {
            action: 'CREATE', targetCollection: 'medleyTemplates', targetId: id,
            organizationId: access.orgId, user: { uid: access.uid }, timestamp: FieldValue.serverTimestamp(),
          });
        });
        return res.status(201).json({ id });
      } catch (e) { return error(res, e); }
    },
  };
}
