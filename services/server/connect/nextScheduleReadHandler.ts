import crypto from 'crypto';
import { resolveOrganizationAuthorization } from '../organizationAuthorization.js';
import { buildEffectiveAccessContext, hasMusicScaleCapability } from '../../../utils/rbac.js';
import {
  ConnectBandScaleRecord,
  ConnectScaleRecord,
  selectNextAssignedSchedule,
} from './nextScheduleSelector.js';

type MinimalRequest = {
  headers: Record<string, string | string[] | undefined>;
};

type MinimalResponse = {
  status(code: number): MinimalResponse;
  json(payload: unknown): unknown;
  setHeader?(name: string, value: string): void;
};

type AuthorizationResult = Awaited<ReturnType<typeof resolveOrganizationAuthorization>>;

export interface ConnectNextScheduleReadDependencies {
  db: any;
  auth: any;
  now?: () => number;
  resolveAuthorization?: typeof resolveOrganizationAuthorization;
  loadTenantSnapshot?: (
    organizationId: string,
    db: any,
  ) => Promise<{ scales: ConnectScaleRecord[]; bandScales: ConnectBandScaleRecord[] }>;
  logger?: {
    info?: (message: string, meta?: unknown) => void;
    warn?: (message: string, meta?: unknown) => void;
    error?: (message: string, meta?: unknown) => void;
  };
}

function headerValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0]?.trim() || '';
  return typeof value === 'string' ? value.trim() : '';
}

function getHeader(req: MinimalRequest, name: string): string {
  const direct = req.headers[name];
  if (direct !== undefined) return headerValue(direct);
  const lowerName = name.toLowerCase();
  for (const [key, value] of Object.entries(req.headers)) {
    if (key.toLowerCase() === lowerName) return headerValue(value);
  }
  return '';
}

function resolveBearerHeader(req: MinimalRequest):
  | { ok: true; value: string }
  | { ok: false; code: 'UNAUTHORIZED' } {
  const standard = getHeader(req, 'authorization');
  const forwarded = getHeader(req, 'x-connect-user-authorization');

  // Connect explicitly forwards the end-user Firebase bearer in this header so
  // it survives Firebase Hosting -> Cloud Run rewrites. Infrastructure may
  // replace the standard Authorization header with another credential, so the
  // forwarded user bearer is authoritative for this boundary when present.
  // It remains untrusted input and is Firebase-verified below by
  // resolveOrganizationAuthorization.
  const value = forwarded || standard;
  if (!value || !/^Bearer\s+\S+/i.test(value)) {
    return { ok: false, code: 'UNAUTHORIZED' };
  }

  return { ok: true, value };
}

function normalizeLocale(value: string): 'pt-BR' | 'en' | 'es' {
  const normalized = value.trim().toLowerCase();
  if (normalized.startsWith('en')) return 'en';
  if (normalized.startsWith('es')) return 'es';
  return 'pt-BR';
}

function localizeNoSchedule(locale: 'pt-BR' | 'en' | 'es'): string {
  if (locale === 'en') return 'I could not find an upcoming schedule assigned to you.';
  if (locale === 'es') return 'No encontré una próxima escala asignada a ti.';
  return 'Não encontrei uma próxima escala atribuída a você.';
}

function localizeSchedule(
  locale: 'pt-BR' | 'en' | 'es',
  date: string | null | undefined,
  time: string | null | undefined,
): string {
  const safeDate = date || '';
  const safeTime = time || '';
  const hasTime = /^([01]\d|2[0-3]):[0-5]\d$/.test(safeTime);
  let displayDate = safeDate;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(safeDate);
  if (match) {
    displayDate = locale === 'en'
      ? `${match[2]}/${match[3]}/${match[1]}`
      : `${match[3]}/${match[2]}/${match[1]}`;
  }

  if (locale === 'en') {
    return hasTime
      ? `Your next schedule is on ${displayDate} at ${safeTime}.`
      : `Your next schedule is on ${displayDate}.`;
  }
  if (locale === 'es') {
    return hasTime
      ? `Tu próxima escala es el ${displayDate} a las ${safeTime}.`
      : `Tu próxima escala es el ${displayDate}.`;
  }
  return hasTime
    ? `Sua próxima escala é em ${displayDate}, às ${safeTime}.`
    : `Sua próxima escala é em ${displayDate}.`;
}

function maskUid(uid: string): string {
  if (uid.length <= 6) return '***';
  return `${uid.slice(0, 3)}***${uid.slice(-3)}`;
}

async function loadTenantSnapshotFromFirestore(
  organizationId: string,
  db: any,
): Promise<{ scales: ConnectScaleRecord[]; bandScales: ConnectBandScaleRecord[] }> {
  const [scaleSnap, bandScaleSnap] = await Promise.all([
    db.collection('scales').where('organizationId', '==', organizationId).get(),
    db.collection('bandScales').where('organizationId', '==', organizationId).get(),
  ]);

  const scales: ConnectScaleRecord[] = scaleSnap.docs.map((doc: any) => ({
    id: doc.id,
    ...(doc.data() || {}),
  }));

  const bandScales: ConnectBandScaleRecord[] = bandScaleSnap.docs.map((doc: any) => ({
    id: doc.id,
    ...(doc.data() || {}),
  }));

  return { scales, bandScales };
}

function normalizeAuthorizationResult(value: AuthorizationResult): AuthorizationResult {
  return value;
}

/**
 * Canonical read-only HTTP boundary for Connect -> MusicScale.
 *
 * Security model:
 * - Firebase bearer is revalidated inside MusicScale;
 * - X-Connect-User-Authorization carries the end-user bearer across the
 *   Connect -> Firebase Hosting -> Cloud Run transport hop and is preferred
 *   when present because infrastructure may alter the standard Authorization
 *   header; the selected bearer is still Firebase-verified server-side;
 * - organizationId comes from an explicit header and is checked by the canonical
 *   organization authorization resolver;
 * - `scales.read` is evaluated by the MusicScale RBAC implementation;
 * - the Firestore reads are always tenant-filtered and the selector fails closed
 *   on any tenant mismatch;
 * - no Connect-side role/capability payload is trusted as authority.
 */
export function createConnectNextScheduleReadHandler(
  deps: ConnectNextScheduleReadDependencies,
) {
  const resolveAuthorization = deps.resolveAuthorization ?? resolveOrganizationAuthorization;
  const loadTenantSnapshot = deps.loadTenantSnapshot ?? loadTenantSnapshotFromFirestore;
  const now = deps.now ?? Date.now;
  const logger = deps.logger ?? console;

  return async function handleConnectNextScheduleRead(
    req: MinimalRequest,
    res: MinimalResponse,
  ) {
    const auditId = `ms-next-${crypto.randomUUID()}`;
    res.setHeader?.('Cache-Control', 'no-store');

    const bearerResolution = resolveBearerHeader(req);
    const organizationId = getHeader(req, 'x-organization-id');
    const locale = normalizeLocale(getHeader(req, 'accept-language'));

    if (bearerResolution.ok === false) {
      return res.status(401).json({
        success: false,
        code: bearerResolution.code,
        auditId,
        humanSummary: 'Authentication required.',
      });
    }

    const authorizationHeader = bearerResolution.value;

    if (!organizationId) {
      return res.status(400).json({
        success: false,
        code: 'ORGANIZATION_REQUIRED',
        auditId,
        humanSummary: 'Organization context is required.',
      });
    }

    try {
      const authorization = normalizeAuthorizationResult(
        await resolveAuthorization(
          authorizationHeader,
          organizationId,
          deps.db,
          deps.auth,
        ),
      );

      if (authorization.error || !authorization.context) {
        const status = authorization.statusCode || 403;
        logger.warn?.('[ConnectNextSchedule] authorization denied', {
          auditId,
          organizationId,
          status,
          code: authorization.error || 'FORBIDDEN',
        });
        return res.status(status).json({
          success: false,
          code: authorization.error || 'FORBIDDEN',
          auditId,
          humanSummary: status === 401 ? 'Authentication required.' : 'Access denied.',
        });
      }

      const authContext = authorization.context;
      const effectiveOrganizationRole = authContext.isOwner
        ? 'owner'
        : authContext.organizationRole || null;
      const access = buildEffectiveAccessContext(
        authContext.uid,
        organizationId,
        authContext.systemRole,
        effectiveOrganizationRole,
        authContext.isActive ? 'active' : 'inactive',
      );

      if (
        (!authContext.isActive && !access.isGlobalFullAccess) ||
        !hasMusicScaleCapability(access, 'scales.read')
      ) {
        logger.warn?.('[ConnectNextSchedule] scales.read denied', {
          auditId,
          organizationId,
          actorUid: maskUid(authContext.uid),
        });
        return res.status(403).json({
          success: false,
          code: 'PERMISSION_DENIED',
          auditId,
          humanSummary: 'Access denied.',
        });
      }

      const snapshot = await loadTenantSnapshot(organizationId, deps.db);
      const selection = selectNextAssignedSchedule({
        organizationId,
        actorUid: authContext.uid,
        scales: snapshot.scales,
        bandScales: snapshot.bandScales,
        nowMs: now(),
      });

      if (!selection) {
        logger.info?.('[ConnectNextSchedule] no assigned schedule', {
          auditId,
          organizationId,
          actorUid: maskUid(authContext.uid),
        });
        return res.status(200).json({
          success: true,
          protocolVersion: '1.0.0',
          auditId,
          organizationId,
          schedule: null,
          humanSummary: localizeNoSchedule(locale),
        });
      }

      const { scale } = selection;
      const schedule = {
        id: scale.id,
        organizationId,
        date: scale.date || null,
        time: scale.time || null,
        timeZone: scale.timeZone || null,
        durationMinutes: scale.durationMinutes || null,
        status: scale.status || null,
        eventNameId: scale.eventNameId || null,
        eventTypeId: scale.eventTypeId || null,
        locationId: scale.locationId || null,
        songIds: Array.isArray(scale.songIds) ? [...scale.songIds] : [],
        assignmentSource: selection.assignmentSource,
        functionNames: [...selection.functionNames],
        deepLink: `/scales/${encodeURIComponent(scale.id)}`,
      };

      logger.info?.('[ConnectNextSchedule] success', {
        auditId,
        organizationId,
        actorUid: maskUid(authContext.uid),
        scaleId: scale.id,
        assignmentSource: selection.assignmentSource,
      });

      return res.status(200).json({
        success: true,
        protocolVersion: '1.0.0',
        auditId,
        organizationId,
        schedule,
        humanSummary: localizeSchedule(locale, scale.date, scale.time),
      });
    } catch (error) {
      logger.error?.('[ConnectNextSchedule] failed', {
        auditId,
        organizationId,
        error: error instanceof Error ? error.message : 'unknown_error',
      });
      return res.status(503).json({
        success: false,
        code: 'SERVICE_UNAVAILABLE',
        auditId,
        humanSummary: 'MusicScale is temporarily unavailable.',
      });
    }
  };
}
