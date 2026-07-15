import { AiUsageOutcome, shouldConsumeQuotaForOutcome } from "./aiFinOpsPolicy.js";

export type AiImportRouteErrorCode =
  | "AUTH"
  | "VALIDATION"
  | "SCRAPING"
  | "PARSING"
  | "GEMINI"
  | "TIMEOUT"
  | "UNKNOWN"
  | "RATE_LIMIT"
  | "QUOTA"
  | "SSRF"
  | string;

export type AiImportRouteStep =
  | "AUTH"
  | "BODY_PARSER"
  | "1_INITIAL_PAYLOAD"
  | "AI_RATE_LIMIT"
  | "2_URL_NORMALIZATION"
  | "3_NETWORK_FETCH"
  | "4_METADATA_EXTRACTION"
  | "5_CONTENT_EXTRACTION"
  | "7_GEMINI_PREPARATION"
  | "8_GEMINI_INVOCATION"
  | "9_RESP_PARSING"
  | "10_FALLBACK_PARSING"
  | "10.1_DETERMINISTIC_VALIDATION"
  | "11_FINALIZE_RESPONSE"
  | "UNKNOWN"
  | string;

export interface ResolveAiImportFinOpsOutcomeInput {
  ok?: boolean;
  routeCode?: string | null;
  step?: string | null;
  errorCode?: string | null;
  usedAi?: boolean;
  usedDeterministicFallback?: boolean;
  cacheHit?: boolean;
  idempotencyHit?: boolean;
  quotaBlocked?: boolean;
  rateLimited?: boolean;
  httpStatus?: number | null;
}

export interface ResolveAiImportFinOpsOutcomeResult {
  outcome: AiUsageOutcome;
  shouldConsumeQuota: boolean;
  safeErrorCode: string | null;
  cacheHit: boolean;
  idempotencyHit: boolean;
}

export function sanitizeAiImportFinOpsErrorCode(value: unknown): string | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  
  let str = String(value);
  const lowerStr = str.toLowerCase();
  
  if (
    lowerStr.includes("http://") ||
    lowerStr.includes("https://") ||
    lowerStr.includes("/") ||
    lowerStr.includes("bearer") ||
    lowerStr.includes("token") ||
    lowerStr.includes("authorization") ||
    lowerStr.includes("cookie") ||
    lowerStr.includes("\n") ||
    lowerStr.includes("\r") ||
    typeof value === "object"
  ) {
    return "AI_IMPORT_ERROR";
  }

  str = str.toUpperCase();
  str = str.replace(/[^A-Z0-9_]/g, "_");
  str = str.substring(0, 80);
  str = str.replace(/^_+|_+$/g, '');

  if (str === "") {
    return "AI_IMPORT_ERROR";
  }

  return str;
}

export function isAiImportAuthFailure(httpStatus?: number | null, step?: string | null, routeCode?: string | null) {
  return httpStatus === 401 || httpStatus === 403 || step === "AUTH" || routeCode === "AUTH";
}

export function isAiImportPayloadInvalid(step?: string | null, routeCode?: string | null) {
  return routeCode === "VALIDATION" || step === "BODY_PARSER" || step === "1_INITIAL_PAYLOAD";
}

export function isAiImportSsrfFailure(errorCode?: string | null, routeCode?: string | null, step?: string | null) {
  const code = String(errorCode || "").toUpperCase();
  if (
    code.includes("SSRF") ||
    code.includes("SAFE_FETCH") ||
    code.includes("SAFE_EXTERNAL_FETCH") ||
    code.includes("URL_POLICY") ||
    code.includes("DNS") ||
    code.includes("HTTPS") ||
    code.includes("REDIRECT")
  ) {
    return true;
  }
  if (routeCode === "SCRAPING" || step === "3_NETWORK_FETCH") {
    return true;
  }
  return false;
}

export function isAiImportGeminiTimeout(errorCode?: string | null, routeCode?: string | null) {
  return routeCode === "TIMEOUT" || String(errorCode || "").toUpperCase().includes("TIMEOUT");
}

export function isAiImportGeminiInvalidJson(errorCode?: string | null, routeCode?: string | null, step?: string | null) {
  return errorCode === "GEMINI_INVALID_JSON" || (routeCode === "PARSING" && step === "9_RESP_PARSING");
}

export function resolveAiImportFinOpsOutcome(input: ResolveAiImportFinOpsOutcomeInput | any): ResolveAiImportFinOpsOutcomeResult {
  const {
    ok,
    routeCode,
    step,
    errorCode,
    usedDeterministicFallback,
    cacheHit,
    idempotencyHit,
    quotaBlocked,
    rateLimited,
    httpStatus
  } = input || {};

  let outcome: AiUsageOutcome = "GEMINI_ERROR"; // default fallback

  if (cacheHit === true) {
    outcome = "CACHE_HIT";
  } else if (idempotencyHit === true) {
    outcome = "IDEMPOTENCY_HIT";
  } else if (quotaBlocked === true) {
    outcome = "QUOTA_EXCEEDED";
  } else if (rateLimited === true) {
    outcome = "RATE_LIMITED";
  } else if (isAiImportAuthFailure(httpStatus, step, routeCode)) {
    outcome = "AUTH_FAILED";
  } else if (isAiImportPayloadInvalid(step, routeCode)) {
    outcome = "PAYLOAD_INVALID";
  } else if (isAiImportSsrfFailure(errorCode, routeCode, step)) {
    outcome = "SSRF_FAILED";
  } else if (isAiImportGeminiTimeout(errorCode, routeCode)) {
    outcome = "GEMINI_TIMEOUT";
  } else if (routeCode === "GEMINI") {
    outcome = "GEMINI_ERROR";
  } else if (isAiImportGeminiInvalidJson(errorCode, routeCode, step)) {
    outcome = "GEMINI_INVALID_JSON";
  } else if (usedDeterministicFallback === true) {
    outcome = "DETERMINISTIC_FALLBACK";
  } else if (ok === true) {
    outcome = "SUCCESS";
  } else {
    if (step && String(step).toUpperCase().includes("GEMINI")) {
      outcome = "GEMINI_ERROR";
    } else {
      outcome = "PAYLOAD_INVALID";
    }
  }

  return {
    outcome,
    shouldConsumeQuota: shouldConsumeQuotaForOutcome(outcome),
    safeErrorCode: sanitizeAiImportFinOpsErrorCode(errorCode),
    cacheHit: cacheHit === true,
    idempotencyHit: idempotencyHit === true
  };
}
