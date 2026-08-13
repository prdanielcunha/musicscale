import { HubMemberRemovalAdapter, HubMemberRemovalError } from './hubMemberRemovalAdapter.js';

const VALID_ID = /^[A-Za-z0-9_-]{1,128}$/;

export interface MemberRemovalCompatibilityDependencies {
  db: any;
  auth: any;
  logger?: { error?: (...args: any[]) => void; warn?: (...args: any[]) => void };
  hubFactory?: () => Pick<HubMemberRemovalAdapter, 'remove'>;
}

class MemberRemovalCompatibilityError extends Error {
  constructor(public status: number, public reasonCode: string) {
    super(reasonCode);
  }
}

async function verifyBearer(auth: any, authHeader: unknown): Promise<{ bearer: string; actorUid: string }> {
  if (typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ') || authHeader.length <= 7) {
    throw new MemberRemovalCompatibilityError(401, 'UNAUTHORIZED');
  }
  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) throw new MemberRemovalCompatibilityError(401, 'UNAUTHORIZED');
  try {
    const decoded = await auth.verifyIdToken(token, true);
    const actorUid = typeof decoded?.uid === 'string' ? decoded.uid.trim() : '';
    if (!VALID_ID.test(actorUid)) throw new Error('invalid uid');
    return { bearer: authHeader, actorUid };
  } catch {
    throw new MemberRemovalCompatibilityError(401, 'UNAUTHORIZED');
  }
}

function mapError(error: unknown): { status: number; reasonCode: string } {
  if (error instanceof HubMemberRemovalError || error instanceof MemberRemovalCompatibilityError) {
    return { status: error.status, reasonCode: error.reasonCode };
  }
  return { status: 500, reasonCode: 'INTERNAL_SERVER_ERROR' };
}

export function createMemberRemovalCompatibilityHandler(deps: MemberRemovalCompatibilityDependencies) {
  const hubFactory = deps.hubFactory || (() => new HubMemberRemovalAdapter());

  return async (req: any, res: any) => {
    try {
      if (!deps.db || !deps.auth) {
        return res.status(503).json({ success: false, reasonCode: 'SERVICE_UNAVAILABLE' });
      }
      const principal = await verifyBearer(deps.auth, req.headers?.authorization);
      const organizationId = typeof req.params?.organizationId === 'string' ? req.params.organizationId.trim() : '';
      const memberId = typeof req.params?.memberId === 'string' ? req.params.memberId.trim() : '';
      if (!VALID_ID.test(organizationId) || !VALID_ID.test(memberId)) {
        return res.status(400).json({ success: false, reasonCode: 'INVALID_REQUEST_PATH' });
      }

      const hubResult = await hubFactory().remove(principal.bearer, organizationId, memberId);

      let projectionCleanupApplied = false;
      try {
        await deps.db.collection('organizations').doc(organizationId)
          .collection('musicscale_members').doc(memberId).delete();
        projectionCleanupApplied = true;
      } catch {
        deps.logger?.warn?.('[API] Canonical member removal succeeded; MusicScale projection cleanup remains pending');
      }

      return res.status(200).json({
        ...hubResult,
        projectionCleanupApplied
      });
    } catch (error) {
      const mapped = mapError(error);
      if (mapped.status >= 500) deps.logger?.error?.('[API] Hub member removal failed closed');
      return res.status(mapped.status).json({ success: false, reasonCode: mapped.reasonCode, error: mapped.reasonCode });
    }
  };
}

export { verifyBearer as verifyMemberRemovalBearer };
