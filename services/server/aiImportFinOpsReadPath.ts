import {
  AI_IMPORT_FEATURE_KEY,
  AI_IMPORT_ENDPOINT_KEY,
  AiPlan,
  AiSourceType,
  AiFirestorePaths,
  buildAiImportIdempotencyKey,
  buildAiImportCacheKey,
  buildAiRateLimitBucketKey,
  buildAiFirestorePaths,
  getAiPeriodKeys,
  extractSafeSourceHost,
  estimateTokensFromChars
} from "./aiFinOpsPolicy.js";
import { AiFinOpsStorageAdapter } from "./aiFinOpsRepository.js";
import { resolveAiImportFinOpsOutcome } from "./aiImportFinOpsOutcomeMapper.js";

export interface ResolveAiImportFinOpsReadPathInput {
  adapter: AiFinOpsStorageAdapter;
  organizationId: string;
  uid: string;
  rawText?: string | null;
  url?: string | null;
  desiredKey?: string | null;
  version?: string | null;
  bpm?: string | number | null;
  model: string;
  plan: AiPlan;
  secret: string;
  now?: Date | string | number;
  estimatedInputChars?: number | null;
}

export type AiImportFinOpsReadPathDecisionStatus =
  | "CACHE_HIT"
  | "IDEMPOTENCY_COMPLETED"
  | "IDEMPOTENCY_PROCESSING"
  | "MISS"
  | "DISABLED_OR_INVALID";

export interface AiImportFinOpsReadPathDecision {
  status: AiImportFinOpsReadPathDecisionStatus;
  paths: AiFirestorePaths | null;
  idempotencyKey: string | null;
  cacheKey: string | null;
  rateLimitBucketKey: string | null;
  sourceType: AiSourceType;
  sourceHost: string | null;
  estimatedInputTokens: number;
  cacheDoc?: Record<string, unknown> | null;
  idempotencyDoc?: Record<string, unknown> | null;
  outcome: ReturnType<typeof resolveAiImportFinOpsOutcome>["outcome"];
  shouldConsumeQuota: boolean;
  safeErrorCode: string | null;
}

const FORBIDDEN_FIELDS = [
  "rawText",
  "prompt",
  "url",
  "sourceUrl",
  "lyrics",
  "chords",
  "cleanLyrics",
  "cleanChords",
  "headers",
  "cookies",
  "authorization",
  "token",
  "stack",
  "message"
];

export function sanitizeFinOpsReadPathDoc(doc: unknown): Record<string, unknown> | null {
  if (typeof doc !== "object" || doc === null || Array.isArray(doc)) {
    return null;
  }

  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(doc)) {
    if (FORBIDDEN_FIELDS.includes(key)) {
      continue;
    }
    
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      result[key] = sanitizeFinOpsReadPathDoc(value);
    } else {
      result[key] = value;
    }
  }

  return result;
}

export async function resolveAiImportFinOpsReadPath(
  input: ResolveAiImportFinOpsReadPathInput
): Promise<AiImportFinOpsReadPathDecision> {
  const {
    adapter,
    organizationId,
    uid,
    rawText,
    url,
    desiredKey,
    version,
    bpm,
    model,
    plan,
    secret,
    now,
    estimatedInputChars
  } = input;

  if (!organizationId || organizationId.includes("/") || !uid || !model || !secret) {
    const outcomeResult = resolveAiImportFinOpsOutcome({ errorCode: "INVALID_PARAMETERS" });
    return {
      status: "DISABLED_OR_INVALID",
      paths: null,
      idempotencyKey: null,
      cacheKey: null,
      rateLimitBucketKey: null,
      sourceType: "rawText",
      sourceHost: null,
      estimatedInputTokens: 0,
      outcome: "PAYLOAD_INVALID",
      shouldConsumeQuota: false,
      safeErrorCode: "INVALID_PARAMETERS"
    };
  }

  const sourceType: AiSourceType = (url && !rawText) ? "url" : "rawText";
  const sourceHost = sourceType === "url" ? extractSafeSourceHost(url || "") : null;
  
  let charsToEstimate = 0;
  if (estimatedInputChars !== undefined && estimatedInputChars !== null) {
    charsToEstimate = estimatedInputChars;
  } else {
    charsToEstimate = rawText ? rawText.length : (url ? url.length : 0);
  }
  const estimatedInputTokens = estimateTokensFromChars(charsToEstimate);

  const periodKeys = getAiPeriodKeys(now);

  const idempotencyInput = {
    organizationId,
    userId: uid,
    feature: "aiImport" as const,
    sourceType,
    rawText: rawText || undefined,
    url: url || undefined,
    desiredKey: desiredKey || undefined,
    version: version || undefined,
    bpm: bpm || undefined,
    model: model || undefined
  };

  const idempotencyKey = buildAiImportIdempotencyKey(idempotencyInput, { secret });

  const cacheKey = buildAiImportCacheKey(idempotencyInput, { secret });

  const rateLimitBucketKey = buildAiRateLimitBucketKey({
    organizationId,
    uid,
    endpoint: AI_IMPORT_ENDPOINT_KEY,
    windowKey: periodKeys.dayKey
  });

  const paths = buildAiFirestorePaths({
    organizationId,
    periodKeys,
    idempotencyKey,
    cacheKey,
    rateLimitBucketKey
  });

  try {
    const readResult = await adapter.runTransaction(async (tx) => {
      const cacheStored = await tx.get(paths.cacheDocPath);
      const idempotencyStored = await tx.get(paths.idempotencyDocPath);
      return {
        cacheDoc: cacheStored ? cacheStored.data : null,
        idempotencyDoc: idempotencyStored ? idempotencyStored.data : null
      };
    });

    const { cacheDoc, idempotencyDoc } = readResult;

    if (
      cacheDoc &&
      (cacheDoc.status === "HIT" || cacheDoc.status === "COMPLETED" || cacheDoc.cacheSummary || cacheDoc.result)
    ) {
      return {
        status: "CACHE_HIT",
        paths,
        idempotencyKey,
        cacheKey,
        rateLimitBucketKey,
        sourceType,
        sourceHost,
        estimatedInputTokens,
        cacheDoc: sanitizeFinOpsReadPathDoc(cacheDoc),
        outcome: "CACHE_HIT",
        shouldConsumeQuota: false,
        safeErrorCode: null
      };
    }

    if (idempotencyDoc) {
      if (idempotencyDoc.status === "COMPLETED") {
        return {
          status: "IDEMPOTENCY_COMPLETED",
          paths,
          idempotencyKey,
          cacheKey,
          rateLimitBucketKey,
          sourceType,
          sourceHost,
          estimatedInputTokens,
          idempotencyDoc: sanitizeFinOpsReadPathDoc(idempotencyDoc),
          outcome: "IDEMPOTENCY_HIT",
          shouldConsumeQuota: false,
          safeErrorCode: null
        };
      }
      if (idempotencyDoc.status === "PROCESSING" || idempotencyDoc.status === "IN_PROGRESS") {
        return {
          status: "IDEMPOTENCY_PROCESSING",
          paths,
          idempotencyKey,
          cacheKey,
          rateLimitBucketKey,
          sourceType,
          sourceHost,
          estimatedInputTokens,
          idempotencyDoc: sanitizeFinOpsReadPathDoc(idempotencyDoc),
          outcome: "IDEMPOTENCY_HIT",
          shouldConsumeQuota: false,
          safeErrorCode: null
        };
      }
    }

    const outcomeResult = resolveAiImportFinOpsOutcome({ ok: true }); // Neutral placeholder for MISS
    return {
      status: "MISS",
      paths,
      idempotencyKey,
      cacheKey,
      rateLimitBucketKey,
      sourceType,
      sourceHost,
      estimatedInputTokens,
      outcome: outcomeResult.outcome,
      shouldConsumeQuota: outcomeResult.shouldConsumeQuota,
      safeErrorCode: null
    };
  } catch (error) {
    return {
      status: "DISABLED_OR_INVALID",
      paths,
      idempotencyKey,
      cacheKey,
      rateLimitBucketKey,
      sourceType,
      sourceHost,
      estimatedInputTokens,
      outcome: "PAYLOAD_INVALID",
      shouldConsumeQuota: false,
      safeErrorCode: "READ_PATH_ERROR"
    };
  }
}
