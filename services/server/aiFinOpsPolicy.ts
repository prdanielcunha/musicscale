import * as crypto from "node:crypto";

// --- CONSTANTS ---
export const AI_FINOPS_POLICY_VERSION = "0.2C.1E.1";
export const AI_IMPORT_FEATURE_KEY = "aiImport";
export const AI_IMPORT_ENDPOINT_KEY = "ai-import";
export const AI_IDEMPOTENCY_KEY_PREFIX = "aiimp_";
export const AI_CACHE_KEY_PREFIX = "aicache_";
export const AI_RATE_LIMIT_BUCKET_PREFIX = "airl_";
export const AI_MAX_HASH_INPUT_CHARS = 64000;
export const AI_TOKEN_ESTIMATION_CHARS_PER_TOKEN = 4;

// --- TYPES ---
export type AiPlan = "starter" | "advanced" | "pro";
export type AiSourceType = "rawText" | "url";

export type AiUsageOutcome =
  | "AUTH_FAILED"
  | "PAYLOAD_INVALID"
  | "RATE_LIMITED"
  | "QUOTA_EXCEEDED"
  | "SSRF_FAILED"
  | "GEMINI_TIMEOUT"
  | "GEMINI_ERROR"
  | "GEMINI_INVALID_JSON"
  | "DETERMINISTIC_FALLBACK"
  | "CACHE_HIT"
  | "IDEMPOTENCY_HIT"
  | "SUCCESS";

export interface AiQuotaLimits {
  enabled: boolean;
  monthlyRequests: number;
  dailyRequests: number;
  monthlyEstimatedTokens: number;
  dailyEstimatedTokens: number;
}

export interface AiUsageSnapshot {
  monthlyRequestCount: number;
  dailyRequestCount: number;
  monthlyEstimatedTokens: number;
  dailyEstimatedTokens: number;
}

export interface AiQuotaDecision {
  allowed: boolean;
  statusCode: 200 | 402 | 429;
  code:
    | "AI_QUOTA_ALLOWED"
    | "AI_FEATURE_DISABLED"
    | "AI_MONTHLY_REQUEST_QUOTA_EXCEEDED"
    | "AI_DAILY_REQUEST_QUOTA_EXCEEDED"
    | "AI_MONTHLY_TOKEN_QUOTA_EXCEEDED"
    | "AI_DAILY_TOKEN_QUOTA_EXCEEDED";
  remainingMonthlyRequests: number;
  remainingDailyRequests: number;
  remainingMonthlyEstimatedTokens: number;
  remainingDailyEstimatedTokens: number;
}

export interface AiPeriodKeys {
  monthKey: string;
  dayKey: string;
}

export interface AiFirestorePaths {
  monthlyUsageDocPath: string;
  dailyUsageDocPath: string;
  monthlyEventsCollectionPath: string;
  idempotencyDocPath: string;
  cacheDocPath: string;
  rateLimitDocPath: string;
}

export interface AiIdempotencyInput {
  organizationId: string;
  userId?: string;
  feature: "aiImport";
  sourceType: AiSourceType;
  rawText?: string;
  url?: string;
  desiredKey?: string;
  version?: string;
  bpm?: string | number | null;
  model: string;
}

export interface AiFinOpsEvent {
  requestId: string;
  organizationId: string;
  uid: string;
  feature: "aiImport";
  endpoint: "ai-import";
  model: string;
  sourceType: AiSourceType;
  sourceHost?: string | null;
  inputChars: number;
  outputChars: number;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  outcome: AiUsageOutcome;
  status: "allowed" | "blocked" | "failed" | "succeeded" | "cached";
  cacheHit: boolean;
  idempotencyHit: boolean;
  periodMonthKey: string;
  periodDayKey: string;
  billingPlanSnapshot: AiPlan;
  entitlementSource?: string;
  durationMs?: number;
  errorCode?: string | null;
  createdAtIso: string;
  policyVersion: string;
}

// --- SYSTEM LIMITS ---
const PLAN_DEFAULTS: Record<AiPlan, AiQuotaLimits> = {
  starter: {
    enabled: false,
    monthlyRequests: 0,
    dailyRequests: 0,
    monthlyEstimatedTokens: 0,
    dailyEstimatedTokens: 0,
  },
  advanced: {
    enabled: false,
    monthlyRequests: 0,
    dailyRequests: 0,
    monthlyEstimatedTokens: 0,
    dailyEstimatedTokens: 0,
  },
  pro: {
    enabled: true,
    monthlyRequests: 500,
    dailyRequests: 50,
    monthlyEstimatedTokens: 2000000,
    dailyEstimatedTokens: 250000,
  },
};

// --- ERROR CODES ---
export const AI_FINOPS_ERRORS = {
  INVALID_ORG_ID: "AI_FINOPS_INVALID_ORG_ID",
  INVALID_SECRET: "AI_FINOPS_INVALID_SECRET",
  INVALID_URL: "AI_FINOPS_INVALID_URL",
  INVALID_KEY: "AI_FINOPS_INVALID_KEY",
  PRIVATE_FIELD_FORBIDDEN: "AI_FINOPS_PRIVATE_FIELD_FORBIDDEN",
  INVALID_DATE: "AI_FINOPS_INVALID_DATE",
};

// --- FUNCTIONS ---

/**
 * Resolves AI Quota Limits for a plan, feature activation, and optional overrides.
 */
export function resolveAiQuotaLimits(input: {
  plan?: string;
  featureEnabled?: boolean;
  overrides?: Partial<AiQuotaLimits>;
}): AiQuotaLimits {
  const planName = input.plan === "pro" || input.plan === "advanced" || input.plan === "starter" ? input.plan : "starter";
  const baseLimits = { ...PLAN_DEFAULTS[planName] };

  if (input.featureEnabled === false) {
    baseLimits.enabled = false;
    baseLimits.monthlyRequests = 0;
    baseLimits.dailyRequests = 0;
    baseLimits.monthlyEstimatedTokens = 0;
    baseLimits.dailyEstimatedTokens = 0;
    return baseLimits;
  }

  const merged = {
    ...baseLimits,
    ...(input.overrides || {}),
  };

  // Ensure no negative values
  return {
    enabled: merged.enabled,
    monthlyRequests: Math.max(0, merged.monthlyRequests),
    dailyRequests: Math.max(0, merged.dailyRequests),
    monthlyEstimatedTokens: Math.max(0, merged.monthlyEstimatedTokens),
    dailyEstimatedTokens: Math.max(0, merged.dailyEstimatedTokens),
  };
}

/**
 * Returns UTC keys for month (YYYY-MM) and day (YYYY-MM-DD).
 */
export function getAiPeriodKeys(dateInput?: Date | string | number): AiPeriodKeys {
  let date: Date;
  if (dateInput === undefined) {
    date = new Date();
  } else {
    date = new Date(dateInput);
    if (isNaN(date.getTime())) {
      throw new Error(AI_FINOPS_ERRORS.INVALID_DATE);
    }
  }

  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");

  return {
    monthKey: `${yyyy}-${mm}`,
    dayKey: `${yyyy}-${mm}-${dd}`,
  };
}

/**
 * Estimating tokens based on text/character count.
 */
export function estimateTokensFromChars(chars: number): number {
  if (chars <= 0) {
    return 0;
  }
  return Math.ceil(chars / AI_TOKEN_ESTIMATION_CHARS_PER_TOKEN);
}

/**
 * Normalizes rawText for cryptographic hashing.
 */
export function normalizeRawTextForHash(rawText: string): string {
  return rawText
    .normalize("NFC")
    .replace(/\r\n|\r/g, "\n")
    .trim()
    .slice(0, AI_MAX_HASH_INPUT_CHARS);
}

/**
 * Normalizes URL for cryptographic hashing.
 */
export function normalizeUrlForHash(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  try {
    const urlObj = new URL(trimmed);
    const protocol = urlObj.protocol.toLowerCase();
    const host = urlObj.hostname.toLowerCase();
    const port = urlObj.port ? `:${urlObj.port}` : "";
    const pathname = urlObj.pathname;

    // Sort query params
    const sortedParams: string[] = [];
    urlObj.searchParams.forEach((val, key) => {
      sortedParams.push(`${encodeURIComponent(key)}=${encodeURIComponent(val)}`);
    });
    sortedParams.sort();
    const query = sortedParams.length > 0 ? `?${sortedParams.join("&")}` : "";

    return `${protocol}//${host}${port}${pathname}${query}`;
  } catch {
    throw new Error(AI_FINOPS_ERRORS.INVALID_URL);
  }
}

/**
 * Extracts a safe hostname in lowercase from a URL.
 */
export function extractSafeSourceHost(rawUrl: string): string | null {
  if (!rawUrl) {
    return null;
  }
  try {
    const urlObj = new URL(rawUrl.trim());
    return urlObj.hostname.toLowerCase() || null;
  } catch {
    return null;
  }
}

/**
 * Builds deterministic idempotency key with SHA256 HMAC.
 */
export function buildAiImportIdempotencyKey(
  input: AiIdempotencyInput,
  options: { secret: string }
): string {
  if (!options || !options.secret || options.secret.trim() === "") {
    throw new Error(AI_FINOPS_ERRORS.INVALID_SECRET);
  }
  if (!input.organizationId || input.organizationId.includes("/")) {
    throw new Error(AI_FINOPS_ERRORS.INVALID_ORG_ID);
  }

  const normalizedText = input.rawText ? normalizeRawTextForHash(input.rawText) : "";
  const normalizedUrl = input.url ? normalizeUrlForHash(input.url) : "";

  const textHash = normalizedText
    ? crypto.createHash("sha256").update(normalizedText).digest("hex")
    : "";
  const urlHash = normalizedUrl
    ? crypto.createHash("sha256").update(normalizedUrl).digest("hex")
    : "";

  const payload = {
    organizationId: input.organizationId,
    feature: input.feature,
    sourceType: input.sourceType,
    textHash,
    urlHash,
    desiredKey: input.desiredKey || "",
    version: input.version || "",
    bpm: input.bpm !== undefined && input.bpm !== null ? String(input.bpm) : "",
    model: input.model,
    policyVersion: AI_FINOPS_POLICY_VERSION,
    algorithmVersion: "1",
  };

  const payloadStr = JSON.stringify(payload);
  const hmac = crypto
    .createHmac("sha256", options.secret)
    .update(payloadStr)
    .digest("hex");

  return `${AI_IDEMPOTENCY_KEY_PREFIX}${hmac}`;
}

/**
 * Builds deterministic cache key with SHA256 HMAC.
 */
export function buildAiImportCacheKey(
  input: AiIdempotencyInput,
  options: { secret: string }
): string {
  if (!options || !options.secret || options.secret.trim() === "") {
    throw new Error(AI_FINOPS_ERRORS.INVALID_SECRET);
  }
  if (!input.organizationId || input.organizationId.includes("/")) {
    throw new Error(AI_FINOPS_ERRORS.INVALID_ORG_ID);
  }

  const normalizedText = input.rawText ? normalizeRawTextForHash(input.rawText) : "";
  const normalizedUrl = input.url ? normalizeUrlForHash(input.url) : "";

  const textHash = normalizedText
    ? crypto.createHash("sha256").update(normalizedText).digest("hex")
    : "";
  const urlHash = normalizedUrl
    ? crypto.createHash("sha256").update(normalizedUrl).digest("hex")
    : "";

  const payload = {
    organizationId: input.organizationId,
    feature: input.feature,
    sourceType: input.sourceType,
    textHash,
    urlHash,
    desiredKey: input.desiredKey || "",
    version: input.version || "",
    bpm: input.bpm !== undefined && input.bpm !== null ? String(input.bpm) : "",
    model: input.model,
    policyVersion: AI_FINOPS_POLICY_VERSION,
    algorithmVersion: "1",
  };

  const payloadStr = JSON.stringify(payload);
  const hmac = crypto
    .createHmac("sha256", options.secret)
    .update(payloadStr)
    .digest("hex");

  return `${AI_CACHE_KEY_PREFIX}${hmac}`;
}

/**
 * Builds a rate limit bucket key.
 */
export function buildAiRateLimitBucketKey(input: {
  organizationId: string;
  uid: string;
  endpoint: string;
  windowKey: string;
}): string {
  const safeOrg = input.organizationId.replace(/[^a-zA-Z0-9_-]/g, "");
  const safeUid = input.uid.replace(/[^a-zA-Z0-9_-]/g, "");
  const safeEndpoint = input.endpoint.replace(/[^a-zA-Z0-9_-]/g, "");
  const safeWindow = input.windowKey.replace(/[^a-zA-Z0-9_-]/g, "");

  return `${AI_RATE_LIMIT_BUCKET_PREFIX}${safeOrg}_${safeUid}_${safeEndpoint}_${safeWindow}`;
}

/**
 * Builds paths for Firestore operations.
 */
export function buildAiFirestorePaths(input: {
  organizationId: string;
  periodKeys: AiPeriodKeys;
  idempotencyKey: string;
  cacheKey: string;
  rateLimitBucketKey: string;
}): AiFirestorePaths {
  const orgId = input.organizationId;
  if (!orgId || orgId.includes("/")) {
    throw new Error(AI_FINOPS_ERRORS.INVALID_ORG_ID);
  }

  const { monthKey, dayKey } = input.periodKeys;
  const { idempotencyKey, cacheKey, rateLimitBucketKey } = input;

  if (
    monthKey.includes("/") ||
    dayKey.includes("/") ||
    idempotencyKey.includes("/") ||
    cacheKey.includes("/") ||
    rateLimitBucketKey.includes("/")
  ) {
    throw new Error(AI_FINOPS_ERRORS.INVALID_KEY);
  }

  return {
    monthlyUsageDocPath: `organizations/${orgId}/aiUsage/${monthKey}`,
    dailyUsageDocPath: `organizations/${orgId}/aiDailyUsage/${dayKey}`,
    monthlyEventsCollectionPath: `organizations/${orgId}/aiUsage/${monthKey}/events`,
    idempotencyDocPath: `organizations/${orgId}/aiIdempotency/${idempotencyKey}`,
    cacheDocPath: `organizations/${orgId}/aiCache/${cacheKey}`,
    rateLimitDocPath: `organizations/${orgId}/aiRateLimits/${rateLimitBucketKey}`,
  };
}

/**
 * Evaluates usage against quota limits.
 */
export function evaluateAiQuota(input: {
  limits: AiQuotaLimits;
  usage: AiUsageSnapshot;
  estimatedInputTokens: number;
}): AiQuotaDecision {
  const { limits, usage, estimatedInputTokens } = input;

  if (!limits.enabled) {
    return {
      allowed: false,
      statusCode: 402,
      code: "AI_FEATURE_DISABLED",
      remainingMonthlyRequests: 0,
      remainingDailyRequests: 0,
      remainingMonthlyEstimatedTokens: 0,
      remainingDailyEstimatedTokens: 0,
    };
  }

  if (usage.monthlyRequestCount >= limits.monthlyRequests) {
    return {
      allowed: false,
      statusCode: 402,
      code: "AI_MONTHLY_REQUEST_QUOTA_EXCEEDED",
      remainingMonthlyRequests: 0,
      remainingDailyRequests: Math.max(0, limits.dailyRequests - usage.dailyRequestCount),
      remainingMonthlyEstimatedTokens: Math.max(0, limits.monthlyEstimatedTokens - usage.monthlyEstimatedTokens),
      remainingDailyEstimatedTokens: Math.max(0, limits.dailyEstimatedTokens - usage.dailyEstimatedTokens),
    };
  }

  if (usage.dailyRequestCount >= limits.dailyRequests) {
    return {
      allowed: false,
      statusCode: 429,
      code: "AI_DAILY_REQUEST_QUOTA_EXCEEDED",
      remainingMonthlyRequests: Math.max(0, limits.monthlyRequests - usage.monthlyRequestCount),
      remainingDailyRequests: 0,
      remainingMonthlyEstimatedTokens: Math.max(0, limits.monthlyEstimatedTokens - usage.monthlyEstimatedTokens),
      remainingDailyEstimatedTokens: Math.max(0, limits.dailyEstimatedTokens - usage.dailyEstimatedTokens),
    };
  }

  if (usage.monthlyEstimatedTokens + estimatedInputTokens > limits.monthlyEstimatedTokens) {
    return {
      allowed: false,
      statusCode: 402,
      code: "AI_MONTHLY_TOKEN_QUOTA_EXCEEDED",
      remainingMonthlyRequests: Math.max(0, limits.monthlyRequests - usage.monthlyRequestCount),
      remainingDailyRequests: Math.max(0, limits.dailyRequests - usage.dailyRequestCount),
      remainingMonthlyEstimatedTokens: 0,
      remainingDailyEstimatedTokens: Math.max(0, limits.dailyEstimatedTokens - usage.dailyEstimatedTokens),
    };
  }

  if (usage.dailyEstimatedTokens + estimatedInputTokens > limits.dailyEstimatedTokens) {
    return {
      allowed: false,
      statusCode: 429,
      code: "AI_DAILY_TOKEN_QUOTA_EXCEEDED",
      remainingMonthlyRequests: Math.max(0, limits.monthlyRequests - usage.monthlyRequestCount),
      remainingDailyRequests: Math.max(0, limits.dailyRequests - usage.dailyRequestCount),
      remainingMonthlyEstimatedTokens: Math.max(0, limits.monthlyEstimatedTokens - usage.monthlyEstimatedTokens),
      remainingDailyEstimatedTokens: 0,
    };
  }

  // Calculate remaining post-request usage (limit - usage - current delta)
  const remainingMonthlyRequests = Math.max(0, limits.monthlyRequests - (usage.monthlyRequestCount + 1));
  const remainingDailyRequests = Math.max(0, limits.dailyRequests - (usage.dailyRequestCount + 1));
  const remainingMonthlyEstimatedTokens = Math.max(
    0,
    limits.monthlyEstimatedTokens - (usage.monthlyEstimatedTokens + estimatedInputTokens)
  );
  const remainingDailyEstimatedTokens = Math.max(
    0,
    limits.dailyEstimatedTokens - (usage.dailyEstimatedTokens + estimatedInputTokens)
  );

  return {
    allowed: true,
    statusCode: 200,
    code: "AI_QUOTA_ALLOWED",
    remainingMonthlyRequests,
    remainingDailyRequests,
    remainingMonthlyEstimatedTokens,
    remainingDailyEstimatedTokens,
  };
}

/**
 * Determines whether quota must be deducted/kept for a given outcome.
 */
export function shouldConsumeQuotaForOutcome(outcome: AiUsageOutcome): boolean {
  switch (outcome) {
    case "AUTH_FAILED":
    case "PAYLOAD_INVALID":
    case "RATE_LIMITED":
    case "QUOTA_EXCEEDED":
    case "SSRF_FAILED":
    case "CACHE_HIT":
    case "IDEMPOTENCY_HIT":
    case "GEMINI_TIMEOUT":
    case "GEMINI_ERROR":
    case "GEMINI_INVALID_JSON":
    case "DETERMINISTIC_FALLBACK":
      return false;
    case "SUCCESS":
      return true;
  }
}

/**
 * Asserts that a FinOps Event doesn't contain forbidden private/sensitive data.
 */
export function assertAiFinOpsEventIsPrivate(event: any): boolean {
  if (!event) {
    throw new Error("Empty event");
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

  for (const k of forbiddenKeys) {
    if (event[k] !== undefined) {
      throw new Error(`${AI_FINOPS_ERRORS.PRIVATE_FIELD_FORBIDDEN}: Key "${k}" is forbidden in event!`);
    }
  }

  if (event.sourceHost && event.sourceHost.includes("/")) {
    throw new Error(`${AI_FINOPS_ERRORS.PRIVATE_FIELD_FORBIDDEN}: sourceHost cannot contain slashes`);
  }

  return true;
}

/**
 * Sanitizes and constructs an AiFinOpsEvent.
 */
export function buildAiFinOpsEvent(
  input: Omit<
    AiFinOpsEvent,
    "policyVersion" | "createdAtIso" | "estimatedInputTokens" | "estimatedOutputTokens"
  > & {
    inputChars: number;
    outputChars: number;
  }
): AiFinOpsEvent {
  // Deep private fields validation on the raw input before construction
  const forbiddenInputs = [
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

  for (const k of forbiddenInputs) {
    if ((input as any)[k] !== undefined) {
      throw new Error(`${AI_FINOPS_ERRORS.PRIVATE_FIELD_FORBIDDEN}: Key "${k}" is strictly forbidden in input payload`);
    }
  }

  const estimatedInputTokens = estimateTokensFromChars(input.inputChars);
  const estimatedOutputTokens = estimateTokensFromChars(input.outputChars);

  const event: AiFinOpsEvent = {
    requestId: input.requestId,
    organizationId: input.organizationId,
    uid: input.uid,
    feature: input.feature,
    endpoint: input.endpoint,
    model: input.model,
    sourceType: input.sourceType,
    sourceHost: input.sourceHost || null,
    inputChars: Math.max(0, input.inputChars),
    outputChars: Math.max(0, input.outputChars),
    estimatedInputTokens,
    estimatedOutputTokens,
    outcome: input.outcome,
    status: input.status,
    cacheHit: !!input.cacheHit,
    idempotencyHit: !!input.idempotencyHit,
    periodMonthKey: input.periodMonthKey,
    periodDayKey: input.periodDayKey,
    billingPlanSnapshot: input.billingPlanSnapshot,
    entitlementSource: input.entitlementSource,
    durationMs: input.durationMs,
    errorCode: input.errorCode || null,
    createdAtIso: new Date().toISOString(),
    policyVersion: AI_FINOPS_POLICY_VERSION,
  };

  assertAiFinOpsEventIsPrivate(event);

  return event;
}

/**
 * Returns a declarative plan of operations (declarative recipe) for the reservation.
 */
export function createAiUsageReservationPlan(input: {
  organizationId: string;
  userId: string;
  feature: "aiImport";
  sourceType: AiSourceType;
}): any {
  return {
    policyVersion: AI_FINOPS_POLICY_VERSION,
    planType: "AI_USAGE_RESERVATION_DECLARATIVE_PLAN",
    placeholders: {
      organizationId: "{orgId}",
      uid: "{uid}",
      monthKey: "{monthKey}",
      dayKey: "{dayKey}",
      idempotencyKey: "{idempotencyKey}",
      cacheKey: "{cacheKey}",
      rateLimitBucketKey: "{rateLimitBucketKey}"
    },
    feature: input.feature,
    sourceType: input.sourceType,
    steps: [
      "1. Read monthly usage doc from organizations/{orgId}/aiUsage/{monthKey}",
      "2. Read daily usage doc from organizations/{orgId}/aiDailyUsage/{dayKey}",
      "3. Check quota limit against current usage via evaluateAiQuota",
      "4. Check/create idempotency document in organizations/{orgId}/aiIdempotency/{idempotencyKey}",
      "5. Execute AI request with retry and safety rules",
      "6. Write audit/FinOps log event in organizations/{orgId}/aiUsage/{monthKey}/events",
      "7. If successful, increment usage counters; if failed, refund/no-op on counters",
      "8. Optionally cache the output in organizations/{orgId}/aiCache/{cacheKey}",
    ],
    privacy: {
      containsConcreteOrganizationId: false,
      containsConcreteUserId: false,
      containsRawText: false,
      containsUrl: false,
      containsPrompt: false,
      containsLyricsOrChords: false
    }
  };
}
