import {
  AI_FINOPS_POLICY_VERSION,
  AI_TOKEN_ESTIMATION_CHARS_PER_TOKEN,
  AiPlan,
  AiSourceType,
  AiUsageOutcome,
  AiQuotaLimits,
  AiUsageSnapshot,
  AiQuotaDecision,
  AiPeriodKeys,
  AiFirestorePaths,
  AiFinOpsEvent,
  resolveAiQuotaLimits,
  getAiPeriodKeys,
  estimateTokensFromChars,
  buildAiFinOpsEvent,
  evaluateAiQuota,
  shouldConsumeQuotaForOutcome,
} from "./aiFinOpsPolicy.js";

// --- TYPES & INTERFACES ---

export type AiIdempotencyStatus = "PROCESSING" | "COMPLETED" | "FAILED" | "EXPIRED";

export interface AiUsageCounters {
  requestCount: number;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  estimatedTotalTokens: number;
  updatedAtIso?: string;
  createdAtIso?: string;
}

export interface AiIdempotencyRecord {
  idempotencyKey: string;
  status: AiIdempotencyStatus;
  requestId: string;
  createdAtIso: string;
  updatedAtIso: string;
  expiresAtIso: string;
  outcome?: string;
  cacheKey?: string;
  eventPath?: string;
}

export interface AiCacheRecord {
  cacheKey: string;
  status: "READY";
  requestId: string;
  createdAtIso: string;
  expiresAtIso: string;
  sourceType: AiSourceType;
  sourceHost?: string | null;
  model: string;
  policyVersion: string;
  resultSummary?: {
    title?: string;
    artist?: string;
    hasLyrics?: boolean;
    hasChords?: boolean;
  };
}

export interface AiFinOpsRepositoryInput {
  adapter: AiFinOpsStorageAdapter;
  paths: AiFirestorePaths;
  requestId: string;
  organizationId: string;
  uid: string;
  idempotencyKey: string;
  cacheKey: string;
  sourceType: AiSourceType;
  sourceHost?: string | null;
  model: string;
  plan: AiPlan;
  inputChars?: number;
  overrides?: Partial<AiQuotaLimits>;
}

// --- FAKE STORAGE / TRANSACTION CONTRACT ---

export interface AiFinOpsStoredDocument {
  [key: string]: any;
}

export interface AiFinOpsTransactionAdapter {
  get(path: string): Promise<AiFinOpsStoredDocument | null>;
  create(path: string, data: Record<string, unknown>): Promise<void>;
  set(path: string, data: Record<string, unknown>, options?: { merge?: boolean }): Promise<void>;
  update(path: string, data: Record<string, unknown>): Promise<void>;
}

export interface AiFinOpsStorageAdapter {
  runTransaction<T>(fn: (tx: AiFinOpsTransactionAdapter) => Promise<T>): Promise<T>;
}

// --- ERROR CODES ---
export const AI_FINOPS_REPOSITORY_ERRORS = {
  PRIVATE_FIELD_FORBIDDEN: "AI_FINOPS_REPOSITORY_PRIVATE_FIELD_FORBIDDEN",
  INVALID_PATH: "AI_FINOPS_REPOSITORY_INVALID_PATH",
  INVALID_COUNTERS: "AI_FINOPS_REPOSITORY_INVALID_COUNTERS",
  IDEMPOTENCY_CONFLICT: "AI_FINOPS_REPOSITORY_IDEMPOTENCY_CONFLICT",
  INVALID_EVENT: "AI_FINOPS_REPOSITORY_INVALID_EVENT",
};

// --- FUNCTIONS ---

/**
 * Creates empty/zeroed usage counters.
 */
export function createEmptyUsageCounters(): AiUsageCounters {
  return {
    requestCount: 0,
    estimatedInputTokens: 0,
    estimatedOutputTokens: 0,
    estimatedTotalTokens: 0,
  };
}

/**
 * Safely normalizes usage counters from raw database payload.
 */
export function normalizeUsageCounters(data: any): AiUsageCounters {
  if (!data || typeof data !== "object") {
    return createEmptyUsageCounters();
  }

  const cleanNum = (val: any): number => {
    if (typeof val !== "number" || isNaN(val) || val < 0) {
      return 0;
    }
    return Math.floor(val);
  };

  return {
    requestCount: cleanNum(data.requestCount),
    estimatedInputTokens: cleanNum(data.estimatedInputTokens),
    estimatedOutputTokens: cleanNum(data.estimatedOutputTokens),
    estimatedTotalTokens: cleanNum(data.estimatedTotalTokens),
    createdAtIso: typeof data.createdAtIso === "string" ? data.createdAtIso : undefined,
    updatedAtIso: typeof data.updatedAtIso === "string" ? data.updatedAtIso : undefined,
  };
}

/**
 * Builds increments for reservation counters.
 */
export function buildUsageIncrement(input: {
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
}): any {
  const inputTokens = Math.max(0, Math.floor(input.estimatedInputTokens || 0));
  const outputTokens = Math.max(0, Math.floor(input.estimatedOutputTokens || 0));

  return {
    requestCount: 1,
    estimatedInputTokens: inputTokens,
    estimatedOutputTokens: outputTokens,
    estimatedTotalTokens: inputTokens + outputTokens,
  };
}

/**
 * Reads and maps monthly and daily usage snapshotted counters.
 */
export async function readAiUsageSnapshot(
  tx: AiFinOpsTransactionAdapter,
  paths: AiFirestorePaths
): Promise<AiUsageSnapshot> {
  if (!paths.monthlyUsageDocPath || !paths.dailyUsageDocPath) {
    throw new Error(AI_FINOPS_REPOSITORY_ERRORS.INVALID_PATH);
  }

  const [monthlyDoc, dailyDoc] = await Promise.all([
    tx.get(paths.monthlyUsageDocPath),
    tx.get(paths.dailyUsageDocPath),
  ]);

  const monthlyCounters = normalizeUsageCounters(monthlyDoc);
  const dailyCounters = normalizeUsageCounters(dailyDoc);

  return {
    monthlyRequestCount: monthlyCounters.requestCount,
    dailyRequestCount: dailyCounters.requestCount,
    monthlyEstimatedTokens: monthlyCounters.estimatedInputTokens,
    dailyEstimatedTokens: dailyCounters.estimatedInputTokens,
  };
}

/**
 * Creates processing idempotency record.
 */
export function createProcessingIdempotencyRecord(input: {
  idempotencyKey: string;
  requestId: string;
  cacheKey: string;
  expirationSeconds?: number;
}): AiIdempotencyRecord {
  const now = new Date();
  const seconds = input.expirationSeconds !== undefined ? input.expirationSeconds : 300; // default 5 minutes
  const expires = new Date(now.getTime() + seconds * 1000);

  return {
    idempotencyKey: input.idempotencyKey,
    status: "PROCESSING",
    requestId: input.requestId,
    createdAtIso: now.toISOString(),
    updatedAtIso: now.toISOString(),
    expiresAtIso: expires.toISOString(),
    cacheKey: input.cacheKey,
  };
}

/**
 * Classifies the state of an existing idempotency record relative to now.
 */
export function classifyExistingIdempotencyRecord(
  record: AiIdempotencyRecord | null,
  now: Date
): "MISS" | "IN_FLIGHT" | "COMPLETED" | "FAILED_RETRY_ALLOWED" | "EXPIRED" {
  if (!record) {
    return "MISS";
  }

  const expiresAt = new Date(record.expiresAtIso);
  if (isNaN(expiresAt.getTime()) || expiresAt < now) {
    return "EXPIRED";
  }

  if (record.status === "PROCESSING") {
    return "IN_FLIGHT";
  }

  if (record.status === "COMPLETED") {
    return "COMPLETED";
  }

  if (record.status === "FAILED") {
    return "FAILED_RETRY_ALLOWED";
  }

  return "MISS";
}

/**
 * Sanitize result summary for caching to ensure zero leak of sensitive data.
 */
export function sanitizeCacheResultSummary(input: any): any {
  if (!input || typeof input !== "object") {
    return {};
  }

  // Strictly check forbidden keys before any processing
  assertRepositoryPayloadIsPrivate(input);

  const title = typeof input.title === "string" ? input.title.trim().slice(0, 120) : undefined;
  const artist = typeof input.artist === "string" ? input.artist.trim().slice(0, 120) : undefined;
  const hasLyrics = input.hasLyrics !== undefined ? !!input.hasLyrics : undefined;
  const hasChords = input.hasChords !== undefined ? !!input.hasChords : undefined;

  return {
    ...(title !== undefined ? { title } : {}),
    ...(artist !== undefined ? { artist } : {}),
    ...(hasLyrics !== undefined ? { hasLyrics } : {}),
    ...(hasChords !== undefined ? { hasChords } : {}),
  };
}

/**
 * Assert recursively that no forbidden sensitive field is loaded or passed to persistence.
 */
export function assertRepositoryPayloadIsPrivate(payload: any): boolean {
  if (payload === null || payload === undefined) {
    return true;
  }

  const forbiddenKeys = [
    "rawText",
    "prompt",
    "url",
    "sourceUrl",
    "cleanLyrics",
    "cleanChords",
    "lyrics",
    "chords",
    "token",
    "authorization",
    "headers",
    "cookies",
    "stack",
    "message",
  ];

  if (typeof payload === "object") {
    for (const key of Object.keys(payload)) {
      if (forbiddenKeys.includes(key)) {
        throw new Error(
          `${AI_FINOPS_REPOSITORY_ERRORS.PRIVATE_FIELD_FORBIDDEN}: Key "${key}" is prohibited in persistence payload`
        );
      }
      assertRepositoryPayloadIsPrivate(payload[key]);
    }
  }

  if (payload && payload.sourceHost && typeof payload.sourceHost === "string" && payload.sourceHost.includes("/")) {
    throw new Error(
      `${AI_FINOPS_REPOSITORY_ERRORS.PRIVATE_FIELD_FORBIDDEN}: sourceHost cannot contain slashes`
    );
  }

  return true;
}

/**
 * Derives estimated output chars from output tokens to correctly persist events.
 */
export function deriveEstimatedOutputCharsFromTokens(estimatedOutputTokens?: number | null): number {
  if (typeof estimatedOutputTokens !== "number" || isNaN(estimatedOutputTokens) || estimatedOutputTokens <= 0) {
    return 0;
  }
  return Math.floor(estimatedOutputTokens) * AI_TOKEN_ESTIMATION_CHARS_PER_TOKEN;
}

/**
 * Transactional reservation flow.
 */
export async function beginAiFinOpsReservation(
  input: AiFinOpsRepositoryInput
): Promise<{
  status: "IDEMPOTENCY_IN_FLIGHT" | "IDEMPOTENCY_COMPLETED" | "QUOTA_BLOCKED" | "RESERVED";
  quotaDecision?: AiQuotaDecision;
  existingRecord?: AiIdempotencyRecord;
}> {
  assertRepositoryPayloadIsPrivate(input);

  return input.adapter.runTransaction(async (tx) => {
    const existing = (await tx.get(input.paths.idempotencyDocPath)) as AiIdempotencyRecord | null;
    const classification = classifyExistingIdempotencyRecord(existing, new Date());

    if (classification === "IN_FLIGHT") {
      return { status: "IDEMPOTENCY_IN_FLIGHT", existingRecord: existing! };
    }

    if (classification === "COMPLETED") {
      return { status: "IDEMPOTENCY_COMPLETED", existingRecord: existing! };
    }

    // MISS, EXPIRED, FAILED_RETRY_ALLOWED -> evaluate Quota
    const usageSnapshot = await readAiUsageSnapshot(tx, input.paths);
    const estimatedInputTokens = estimateTokensFromChars(input.inputChars || 0);

    const limits = resolveAiQuotaLimits({
      plan: input.plan,
      featureEnabled: true,
      overrides: input.overrides,
    });

    const quotaDecision = evaluateAiQuota({
      limits,
      usage: usageSnapshot,
      estimatedInputTokens,
    });

    if (!quotaDecision.allowed) {
      return { status: "QUOTA_BLOCKED", quotaDecision };
    }

    // Quota OK -> reserve via PROCESSING
    const processingRecord = createProcessingIdempotencyRecord({
      idempotencyKey: input.idempotencyKey,
      requestId: input.requestId,
      cacheKey: input.cacheKey,
    });

    await tx.set(input.paths.idempotencyDocPath, processingRecord as any);

    return { status: "RESERVED", quotaDecision };
  });
}

/**
 * Transactional finalization flow.
 */
export async function finalizeAiFinOpsReservation(
  input: AiFinOpsRepositoryInput & {
    outcome: AiUsageOutcome;
    estimatedInputTokens: number;
    estimatedOutputTokens: number;
    cacheSummary?: any;
    errorCode?: string | null;
    durationMs?: number;
    expirationSeconds?: number;
  }
): Promise<void> {
  assertRepositoryPayloadIsPrivate(input);

  const { monthKey, dayKey } = getAiPeriodKeys();

  // Create the sanitised event
  const derivedOutputChars = deriveEstimatedOutputCharsFromTokens(input.estimatedOutputTokens);
  const event = buildAiFinOpsEvent({
    requestId: input.requestId,
    organizationId: input.organizationId,
    uid: input.uid,
    feature: "aiImport",
    endpoint: "ai-import",
    model: input.model,
    sourceType: input.sourceType,
    sourceHost: input.sourceHost,
    inputChars: input.inputChars || 0,
    outputChars: derivedOutputChars, // correctly derived from estimatedOutputTokens
    outcome: input.outcome,
    status: input.outcome === "SUCCESS" ? "succeeded" : "failed",
    cacheHit: input.outcome === "CACHE_HIT",
    idempotencyHit: input.outcome === "IDEMPOTENCY_HIT",
    periodMonthKey: monthKey,
    periodDayKey: dayKey,
    billingPlanSnapshot: input.plan,
    errorCode: input.errorCode,
    durationMs: input.durationMs,
  });

  assertRepositoryPayloadIsPrivate(event);

  await input.adapter.runTransaction(async (tx) => {
    // Write event doc to monthlyEventsCollectionPath
    const eventDocPath = `${input.paths.monthlyEventsCollectionPath}/${input.requestId}`;
    await tx.set(eventDocPath, event as any);

    const mustConsume = shouldConsumeQuotaForOutcome(input.outcome);

    if (mustConsume) {
      // 1. Update monthly counters
      const monthlyDoc = await tx.get(input.paths.monthlyUsageDocPath);
      const monthlyCounters = normalizeUsageCounters(monthlyDoc);
      const increments = buildUsageIncrement({
        estimatedInputTokens: input.estimatedInputTokens,
        estimatedOutputTokens: input.estimatedOutputTokens,
      });

      const updatedMonthly: AiUsageCounters = {
        requestCount: monthlyCounters.requestCount + increments.requestCount,
        estimatedInputTokens: monthlyCounters.estimatedInputTokens + increments.estimatedInputTokens,
        estimatedOutputTokens: monthlyCounters.estimatedOutputTokens + increments.estimatedOutputTokens,
        estimatedTotalTokens: monthlyCounters.estimatedTotalTokens + increments.estimatedTotalTokens,
        createdAtIso: monthlyCounters.createdAtIso || new Date().toISOString(),
        updatedAtIso: new Date().toISOString(),
      };
      await tx.set(input.paths.monthlyUsageDocPath, updatedMonthly as any);

      // 2. Update daily counters
      const dailyDoc = await tx.get(input.paths.dailyUsageDocPath);
      const dailyCounters = normalizeUsageCounters(dailyDoc);

      const updatedDaily: AiUsageCounters = {
        requestCount: dailyCounters.requestCount + increments.requestCount,
        estimatedInputTokens: dailyCounters.estimatedInputTokens + increments.estimatedInputTokens,
        estimatedOutputTokens: dailyCounters.estimatedOutputTokens + increments.estimatedOutputTokens,
        estimatedTotalTokens: dailyCounters.estimatedTotalTokens + increments.estimatedTotalTokens,
        createdAtIso: dailyCounters.createdAtIso || new Date().toISOString(),
        updatedAtIso: new Date().toISOString(),
      };
      await tx.set(input.paths.dailyUsageDocPath, updatedDaily as any);

      // 3. Mark idempotency as COMPLETED
      const existingIdempotency = await tx.get(input.paths.idempotencyDocPath);
      if (existingIdempotency) {
        const completedIdempotency: AiIdempotencyRecord = {
          ...(existingIdempotency as AiIdempotencyRecord),
          status: "COMPLETED",
          updatedAtIso: new Date().toISOString(),
          outcome: input.outcome,
        };
        await tx.set(input.paths.idempotencyDocPath, completedIdempotency as any);
      }

      // 4. Optionally write cache READY
      if (input.cacheSummary) {
        const sanitizedSummary = sanitizeCacheResultSummary(input.cacheSummary);
        const expiresSeconds = input.expirationSeconds || 604800; // default 7 days
        const cacheRecord: AiCacheRecord = {
          cacheKey: input.cacheKey,
          status: "READY",
          requestId: input.requestId,
          createdAtIso: new Date().toISOString(),
          expiresAtIso: new Date(Date.now() + expiresSeconds * 1000).toISOString(),
          sourceType: input.sourceType,
          sourceHost: input.sourceHost || null,
          model: input.model,
          policyVersion: AI_FINOPS_POLICY_VERSION,
          resultSummary: sanitizedSummary,
        };
        await tx.set(input.paths.cacheDocPath, cacheRecord as any);
      }
    } else {
      // Do not consume quota.
      // If it's a failure (not SUCCESS, CACHE_HIT or IDEMPOTENCY_HIT), mark idempotency as FAILED to unlock retry.
      const isOkOutcome =
        input.outcome === "SUCCESS" ||
        input.outcome === "CACHE_HIT" ||
        input.outcome === "IDEMPOTENCY_HIT";

      if (!isOkOutcome) {
        const existingIdempotency = await tx.get(input.paths.idempotencyDocPath);
        if (existingIdempotency) {
          const failedIdempotency: AiIdempotencyRecord = {
            ...(existingIdempotency as AiIdempotencyRecord),
            status: "FAILED",
            updatedAtIso: new Date().toISOString(),
            outcome: input.outcome,
          };
          await tx.set(input.paths.idempotencyDocPath, failedIdempotency as any);
        }
      }
    }
  });
}
