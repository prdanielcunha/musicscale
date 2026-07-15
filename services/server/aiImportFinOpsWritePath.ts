import {
  AiFinOpsStorageAdapter,
  AiFinOpsRepositoryInput,
  beginAiFinOpsReservation,
  finalizeAiFinOpsReservation,
} from "./aiFinOpsRepository.js";
import {
  AiPlan,
  AiSourceType,
  AiUsageOutcome,
  estimateTokensFromChars,
} from "./aiFinOpsPolicy.js";
import {
  resolveAiImportFinOpsReadPath,
  AiImportFinOpsReadPathDecision,
} from "./aiImportFinOpsReadPath.js";
import { sanitizeAiImportFinOpsErrorCode } from "./aiImportFinOpsOutcomeMapper.js";

export interface BeginAiImportFinOpsWritePathInput {
  adapter: AiFinOpsStorageAdapter;
  requestId: string;
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

export type AiImportFinOpsWritePathBeginStatus =
  | "RESERVED"
  | "IDEMPOTENCY_IN_FLIGHT"
  | "IDEMPOTENCY_COMPLETED"
  | "QUOTA_BLOCKED"
  | "DISABLED_OR_INVALID"
  | "ERROR";

export interface AiImportFinOpsWritePathContext {
  adapter: AiFinOpsStorageAdapter;
  repositoryInput: AiFinOpsRepositoryInput;
  estimatedInputTokens: number;
  sourceType: AiSourceType;
  sourceHost: string | null;
  startedAtMs?: number | null;
}

export interface BeginAiImportFinOpsWritePathResult {
  status: AiImportFinOpsWritePathBeginStatus;
  context: AiImportFinOpsWritePathContext | null;
  safeSummary: {
    status: AiImportFinOpsWritePathBeginStatus;
    sourceType: AiSourceType | "UNKNOWN";
    sourceHost: string | null;
    estimatedInputTokens: number;
    hasPaths: boolean;
    hasIdempotencyKey: boolean;
    hasCacheKey: boolean;
    hasRateLimitBucketKey: boolean;
    quotaStatusCode?: number | null;
    safeErrorCode: string | null;
  };
}

export interface FinalizeAiImportFinOpsWritePathInput {
  context: AiImportFinOpsWritePathContext | null;
  outcome: AiUsageOutcome;
  estimatedOutputChars?: number | null;
  estimatedOutputTokens?: number | null;
  durationMs?: number | null;
  errorCode?: string | null;
  cacheSummary?: {
    title?: string | null;
    artist?: string | null;
    hasLyrics?: boolean | null;
    hasChords?: boolean | null;
  } | null;
}

export interface FinalizeAiImportFinOpsWritePathResult {
  ok: boolean;
  skipped: boolean;
  safeSummary: {
    attempted: boolean;
    finalized: boolean;
    skipped: boolean;
    outcome: AiUsageOutcome | null;
    estimatedInputTokens: number;
    estimatedOutputTokens: number;
    shouldHaveContext: boolean;
    safeErrorCode: string | null;
  };
}

export function buildSafeAiImportFinOpsCacheSummary(input: unknown): {
  title?: string;
  artist?: string;
  hasLyrics?: boolean;
  hasChords?: boolean;
} {
  const result: { title?: string; artist?: string; hasLyrics?: boolean; hasChords?: boolean } = {};
  
  if (typeof input === "object" && input !== null) {
    const raw = input as Record<string, any>;
    
    if (typeof raw.title === "string") {
      result.title = raw.title.substring(0, 120);
    }
    if (typeof raw.artist === "string") {
      result.artist = raw.artist.substring(0, 120);
    }
    if (typeof raw.hasLyrics === "boolean") {
      result.hasLyrics = raw.hasLyrics;
    }
    if (typeof raw.hasChords === "boolean") {
      result.hasChords = raw.hasChords;
    }
  }
  
  return result;
}

export function estimateAiImportOutputTokens(input: {
  estimatedOutputChars?: number | null;
  estimatedOutputTokens?: number | null;
}): number {
  if (typeof input.estimatedOutputTokens === "number" && input.estimatedOutputTokens > 0) {
    return Math.floor(input.estimatedOutputTokens);
  }
  if (typeof input.estimatedOutputChars === "number" && input.estimatedOutputChars > 0) {
    return estimateTokensFromChars(input.estimatedOutputChars);
  }
  return 0;
}

export async function beginAiImportFinOpsWritePath(
  input: BeginAiImportFinOpsWritePathInput
): Promise<BeginAiImportFinOpsWritePathResult> {
  try {
    if (
      !input.adapter ||
      !input.requestId ||
      !input.organizationId ||
      input.organizationId.includes("/") ||
      !input.uid ||
      !input.model ||
      !input.secret
    ) {
      return {
        status: "DISABLED_OR_INVALID",
        context: null,
        safeSummary: {
          status: "DISABLED_OR_INVALID",
          sourceType: "UNKNOWN",
          sourceHost: null,
          estimatedInputTokens: 0,
          hasPaths: false,
          hasIdempotencyKey: false,
          hasCacheKey: false,
          hasRateLimitBucketKey: false,
          safeErrorCode: "INVALID_PARAMETERS",
        },
      };
    }

    let decision: AiImportFinOpsReadPathDecision;
    try {
      decision = await resolveAiImportFinOpsReadPath({
        adapter: input.adapter,
        organizationId: input.organizationId,
        uid: input.uid,
        rawText: input.rawText,
        url: input.url,
        desiredKey: input.desiredKey,
        version: input.version,
        bpm: input.bpm,
        model: input.model,
        plan: input.plan,
        secret: input.secret,
        now: input.now,
        estimatedInputChars: input.estimatedInputChars,
      });
    } catch (err: any) {
      return {
        status: "ERROR",
        context: null,
        safeSummary: {
          status: "ERROR",
          sourceType: "UNKNOWN",
          sourceHost: null,
          estimatedInputTokens: 0,
          hasPaths: false,
          hasIdempotencyKey: false,
          hasCacheKey: false,
          hasRateLimitBucketKey: false,
          safeErrorCode: "READ_PATH_ERROR",
        },
      };
    }

    if (
      decision.status === "DISABLED_OR_INVALID" ||
      !decision.paths ||
      !decision.idempotencyKey
    ) {
      return {
        status: "DISABLED_OR_INVALID",
        context: null,
        safeSummary: {
          status: "DISABLED_OR_INVALID",
          sourceType: decision.sourceType,
          sourceHost: decision.sourceHost,
          estimatedInputTokens: decision.estimatedInputTokens,
          hasPaths: !!decision.paths,
          hasIdempotencyKey: !!decision.idempotencyKey,
          hasCacheKey: !!decision.cacheKey,
          hasRateLimitBucketKey: !!decision.rateLimitBucketKey,
          safeErrorCode: decision.safeErrorCode || "DISABLED_OR_INVALID_READ_PATH",
        },
      };
    }

    const normalizedInputChars =
      typeof input.estimatedInputChars === "number" && input.estimatedInputChars > 0
        ? Math.floor(input.estimatedInputChars)
        : typeof input.rawText === "string"
        ? input.rawText.length
        : typeof input.url === "string"
        ? input.url.length
        : 0;

    const repoInput: AiFinOpsRepositoryInput = {
      adapter: input.adapter,
      paths: decision.paths,
      organizationId: input.organizationId,
      uid: input.uid,
      requestId: input.requestId,
      idempotencyKey: decision.idempotencyKey,
      cacheKey: decision.cacheKey,
      sourceType: decision.sourceType,
      sourceHost: decision.sourceHost,
      model: input.model,
      plan: input.plan,
      inputChars: normalizedInputChars,
    };

    if (
      decision.status === "CACHE_HIT" ||
      decision.status === "IDEMPOTENCY_COMPLETED"
    ) {
      return {
        status: "IDEMPOTENCY_COMPLETED",
        context: null,
        safeSummary: {
          status: "IDEMPOTENCY_COMPLETED",
          sourceType: decision.sourceType,
          sourceHost: decision.sourceHost,
          estimatedInputTokens: decision.estimatedInputTokens,
          hasPaths: true,
          hasIdempotencyKey: true,
          hasCacheKey: !!decision.cacheKey,
          hasRateLimitBucketKey: !!decision.rateLimitBucketKey,
          safeErrorCode: null,
        },
      };
    }

    if (decision.status === "IDEMPOTENCY_PROCESSING") {
      return {
        status: "IDEMPOTENCY_IN_FLIGHT",
        context: null,
        safeSummary: {
          status: "IDEMPOTENCY_IN_FLIGHT",
          sourceType: decision.sourceType,
          sourceHost: decision.sourceHost,
          estimatedInputTokens: decision.estimatedInputTokens,
          hasPaths: true,
          hasIdempotencyKey: true,
          hasCacheKey: !!decision.cacheKey,
          hasRateLimitBucketKey: !!decision.rateLimitBucketKey,
          safeErrorCode: null,
        },
      };
    }

    let repoResult;
    try {
      repoResult = await beginAiFinOpsReservation(repoInput);
    } catch (err: any) {
      return {
        status: "ERROR",
        context: null,
        safeSummary: {
          status: "ERROR",
          sourceType: decision.sourceType,
          sourceHost: decision.sourceHost,
          estimatedInputTokens: decision.estimatedInputTokens,
          hasPaths: true,
          hasIdempotencyKey: true,
          hasCacheKey: !!decision.cacheKey,
          hasRateLimitBucketKey: !!decision.rateLimitBucketKey,
          safeErrorCode: "BEGIN_RESERVATION_ERROR",
        },
      };
    }

    let status: AiImportFinOpsWritePathBeginStatus = "ERROR";
    let context: AiImportFinOpsWritePathContext | null = null;
    let safeErrorCode: string | null = null;

    if (repoResult.status === "RESERVED") {
      status = "RESERVED";
      context = {
        adapter: input.adapter,
        repositoryInput: repoInput,
        estimatedInputTokens: decision.estimatedInputTokens,
        sourceType: decision.sourceType,
        sourceHost: decision.sourceHost,
        startedAtMs: typeof input.now === "number" ? input.now : Date.parse(String(input.now)) || undefined,
      };
    } else if (repoResult.status === "IDEMPOTENCY_IN_FLIGHT") {
      status = "IDEMPOTENCY_IN_FLIGHT";
    } else if (repoResult.status === "IDEMPOTENCY_COMPLETED") {
      status = "IDEMPOTENCY_COMPLETED";
    } else if (repoResult.status === "QUOTA_BLOCKED") {
      status = "QUOTA_BLOCKED";
      safeErrorCode = sanitizeAiImportFinOpsErrorCode(repoResult.quotaDecision?.code) || "QUOTA_BLOCKED";
    }

    return {
      status,
      context,
      safeSummary: {
        status,
        sourceType: decision.sourceType,
        sourceHost: decision.sourceHost,
        estimatedInputTokens: decision.estimatedInputTokens,
        hasPaths: true,
        hasIdempotencyKey: true,
        hasCacheKey: !!decision.cacheKey,
        hasRateLimitBucketKey: !!decision.rateLimitBucketKey,
        quotaStatusCode: repoResult.quotaDecision?.statusCode ?? null,
        safeErrorCode,
      },
    };
  } catch (err: any) {
    return {
      status: "ERROR",
      context: null,
      safeSummary: {
        status: "ERROR",
        sourceType: "UNKNOWN",
        sourceHost: null,
        estimatedInputTokens: 0,
        hasPaths: false,
        hasIdempotencyKey: false,
        hasCacheKey: false,
        hasRateLimitBucketKey: false,
        safeErrorCode: "UNEXPECTED_ERROR",
      },
    };
  }
}

export async function finalizeAiImportFinOpsWritePath(
  input: FinalizeAiImportFinOpsWritePathInput
): Promise<FinalizeAiImportFinOpsWritePathResult> {
  try {
    if (!input.context) {
      return {
        ok: true,
        skipped: true,
        safeSummary: {
          attempted: false,
          finalized: false,
          skipped: true,
          outcome: null,
          estimatedInputTokens: 0,
          estimatedOutputTokens: 0,
          shouldHaveContext: false,
          safeErrorCode: null,
        },
      };
    }

    const { context, outcome, durationMs, errorCode } = input;
    
    const estimatedOutputTokens = estimateAiImportOutputTokens({
      estimatedOutputChars: input.estimatedOutputChars,
      estimatedOutputTokens: input.estimatedOutputTokens,
    });

    const safeErrorCode = sanitizeAiImportFinOpsErrorCode(errorCode);
    
    let safeCacheSummary: any = undefined;
    if (outcome === "SUCCESS" && input.cacheSummary) {
      safeCacheSummary = buildSafeAiImportFinOpsCacheSummary(input.cacheSummary);
    }

    await finalizeAiFinOpsReservation({
      ...context.repositoryInput,
      outcome,
      estimatedInputTokens: context.estimatedInputTokens,
      estimatedOutputTokens,
      durationMs: typeof durationMs === "number" ? durationMs : undefined,
      errorCode: safeErrorCode,
      cacheSummary: safeCacheSummary,
    });

    return {
      ok: true,
      skipped: false,
      safeSummary: {
        attempted: true,
        finalized: true,
        skipped: false,
        outcome,
        estimatedInputTokens: context.estimatedInputTokens,
        estimatedOutputTokens,
        shouldHaveContext: true,
        safeErrorCode,
      },
    };
  } catch (err: any) {
    return {
      ok: false,
      skipped: false,
      safeSummary: {
        attempted: true,
        finalized: false,
        skipped: false,
        outcome: input.outcome || null,
        estimatedInputTokens: input.context?.estimatedInputTokens || 0,
        estimatedOutputTokens: 0,
        shouldHaveContext: !!input.context,
        safeErrorCode: "FINALIZE_ERROR",
      },
    };
  }
}
