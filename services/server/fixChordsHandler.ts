import { authorizeAiRequest, type InMemoryAiRateLimiter } from './aiRequestSecurity.js';
import * as crypto from 'crypto';

export interface FixChordsHandlerDeps {
  dbInstance: any;
  authInstance: any;
  rateLimiter: InMemoryAiRateLimiter;
  logger: {
    info: (...args: any[]) => void;
    error: (...args: any[]) => void;
    warn: (...args: any[]) => void;
  };
  randomUUID?: () => string;
  generateContent: (params: {
    model: string;
    contents: any[];
    config?: { abortSignal?: AbortSignal };
    request: any;
    organizationId: string;
    task: 'musicscale.chords.repair';
    input: { chords: string; instructions?: string };
  }) => Promise<{ text: string }>;
  scheduleTimeout?: (callback: () => void, delayMs: number) => unknown;
  cancelTimeout?: (handle: unknown) => void;
}

export function createFixChordsHandler(deps: FixChordsHandlerDeps) {
  return async (req: any, res: any) => {
    const randomUUID = deps.randomUUID || crypto.randomUUID.bind(crypto);
    const correlationId = randomUUID();
    const startTime = Date.now();
    let slot: { release: () => void } | null = null;
    let authUid = 'unknown';
    let authOrgId = 'unknown';
    let chordsLen = 0;
    let instructionsLen = 0;

    const logAndRespond = (statusCode: number, errorMsg: string) => {
      deps.logger.info(`[fix-chords] End ${correlationId} - uid:${authUid} org:${authOrgId} chordsLen:${chordsLen} instLen:${instructionsLen} dur:${Date.now() - startTime}ms code:${statusCode}`);
      return res.status(statusCode).json({ error: errorMsg });
    };

    try {
      const { organizationId, chords, instructions, userId } = req.body || {};
      const authHeader = req.headers.authorization;

      const authRes = await authorizeAiRequest({
        authHeader,
        organizationId,
        claimedUserId: userId,
        requiredFeature: 'aiStructuring',
        requiredAnyPermissions: ['canManageChords', 'canManageRepertoire'],
        dbInstance: deps.dbInstance,
        authInstance: deps.authInstance
      });

      if (!authRes.ok) {
        const err = authRes as { ok: false, statusCode: number, error: string };
        return logAndRespond(err.statusCode, err.error);
      }
      authUid = authRes.context.uid;
      authOrgId = authRes.context.organizationId;

      if (!organizationId || typeof organizationId !== 'string' || organizationId.trim() === '') {
        return logAndRespond(422, 'INVALID_AI_PAYLOAD');
      }
      if (typeof chords !== 'string' || chords.trim() === '' || chords.length > 60000) {
        return logAndRespond(422, 'INVALID_AI_PAYLOAD');
      }
      chordsLen = chords.length;
      if (instructions !== undefined) {
        if (typeof instructions !== 'string' || instructions.length > 2000) {
          return logAndRespond(422, 'INVALID_AI_PAYLOAD');
        }
        instructionsLen = instructions.length;
      }

      const rateLimitRes = deps.rateLimiter.acquire({
        uid: authUid,
        organizationId: authOrgId,
        endpointKey: 'fix-chords'
      });
      if (!rateLimitRes.ok) {
        const err = rateLimitRes as { ok: false, statusCode: number, error: string };
        return logAndRespond(err.statusCode, err.error);
      }
      slot = rateLimitRes as { ok: true, release: () => void };

      const controller = new AbortController();
      const sched = deps.scheduleTimeout || ((cb, d) => setTimeout(cb, d));
      const canc = deps.cancelTimeout || ((h) => clearTimeout(h as ReturnType<typeof setTimeout>));
      
      const timeoutId = sched(() => controller.abort(), 30000);
      let providerResponse: { text: string } | null = null;
      try {
        providerResponse = await deps.generateContent({
          model: 'nestai-managed',
          contents: [],
          config: { abortSignal: controller.signal },
          request: req,
          organizationId: authOrgId,
          task: 'musicscale.chords.repair',
          input: {
            chords,
            ...(typeof instructions === 'string' && instructions.trim() ? { instructions } : {})
          }
        });
      } catch (err: any) {
        if (controller.signal.aborted || err?.name === 'AbortError') {
          return logAndRespond(504, 'AI_PROVIDER_TIMEOUT');
        }
        deps.logger.error("[fix-chords] Provider failure", {
          correlationId,
          uid: authUid,
          organizationId: authOrgId,
          endpoint: "fix-chords",
          code: "AI_PROVIDER_UNAVAILABLE",
          durationMs: Date.now() - startTime
        });
        return logAndRespond(503, 'AI_PROVIDER_UNAVAILABLE');
      } finally {
        canc(timeoutId);
      }

      if (!providerResponse || typeof providerResponse.text !== 'string' || providerResponse.text.trim() === '') {
        return logAndRespond(502, 'AI_PROVIDER_INVALID_RESPONSE');
      }

      deps.logger.info(`[fix-chords] End ${correlationId} - uid:${authUid} org:${authOrgId} chordsLen:${chordsLen} instLen:${instructionsLen} dur:${Date.now() - startTime}ms code:200`);
      return res.json({ fixedChords: providerResponse.text });

    } catch (error: any) {
      deps.logger.error("[fix-chords] Internal failure", {
        correlationId,
        uid: authUid,
        organizationId: authOrgId,
        endpoint: "fix-chords",
        code: "INTERNAL_AI_ERROR",
        durationMs: Date.now() - startTime
      });
      if (!res.headersSent) {
        return res.status(500).json({ error: 'INTERNAL_AI_ERROR' });
      }
    } finally {
      if (slot) {
        slot.release();
      }
    }
  };
}
