import { authorizeAiRequest, type InMemoryAiRateLimiter } from './aiRequestSecurity.js';
import * as crypto from 'crypto';

export interface FixChordsHandlerDeps {
  dbInstance: any;
  authInstance: any;
  rateLimiter: InMemoryAiRateLimiter;
  apiKey?: string;
  model?: string;
  logger: {
    info: (...args: any[]) => void;
    error: (...args: any[]) => void;
    warn: (...args: any[]) => void;
  };
  randomUUID?: () => string;
  generateContent: (params: { model: string; contents: any[]; config?: { abortSignal?: AbortSignal } }) => Promise<{ text: string }>;
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

      if (!deps.apiKey || deps.apiKey.trim() === '') {
        return logAndRespond(503, 'AI_PROVIDER_UNAVAILABLE');
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
        const textPrompt = `Você é um músico e especialista em cifras musicais.
Sua tarefa é receber a cifra de uma música e corrigi-la.
1. Remova lixo, dicionários de acordes no topo da página, notas do autor e tablaturas quebradas.
2. É estritamente necessário que os acordes fiquem em uma linha própria, separados por espaço, sem letras da música junto.
3. Mantenha a letra da música intacta e na linha de baixo dos acordes correspondentes.
4. Ajuste acordes deslocados ou formatos incorretos.
5. Se houver seções instrumentais (ex: Solo) só com acordes, NÃO apague a seção, mantenha a tag ([Solo]) e os acordes.
Instruções Extras: ${instructions || 'Faça um auto-reajuste padrão para a cifra ficar perfeita e remover lixos do início.'}
Retorne APENAS o texto da cifra corrigida, sem nenhum markdown ou formatação em volta, sem bloco \`\`\`.

Cifra original:
${chords}`;

        providerResponse = await deps.generateContent({
          model: deps.model || 'gemini-3.5-flash',
          contents: [{ role: 'user', parts: [{ text: textPrompt }] }],
          config: { abortSignal: controller.signal }
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
