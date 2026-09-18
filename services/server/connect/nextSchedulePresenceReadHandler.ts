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

export interface ConnectOwnResponseRecord {
  id: string;
  organizationId?: string | null;
  musicScaleId?: string | null;
  userId?: string | null;
  status?: string | null;
  active?: boolean | null;
  respondedAt?: unknown;
  reason?: string | null;
}

export interface ConnectNextSchedulePresenceDependencies {
  db: any;
  auth: any;
  now?: () => number;
  resolveAuthorization?: typeof resolveOrganizationAuthorization;
  loadTenantSnapshot?: (
    organizationId: string,
    db: any,
  ) => Promise<{ scales: ConnectScaleRecord[]; bandScales: ConnectBandScaleRecord[] }>;
  loadOwnResponses?: (
    organizationId: string,
    scaleId: string,
    actorUid: string,
    db: any,
  ) => Promise<ConnectOwnResponseRecord[]>;
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

function maskUid(uid: string): string {
  if (uid.length <= 6) return '***';
  return `${uid.slice(0, 3)}***${uid.slice(-3)}`;
}

function timestampToIso(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }
  if (typeof value === 'object') {
    const candidate = value as any;
    if (typeof candidate.toDate === 'function') {
      const date = candidate.toDate();
      return date instanceof Date && !Number.isNaN(date.getTime()) ? date.toISOString() : null;
    }
    if (typeof candidate.toMillis === 'function') {
      const millis = candidate.toMillis();
      return typeof millis === 'number' && Number.isFinite(millis)
        ? new Date(millis).toISOString()
        : null;
    }
    const seconds = candidate.seconds ?? candidate._seconds;
    if (typeof seconds === 'number' && Number.isFinite(seconds)) {
      return new Date(seconds * 1000).toISOString();
    }
  }
  return null;
}

async function loadTenantSnapshotFromFirestore(
  organizationId: string,
  db: any,
): Promise<{ scales: ConnectScaleRecord[]; bandScales: ConnectBandScaleRecord[] }> {
  const [scaleSnap, bandScaleSnap] = await Promise.all([
    db.collection('scales').where('organizationId', '==', organizationId).get(),
    db.collection('bandScales').where('organizationId', '==', organizationId).get(),
  ]);

  return {
    scales: scaleSnap.docs.map((doc: any) => ({ id: doc.id, ...(doc.data() || {}) })),
    bandScales: bandScaleSnap.docs.map((doc: any) => ({ id: doc.id, ...(doc.data() || {}) })),
  };
}

async function loadOwnResponsesFromFirestore(
  organizationId: string,
  scaleId: string,
  actorUid: string,
  db: any,
): Promise<ConnectOwnResponseRecord[]> {
  const snapshot = await db
    .collection('scales')
    .doc(scaleId)
    .collection('responses')
    .where('userId', '==', actorUid)
    .get();

  return snapshot.docs
    .map((doc: any) => ({ id: doc.id, ...(doc.data() || {}) }))
    .filter(
      (response: ConnectOwnResponseRecord) =>
        response.organizationId === organizationId &&
        response.musicScaleId === scaleId &&
        response.userId === actorUid &&
        response.active !== false,
    );
}

type PresenceStatus = 'pending' | 'accepted' | 'maybe' | 'declined' | 'mixed';

function resolvePresenceStatus(responses: ConnectOwnResponseRecord[]): {
  status: PresenceStatus;
  statuses: Array<'accepted' | 'maybe' | 'declined'>;
  respondedAt: string | null;
} {
  const validStatuses = responses
    .map((response) => String(response.status || '').trim().toLowerCase())
    .filter(
      (status): status is 'accepted' | 'maybe' | 'declined' =>
        status === 'accepted' || status === 'maybe' || status === 'declined',
    );

  const uniqueStatuses = Array.from(new Set(validStatuses)).sort();
  const respondedAt = responses
    .map((response) => timestampToIso(response.respondedAt))
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1) || null;

  if (uniqueStatuses.length === 0) {
    return { status: 'pending', statuses: [], respondedAt };
  }
  if (uniqueStatuses.length === 1) {
    return { status: uniqueStatuses[0], statuses: uniqueStatuses, respondedAt };
  }
  return { status: 'mixed', statuses: uniqueStatuses, respondedAt };
}

function humanSummary(
  locale: 'pt-BR' | 'en' | 'es',
  status: PresenceStatus,
): string {
  const messages = {
    'pt-BR': {
      pending: 'Você ainda não respondeu sua presença na próxima escala.',
      accepted: 'Sua presença na próxima escala está confirmada.',
      maybe: 'Sua resposta para a próxima escala está como talvez.',
      declined: 'Você informou que não poderá participar da próxima escala.',
      mixed: 'Encontrei respostas diferentes entre suas funções na próxima escala.',
    },
    en: {
      pending: 'You have not responded to your next schedule yet.',
      accepted: 'Your attendance for the next schedule is confirmed.',
      maybe: 'Your response for the next schedule is maybe.',
      declined: 'You said you cannot attend the next schedule.',
      mixed: 'I found different responses across your assignments in the next schedule.',
    },
    es: {
      pending: 'Todavía no respondiste tu asistencia para la próxima escala.',
      accepted: 'Tu asistencia para la próxima escala está confirmada.',
      maybe: 'Tu respuesta para la próxima escala está como tal vez.',
      declined: 'Informaste que no podrás participar en la próxima escala.',
      mixed: 'Encontré respuestas diferentes entre tus funciones en la próxima escala.',
    },
  } as const;
  return messages[locale][status];
}

function noScheduleSummary(locale: 'pt-BR' | 'en' | 'es'): string {
  if (locale === 'en') return 'I could not find an upcoming schedule assigned to you.';
  if (locale === 'es') return 'No encontré una próxima escala asignada a ti.';
  return 'Não encontrei uma próxima escala atribuída a você.';
}

export function createConnectNextSchedulePresenceReadHandler(
  deps: ConnectNextSchedulePresenceDependencies,
) {
  const resolveAuthorization = deps.resolveAuthorization ?? resolveOrganizationAuthorization;
  const loadTenantSnapshot = deps.loadTenantSnapshot ?? loadTenantSnapshotFromFirestore;
  const loadOwnResponses = deps.loadOwnResponses ?? loadOwnResponsesFromFirestore;
  const now = deps.now ?? Date.now;
  const logger = deps.logger ?? console;

  return async function handleConnectNextSchedulePresenceRead(
    req: MinimalRequest,
    res: MinimalResponse,
  ) {
    const auditId = `ms-presence-${crypto.randomUUID()}`;
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
    if (!organizationId) {
      return res.status(400).json({
        success: false,
        code: 'ORGANIZATION_REQUIRED',
        auditId,
        humanSummary: 'Organization context is required.',
      });
    }

    try {
      const authorization = await resolveAuthorization(
        bearerResolution.value,
        organizationId,
        deps.db,
        deps.auth,
        { checkRevoked: false },
      );

      if (authorization.error || !authorization.context) {
        const status = authorization.statusCode || 403;
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
        !hasMusicScaleCapability(access, 'scales.read') ||
        !hasMusicScaleCapability(access, 'scaleResponses.respondOwn')
      ) {
        logger.warn?.('[ConnectPresence] read capability denied', {
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
        return res.status(200).json({
          success: true,
          protocolVersion: '1.0.0',
          auditId,
          organizationId,
          schedule: null,
          presence: null,
          humanSummary: noScheduleSummary(locale),
        });
      }

      const responses = await loadOwnResponses(
        organizationId,
        selection.scale.id,
        authContext.uid,
        deps.db,
      );
      const presence = resolvePresenceStatus(responses);

      logger.info?.('[ConnectPresence] success', {
        auditId,
        organizationId,
        actorUid: maskUid(authContext.uid),
        scaleId: selection.scale.id,
        status: presence.status,
        responseCount: responses.length,
      });

      return res.status(200).json({
        success: true,
        protocolVersion: '1.0.0',
        auditId,
        organizationId,
        schedule: {
          id: selection.scale.id,
          organizationId,
          date: selection.scale.date || null,
          time: selection.scale.time || null,
          timeZone: selection.scale.timeZone || null,
          assignmentSource: selection.assignmentSource,
          functionNames: [...selection.functionNames],
          deepLink: `/scales/${encodeURIComponent(selection.scale.id)}`,
        },
        presence: {
          status: presence.status,
          statuses: presence.statuses,
          responseCount: responses.length,
          respondedAt: presence.respondedAt,
        },
        humanSummary: humanSummary(locale, presence.status),
      });
    } catch (error) {
      logger.error?.('[ConnectPresence] failed', {
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
