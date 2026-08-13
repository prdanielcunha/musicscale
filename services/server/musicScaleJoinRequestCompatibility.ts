import { HubJoinRequestAdapter, HubJoinRequestError } from './hubJoinRequestAdapter.js';

const VALID_ID = /^[A-Za-z0-9_-]{1,128}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OWNER_FIELDS = ['ownerUid', 'ownerUserId', 'ownerId', 'owner_user_id'] as const;

export interface JoinRequestCompatibilityDependencies {
  db: any;
  auth: any;
  logger?: { error?: (...args: any[]) => void };
  hubFactory?: () => Pick<HubJoinRequestAdapter, 'create' | 'approve' | 'reject'>;
}

export class JoinRequestCompatibilityError extends Error {
  constructor(public status: number, public reasonCode: string) {
    super(reasonCode);
  }
}

function normalizeEmail(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function validId(value: unknown): value is string {
  return typeof value === 'string' && VALID_ID.test(value);
}

async function verifyBearer(auth: any, authHeader: unknown): Promise<{ bearer: string; uid: string }> {
  if (typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ') || authHeader.length <= 7) {
    throw new JoinRequestCompatibilityError(401, 'UNAUTHORIZED');
  }
  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) throw new JoinRequestCompatibilityError(401, 'UNAUTHORIZED');
  try {
    const decoded = await auth.verifyIdToken(token, true);
    const uid = typeof decoded?.uid === 'string' ? decoded.uid.trim() : '';
    if (!VALID_ID.test(uid)) throw new Error('invalid uid');
    return { bearer: authHeader, uid };
  } catch {
    throw new JoinRequestCompatibilityError(401, 'UNAUTHORIZED');
  }
}

export async function resolveUniqueActiveOwnerOrganization(db: any, auth: any, ownerEmailInput: unknown): Promise<string> {
  const ownerEmail = normalizeEmail(ownerEmailInput);
  if (!EMAIL_RE.test(ownerEmail)) throw new JoinRequestCompatibilityError(400, 'INVALID_OWNER_EMAIL');

  let ownerRecord: any;
  try {
    ownerRecord = await auth.getUserByEmail(ownerEmail);
  } catch {
    throw new JoinRequestCompatibilityError(404, 'OWNER_ORGANIZATION_NOT_FOUND');
  }
  const ownerUid = typeof ownerRecord?.uid === 'string' ? ownerRecord.uid.trim() : '';
  if (!VALID_ID.test(ownerUid) || ownerRecord?.disabled === true) {
    throw new JoinRequestCompatibilityError(404, 'OWNER_ORGANIZATION_NOT_FOUND');
  }

  const candidates = new Map<string, any>();
  for (const field of OWNER_FIELDS) {
    const snapshot = await db.collection('organizations').where(field, '==', ownerUid).get();
    for (const document of snapshot.docs) candidates.set(document.id, document);
  }

  const active: string[] = [];
  for (const [organizationId, document] of candidates) {
    if (!VALID_ID.test(organizationId)) continue;
    const data = document.data() || {};
    const ownerMatches = OWNER_FIELDS.some(field => data[field] === ownerUid);
    const status = typeof data.status === 'string' ? data.status.trim().toLowerCase() : '';
    if (ownerMatches && data.archived !== true && status === 'active') active.push(organizationId);
  }

  active.sort();
  if (active.length === 0) throw new JoinRequestCompatibilityError(404, 'OWNER_ORGANIZATION_NOT_FOUND');
  if (active.length > 1) throw new JoinRequestCompatibilityError(409, 'OWNER_HAS_MULTIPLE_ORGANIZATIONS');
  return active[0];
}

function mapError(error: unknown): { status: number; reasonCode: string } {
  if (error instanceof JoinRequestCompatibilityError || error instanceof HubJoinRequestError) {
    return { status: error.status, reasonCode: error.reasonCode };
  }
  return { status: 500, reasonCode: 'INTERNAL_SERVER_ERROR' };
}

export function createJoinRequestCompatibilityHandlers(deps: JoinRequestCompatibilityDependencies) {
  const hubFactory = deps.hubFactory || (() => new HubJoinRequestAdapter());

  const create = async (req: any, res: any) => {
    try {
      if (!deps.db || !deps.auth) return res.status(503).json({ success: false, reasonCode: 'SERVICE_UNAVAILABLE' });
      const principal = await verifyBearer(deps.auth, req.headers?.authorization);
      const organizationId = await resolveUniqueActiveOwnerOrganization(deps.db, deps.auth, req.body?.ownerEmail);
      const result = await hubFactory().create(principal.bearer, organizationId);
      return res.status(200).json(result);
    } catch (error) {
      const mapped = mapError(error);
      if (mapped.status >= 500) deps.logger?.error?.('[API] Hub join-request create failed closed');
      return res.status(mapped.status).json({ success: false, reasonCode: mapped.reasonCode, error: mapped.reasonCode });
    }
  };

  const resolve = async (req: any, res: any, command: 'approve' | 'reject') => {
    try {
      if (!deps.auth) return res.status(503).json({ success: false, reasonCode: 'SERVICE_UNAVAILABLE' });
      const principal = await verifyBearer(deps.auth, req.headers?.authorization);
      const organizationId = req.params?.organizationId;
      const requestId = req.params?.requestId;
      if (!validId(organizationId) || !validId(requestId)) {
        return res.status(400).json({ success: false, reasonCode: 'INVALID_REQUEST_PATH' });
      }
      const hub = hubFactory();
      const result = command === 'approve'
        ? await hub.approve(principal.bearer, organizationId, requestId)
        : await hub.reject(principal.bearer, organizationId, requestId);
      return res.status(200).json(result);
    } catch (error) {
      const mapped = mapError(error);
      if (mapped.status >= 500) deps.logger?.error?.(`[API] Hub join-request ${command} failed closed`);
      return res.status(mapped.status).json({ success: false, reasonCode: mapped.reasonCode, error: mapped.reasonCode });
    }
  };

  return {
    create,
    approve: (req: any, res: any) => resolve(req, res, 'approve'),
    reject: (req: any, res: any) => resolve(req, res, 'reject')
  };
}

export { normalizeEmail as normalizeJoinRequestEmail, verifyBearer as verifyJoinRequestBearer };
