import { resolveOrganizationAuthorization } from './organizationAuthorization.js';

const VALID_ID = /^[A-Za-z0-9_-]{1,128}$/;
const CRITICAL_COLLECTIONS = ['songs', 'scales', 'bandScales', 'fixedBandScales', 'eventTypes', 'locations'] as const;

type CriticalCollectionName = typeof CRITICAL_COLLECTIONS[number];

type AuthorizationResolver = typeof resolveOrganizationAuthorization;

interface MusicDataBootstrapDependencies {
  db: any;
  auth: any;
  resolveAuthorization?: AuthorizationResolver;
}

function jsonSafe(value: any): any {
  if (value == null) return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value?.toDate === 'function') {
    try {
      const date = value.toDate();
      return date instanceof Date ? date.toISOString() : value;
    } catch {
      return value;
    }
  }
  if (Array.isArray(value)) return value.map(jsonSafe);
  if (typeof value === 'object') {
    const output: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      output[key] = jsonSafe(child);
    }
    return output;
  }
  return value;
}

async function readTenantCollection(db: any, collectionName: CriticalCollectionName | 'roles' | 'instruments', organizationId: string) {
  const snapshot = await db.collection(collectionName)
    .where('organizationId', '==', organizationId)
    .get();

  return snapshot.docs.map((doc: any) => ({
    id: doc.id,
    ...jsonSafe(doc.data() || {}),
  }));
}

/**
 * Authenticated, tenant-scoped server fallback for the six collections required
 * to render the first operational MusicScale screen.
 *
 * The browser still prefers Firestore directly. This endpoint is only the
 * recovery path when the client SDK cannot complete those reads. It never
 * accepts organization identity from cached UI state without re-authorizing the
 * Firebase bearer token against the requested tenant.
 */
export function createMusicDataBootstrapHandler(deps: MusicDataBootstrapDependencies) {
  const resolveAuthorization = deps.resolveAuthorization || resolveOrganizationAuthorization;

  return async (req: any, res: any) => {
    const organizationId = String(
      req.query?.organizationId || req.headers?.['x-organization-id'] || ''
    ).trim();

    if (!VALID_ID.test(organizationId)) {
      return res.status(400).json({ error: 'INVALID_ORGANIZATION_ID' });
    }

    const authorization = await resolveAuthorization(
      req.headers?.authorization,
      organizationId,
      deps.db,
      deps.auth,
    );

    if (authorization.statusCode || !authorization.context) {
      return res.status(authorization.statusCode || 403).json({
        error: authorization.error || 'FORBIDDEN',
      });
    }

    const context = authorization.context;
    const hasTenantReadAuthority = context.isActive || Boolean(context.systemRole);
    if (!hasTenantReadAuthority) {
      return res.status(403).json({ error: 'FORBIDDEN' });
    }

    try {
      const [songs, scales, bandScales, fixedBandScales, eventTypes, locations] = await Promise.all(
        CRITICAL_COLLECTIONS.map((collectionName) =>
          readTenantCollection(deps.db, collectionName, organizationId)
        )
      );

      const taxonomy = req.query?.includeTaxonomy === 'true'
        ? {
            roles: await readTenantCollection(deps.db, 'roles', organizationId),
            instruments: await readTenantCollection(deps.db, 'instruments', organizationId),
          }
        : {};

      res.set?.('Cache-Control', 'private, no-store, max-age=0');
      return res.status(200).json({
        success: true,
        organizationId,
        data: {
          ...taxonomy,
          songs,
          scales,
          bandScales,
          fixedBandScales,
          eventTypes,
          locations,
        },
      });
    } catch (error) {
      return res.status(503).json({ error: 'MUSIC_DATA_BOOTSTRAP_UNAVAILABLE' });
    }
  };
}
