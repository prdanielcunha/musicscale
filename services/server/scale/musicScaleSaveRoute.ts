import crypto from 'crypto';
import { logger } from '../../../lib/logger.js';
import { adminDb as db, admin } from '../../firebaseAdmin.js';
import { buildEffectiveAccessContext, hasMusicScaleCapability } from '../../../utils/rbac.js';
import { resolveOrganizationAuthorization } from '../organizationAuthorization.js';
import { MusicScaleCommandService } from './musicScaleCommandService.js';

export function registerMusicScaleSaveRoute(app: any): void {
  if (app.locals?.musicScaleSaveRouteRegistered) return;
  app.locals.musicScaleSaveRouteRegistered = true;

  app.patch('/api/v1/music-scales/:musicScaleId', async (req: any, res: any) => {
    const correlationId = crypto.randomUUID();
    const { musicScaleId } = req.params;

    try {
      const authHeader = req.headers.authorization || '';
      const orgId = req.headers['x-organization-id'] as string;
      const idempotencyKey = req.headers['idempotency-key'] as string;

      if (!authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'UNAUTHORIZED', correlationId });
      }
      if (!orgId) {
        return res.status(400).json({ error: 'X-Organization-Id is required', correlationId });
      }
      if (!idempotencyKey) {
        return res.status(400).json({ error: 'Idempotency-Key is required', correlationId });
      }

      const authorization = await resolveOrganizationAuthorization(authHeader, orgId, db, admin.auth());
      if (authorization.error || !authorization.context) {
        return res.status(authorization.statusCode || 403).json({
          error: authorization.error || 'FORBIDDEN',
          correlationId,
        });
      }

      const effectiveOrganizationRole = authorization.context.isOwner
        ? 'owner'
        : authorization.context.organizationRole || null;
      const access = buildEffectiveAccessContext(
        authorization.context.uid,
        orgId,
        authorization.context.systemRole,
        effectiveOrganizationRole,
        authorization.context.isActive ? 'active' : 'inactive'
      );
      const hasGlobalAccess = access.isGlobalFullAccess;

      if (
        (!authorization.context.isActive && !hasGlobalAccess) ||
        !hasMusicScaleCapability(access, 'scales.update')
      ) {
        return res.status(403).json({
          error: 'FORBIDDEN',
          code: 'PERMISSION_DENIED',
          correlationId,
        });
      }

      const result = await MusicScaleCommandService.saveMusicScale({
        authUid: authorization.context.uid,
        orgId,
        musicScaleId,
        idempotencyKey,
        payload: req.body,
        correlationId,
      });
      return res.status(200).json(result);
    } catch (error: any) {
      const knownErrors: Record<string, number> = {
        VALIDATION_ERROR: 400,
        PAYLOAD_CONFLICT: 400,
        TENANT_SCOPE_MISMATCH: 403,
        NOT_FOUND: 404,
        IDEMPOTENCY_CONFLICT: 409,
        BAND_SCALE_ALREADY_LINKED: 409,
      };
      const code = typeof error.code === 'string' && knownErrors[error.code]
        ? error.code
        : 'SAVE_FAILED';
      const status = knownErrors[code] || 500;

      logger.error(`[MusicScale Command] Save failed | Correlation ID: ${correlationId}`, error);
      return res.status(status).json({ error: code, code, correlationId });
    }
  });
}
