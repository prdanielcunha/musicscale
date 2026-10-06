import type { Request, Response } from 'express';
import { resolveOrganizationAuthorization } from '../organizationAuthorization.js';
import {
  buildEffectiveAccessContext,
  hasMusicScaleCapability,
} from '../../../utils/rbac.js';
import {
  evaluateServeGuard,
  normalizeServeGuardPreference,
  type ServeGuardPreference,
  type ServeGuardScaleInput,
} from './serveGuardPolicy.js';

type AuthorizationResult = Awaited<ReturnType<typeof resolveOrganizationAuthorization>>;

export interface ServeGuardHttpDependencies {
  db: any;
  auth: any;
  now?: () => number;
  resolveAuthorization?: typeof resolveOrganizationAuthorization;
  loadPreference?: (
    organizationId: string,
    userId: string,
    db: any,
  ) => Promise<ServeGuardPreference | null>;
  savePreference?: (
    preference: ServeGuardPreference,
    db: any,
  ) => Promise<void>;
  loadScales?: (
    organizationId: string,
    db: any,
  ) => Promise<ServeGuardScaleInput[]>;
  targetIsActiveMember?: (
    organizationId: string,
    userId: string,
    db: any,
  ) => Promise<boolean>;
  logger?: {
    info?: (message: string, meta?: unknown) => void;
    warn?: (message: string, meta?: unknown) => void;
    error?: (message: string, meta?: unknown) => void;
  };
}

type ResolvedServeGuardActor = {
  uid: string;
  organizationRole: string | null;
  canManageSchedules: boolean;
  isActiveTenantMember: boolean;
};

function safeId(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !/^[A-Za-z0-9_-]{1,128}$/.test(value.trim())
  ) {
    return '';
  }
  return value.trim();
}

function maskIdentifier(value: string): string {
  const normalized = value.trim();
  if (normalized.length <= 6) return '***';
  return normalized.slice(0, 3) + '***' + normalized.slice(-3);
}

function safeDate(value: unknown): string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())
    ? value.trim()
    : '';
}

function normalizeAuthorizationResult(value: AuthorizationResult): AuthorizationResult {
  return value;
}

async function resolveActor(
  req: Request,
  organizationId: string,
  deps: ServeGuardHttpDependencies,
): Promise<
  | { ok: true; actor: ResolvedServeGuardActor }
  | { ok: false; status: number; code: string }
> {
  const resolveAuthorization =
    deps.resolveAuthorization ?? resolveOrganizationAuthorization;

  const authorization = normalizeAuthorizationResult(
    await resolveAuthorization(
      req.headers.authorization,
      organizationId,
      deps.db,
      deps.auth,
      { checkRevoked: false },
    ),
  );

  if (authorization.error || !authorization.context) {
    return {
      ok: false,
      status: authorization.statusCode || 403,
      code: authorization.error || 'FORBIDDEN',
    };
  }

  const context = authorization.context;
  if (!context.isActive) {
    return {
      ok: false,
      status: 403,
      code: 'ACTIVE_TENANT_MEMBERSHIP_REQUIRED',
    };
  }

  const organizationRole = context.isOwner
    ? 'owner'
    : context.organizationRole || null;

  const access = buildEffectiveAccessContext(
    context.uid,
    organizationId,
    context.systemRole,
    organizationRole,
    'active',
  );

  // ServeGuard preference data is ministry-operational. A global role alone
  // does not turn into workload visibility; the actor must have an active
  // tenant membership/ownership and a scheduling capability.
  const normalizedRole = String(organizationRole || '').trim().toLowerCase();
  const tenantLeadership = ['owner', 'admin', 'leader'].includes(normalizedRole);

  return {
    ok: true,
    actor: {
      uid: context.uid,
      organizationRole,
      canManageSchedules:
        tenantLeadership &&
        (
          hasMusicScaleCapability(access, 'musicians.assignToScale') ||
          hasMusicScaleCapability(access, 'scales.create') ||
          hasMusicScaleCapability(access, 'scales.update')
        ),
      isActiveTenantMember: true,
    },
  };
}

async function loadPreferenceFromFirestore(
  organizationId: string,
  userId: string,
  db: any,
): Promise<ServeGuardPreference | null> {
  const snapshot = await db
    .collection('organizations')
    .doc(organizationId)
    .collection('serveGuardPreferences')
    .doc(userId)
    .get();

  if (!snapshot.exists) return null;
  const data = snapshot.data() || {};

  return normalizeServeGuardPreference({
    organizationId,
    userId,
    maxServicesPerWeek: data.maxServicesPerWeek,
    maxServicesPerMonth: data.maxServicesPerMonth,
    unavailableDates: data.unavailableDates,
    pausedUntil: data.pausedUntil,
    updatedAtMs: data.updatedAtMs,
    updatedBy: data.updatedBy,
  });
}

async function savePreferenceToFirestore(
  preference: ServeGuardPreference,
  db: any,
): Promise<void> {
  await db
    .collection('organizations')
    .doc(preference.organizationId)
    .collection('serveGuardPreferences')
    .doc(preference.userId)
    .set(
      {
        schemaVersion: preference.schemaVersion,
        organizationId: preference.organizationId,
        userId: preference.userId,
        maxServicesPerWeek: preference.maxServicesPerWeek,
        maxServicesPerMonth: preference.maxServicesPerMonth,
        unavailableDates: preference.unavailableDates,
        pausedUntil: preference.pausedUntil,
        updatedAtMs: preference.updatedAtMs ?? null,
        updatedBy: preference.updatedBy ?? null,
      },
      { merge: true },
    );
}

async function loadScalesFromFirestore(
  organizationId: string,
  db: any,
): Promise<ServeGuardScaleInput[]> {
  const snapshot = await db
    .collection('scales')
    .where('organizationId', '==', organizationId)
    .get();

  return snapshot.docs.map((document: any) => ({
    id: document.id,
    ...(document.data() || {}),
  }));
}

async function targetIsActiveMemberFromFirestore(
  organizationId: string,
  userId: string,
  db: any,
): Promise<boolean> {
  const canonical = await db
    .collection('organizations')
    .doc(organizationId)
    .collection('members')
    .doc(userId)
    .get();

  if (canonical.exists) {
    const status = String(canonical.data()?.status || '').trim().toLowerCase();
    return status === 'active' || status === 'ativo';
  }

  for (const legacyId of [
    userId + '_' + organizationId,
    organizationId + '_' + userId,
  ]) {
    const legacy = await db.collection('organization_members').doc(legacyId).get();
    if (!legacy.exists) continue;
    const data = legacy.data() || {};
    const status = String(data.status || '').trim().toLowerCase();
    if (
      data.organizationId === organizationId &&
      (status === 'active' || status === 'ativo')
    ) {
      return true;
    }
  }

  return false;
}

async function confirmTargetMembership(
  organizationId: string,
  targetUserId: string,
  deps: ServeGuardHttpDependencies,
): Promise<boolean> {
  const resolver = deps.targetIsActiveMember ?? targetIsActiveMemberFromFirestore;
  return resolver(organizationId, targetUserId, deps.db);
}

function privateNoStore(res: Response) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Pragma', 'no-cache');
}

export function createServeGuardHttpHandlers(deps: ServeGuardHttpDependencies) {
  const now = deps.now ?? Date.now;
  const logger = deps.logger ?? console;
  const loadPreference = deps.loadPreference ?? loadPreferenceFromFirestore;
  const savePreference = deps.savePreference ?? savePreferenceToFirestore;
  const loadScales = deps.loadScales ?? loadScalesFromFirestore;

  const getPreference = async (req: Request, res: Response) => {
    privateNoStore(res);
    const organizationId = safeId(req.params.organizationId);
    const targetUserId = safeId(req.params.userId);

    if (!organizationId || !targetUserId) {
      return res.status(400).json({
        success: false,
        code: 'INVALID_REQUEST',
      });
    }

    try {
      const authorization = await resolveActor(req, organizationId, deps);
      if (authorization.ok === false) {
        return res.status(authorization.status).json({
          success: false,
          code: authorization.code,
        });
      }

      const { actor } = authorization;
      const self = actor.uid === targetUserId;
      if (!self && !actor.canManageSchedules) {
        return res.status(403).json({
          success: false,
          code: 'SERVEGUARD_READ_AUTHORITY_REQUIRED',
        });
      }

      if (!(await confirmTargetMembership(organizationId, targetUserId, deps))) {
        return res.status(404).json({
          success: false,
          code: 'TARGET_MEMBER_NOT_FOUND',
        });
      }

      const preference = await loadPreference(
        organizationId,
        targetUserId,
        deps.db,
      );

      return res.status(200).json({
        success: true,
        organizationId,
        userId: targetUserId,
        preference,
      });
    } catch (error) {
      logger.error?.('[ServeGuard] preference read failed', {
        organizationId,
        targetUserId: maskIdentifier(targetUserId),
        error: error instanceof Error ? error.message : 'unknown_error',
      });
      return res.status(503).json({
        success: false,
        code: 'SERVICE_UNAVAILABLE',
      });
    }
  };

  const putPreference = async (req: Request, res: Response) => {
    privateNoStore(res);
    const organizationId = safeId(req.params.organizationId);
    const targetUserId = safeId(req.params.userId);

    if (!organizationId || !targetUserId) {
      return res.status(400).json({
        success: false,
        code: 'INVALID_REQUEST',
      });
    }

    try {
      const authorization = await resolveActor(req, organizationId, deps);
      if (authorization.ok === false) {
        return res.status(authorization.status).json({
          success: false,
          code: authorization.code,
        });
      }

      const { actor } = authorization;

      // A workload preference belongs to the person. Leaders can consume the
      // signal but do not silently rewrite somebody else's limit/availability.
      if (actor.uid !== targetUserId) {
        return res.status(403).json({
          success: false,
          code: 'SERVEGUARD_SELF_WRITE_REQUIRED',
        });
      }

      if (!(await confirmTargetMembership(organizationId, targetUserId, deps))) {
        return res.status(404).json({
          success: false,
          code: 'TARGET_MEMBER_NOT_FOUND',
        });
      }

      const preference = normalizeServeGuardPreference({
        organizationId,
        userId: targetUserId,
        maxServicesPerWeek: req.body?.maxServicesPerWeek,
        maxServicesPerMonth: req.body?.maxServicesPerMonth,
        unavailableDates: req.body?.unavailableDates,
        pausedUntil: req.body?.pausedUntil,
        updatedAtMs: now(),
        updatedBy: actor.uid,
      });

      if (!preference) {
        return res.status(400).json({
          success: false,
          code: 'INVALID_SERVEGUARD_PREFERENCE',
        });
      }

      await savePreference(preference, deps.db);

      return res.status(200).json({
        success: true,
        organizationId,
        userId: targetUserId,
        preference,
      });
    } catch (error) {
      logger.error?.('[ServeGuard] preference write failed', {
        organizationId,
        targetUserId: maskIdentifier(targetUserId),
        error: error instanceof Error ? error.message : 'unknown_error',
      });
      return res.status(503).json({
        success: false,
        code: 'SERVICE_UNAVAILABLE',
      });
    }
  };

  const evaluate = async (req: Request, res: Response) => {
    privateNoStore(res);
    const organizationId = safeId(req.params.organizationId);
    const targetUserId = safeId(req.body?.userId);
    const candidateDate = safeDate(req.body?.candidateDate);
    const excludeScaleId = req.body?.excludeScaleId == null
      ? null
      : safeId(req.body.excludeScaleId);

    if (
      !organizationId ||
      !targetUserId ||
      !candidateDate ||
      (req.body?.excludeScaleId != null && !excludeScaleId)
    ) {
      return res.status(400).json({
        success: false,
        code: 'INVALID_REQUEST',
      });
    }

    try {
      const authorization = await resolveActor(req, organizationId, deps);
      if (authorization.ok === false) {
        return res.status(authorization.status).json({
          success: false,
          code: authorization.code,
        });
      }

      const { actor } = authorization;
      const self = actor.uid === targetUserId;

      if (!self && !actor.canManageSchedules) {
        return res.status(403).json({
          success: false,
          code: 'SERVEGUARD_EVALUATION_AUTHORITY_REQUIRED',
        });
      }

      if (!(await confirmTargetMembership(organizationId, targetUserId, deps))) {
        return res.status(404).json({
          success: false,
          code: 'TARGET_MEMBER_NOT_FOUND',
        });
      }

      const [preference, scales] = await Promise.all([
        loadPreference(organizationId, targetUserId, deps.db),
        loadScales(organizationId, deps.db),
      ]);

      const evaluation = evaluateServeGuard({
        organizationId,
        userId: targetUserId,
        candidateDate,
        preference,
        scales,
        excludeScaleId,
      });

      if (!evaluation) {
        return res.status(400).json({
          success: false,
          code: 'INVALID_SERVEGUARD_EVALUATION',
        });
      }

      logger.info?.('[ServeGuard] advisory evaluation', {
        organizationId,
        actorUid: maskIdentifier(actor.uid),
        targetUserId: maskIdentifier(targetUserId),
        candidateDate,
        primarySignal: evaluation.primarySignal,
        requiresExplicitOverride: evaluation.requiresExplicitOverride,
      });

      return res.status(200).json({
        success: true,
        organizationId,
        evaluation,
      });
    } catch (error) {
      logger.error?.('[ServeGuard] evaluation failed', {
        organizationId,
        targetUserId: maskIdentifier(targetUserId),
        error: error instanceof Error ? error.message : 'unknown_error',
      });
      return res.status(503).json({
        success: false,
        code: 'SERVICE_UNAVAILABLE',
      });
    }
  };

  const evaluateBatch = async (req: Request, res: Response) => {
    privateNoStore(res);
    const organizationId = safeId(req.params.organizationId);
    const candidateDate = safeDate(req.body?.candidateDate);
    const excludeScaleId = req.body?.excludeScaleId == null
      ? null
      : safeId(req.body.excludeScaleId);
    const rawUserIds: unknown[] = Array.isArray(req.body?.userIds)
      ? req.body.userIds
      : [];

    const normalizedUserIds: string[] = rawUserIds.map(value =>
      safeId(value),
    );
    const targetUserIds: string[] = Array.from(
      new Set(
        normalizedUserIds.filter(userId => userId.length > 0),
      ),
    );

    if (
      !organizationId ||
      !candidateDate ||
      rawUserIds.length === 0 ||
      rawUserIds.length > 100 ||
      normalizedUserIds.some(userId => !userId) ||
      targetUserIds.length === 0 ||
      (req.body?.excludeScaleId != null && !excludeScaleId)
    ) {
      return res.status(400).json({
        success: false,
        code: 'INVALID_REQUEST',
      });
    }

    try {
      const authorization = await resolveActor(req, organizationId, deps);
      if (authorization.ok === false) {
        return res.status(authorization.status).json({
          success: false,
          code: authorization.code,
        });
      }

      const { actor } = authorization;
      const onlySelf =
        targetUserIds.length === 1 &&
        targetUserIds[0] === actor.uid;

      if (!onlySelf && !actor.canManageSchedules) {
        return res.status(403).json({
          success: false,
          code: 'SERVEGUARD_EVALUATION_AUTHORITY_REQUIRED',
        });
      }

      const membershipResults = await Promise.all(
        targetUserIds.map(async userId => ({
          userId,
          active: await confirmTargetMembership(
            organizationId,
            userId,
            deps,
          ),
        })),
      );

      const activeUserIds = membershipResults
        .filter(item => item.active)
        .map(item => item.userId);
      const skippedUserIds = membershipResults
        .filter(item => !item.active)
        .map(item => item.userId);

      const scales = await loadScales(organizationId, deps.db);
      const preferences = await Promise.all(
        activeUserIds.map(async userId => ({
          userId,
          preference: await loadPreference(
            organizationId,
            userId,
            deps.db,
          ),
        })),
      );

      const evaluations = preferences
        .map(({ userId, preference }) =>
          evaluateServeGuard({
            organizationId,
            userId,
            candidateDate,
            preference,
            scales,
            excludeScaleId,
          }),
        )
        .filter(Boolean);

      logger.info?.('[ServeGuard] advisory batch evaluation', {
        organizationId,
        actorUid: maskIdentifier(actor.uid),
        candidateDate,
        requestedCount: targetUserIds.length,
        evaluatedCount: evaluations.length,
        skippedCount: skippedUserIds.length,
      });

      return res.status(200).json({
        success: true,
        organizationId,
        evaluations,
        skippedUserIds,
      });
    } catch (error) {
      logger.error?.('[ServeGuard] batch evaluation failed', {
        organizationId,
        requestedCount: targetUserIds.length,
        error: error instanceof Error ? error.message : 'unknown_error',
      });
      return res.status(503).json({
        success: false,
        code: 'SERVICE_UNAVAILABLE',
      });
    }
  };

  return {
    getPreference,
    putPreference,
    evaluate,
    evaluateBatch,
  };
}
