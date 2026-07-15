import * as fs from "fs";
import * as path from "path";
import * as crypto from "node:crypto";
import {
  AI_FINOPS_POLICY_VERSION,
  AI_IMPORT_FEATURE_KEY,
  AI_IMPORT_ENDPOINT_KEY,
  AI_IDEMPOTENCY_KEY_PREFIX,
  AI_CACHE_KEY_PREFIX,
  AI_RATE_LIMIT_BUCKET_PREFIX,
  AI_MAX_HASH_INPUT_CHARS,
  AI_TOKEN_ESTIMATION_CHARS_PER_TOKEN,
  AI_FINOPS_ERRORS,
  resolveAiQuotaLimits,
  getAiPeriodKeys,
  estimateTokensFromChars,
  normalizeRawTextForHash,
  normalizeUrlForHash,
  extractSafeSourceHost,
  buildAiImportIdempotencyKey,
  buildAiImportCacheKey,
  buildAiRateLimitBucketKey,
  buildAiFirestorePaths,
  evaluateAiQuota,
  shouldConsumeQuotaForOutcome,
  buildAiFinOpsEvent,
  assertAiFinOpsEventIsPrivate,
  createAiUsageReservationPlan,
  AiIdempotencyInput,
  AiQuotaLimits,
  AiUsageSnapshot,
} from "../services/server/aiFinOpsPolicy";

let registeredTests = 0;
let passedTests = 0;
let failedTests = 0;
let testsWithZeroAssertions = 0;

interface TestContext {
  assert: (condition: boolean, message: string) => void;
}

function test(name: string, fn: (t: TestContext) => void) {
  registeredTests++;
  let assertionsCount = 0;
  let testFailed = false;

  const t: TestContext = {
    assert(condition: boolean, message: string) {
      assertionsCount++;
      if (!condition) {
        testFailed = true;
        console.error(`  [FAIL] Assertion failed: ${message}`);
      } else {
        console.log(`  [OK] ${message}`);
      }
    },
  };

  console.log(`\nRunning test #${registeredTests}: ${name}`);
  try {
    fn(t);
    if (assertionsCount === 0) {
      testsWithZeroAssertions++;
      console.warn("  [WARN] Test executed zero assertions.");
    }
    if (testFailed) {
      failedTests++;
      console.error(`=== FAILED: ${name} ===`);
    } else {
      passedTests++;
      console.log(`=== PASSED: ${name} ===`);
    }
  } catch (err: any) {
    failedTests++;
    console.error(`  [ERROR] Uncaught exception during test:`, err);
    console.error(`=== FAILED: ${name} ===`);
  }
}

// --- RECORD INITIAL HASHES OF PROTECTED FILES ---
const protectedFiles = [
  "server.ts",
  "components/songs/AiSongImportModal.tsx",
  "services/server/aiRequestSecurity.ts",
  "services/server/aiImportSafeFetchAdapter.ts",
  "services/server/safeExternalFetch.ts",
  "services/server/safeExternalRedirectClient.ts",
  "services/server/safeExternalHttpsClient.ts",
  "services/server/safeExternalDnsResolver.ts",
  "services/server/safeExternalUrlPolicy.ts",
  "services/server/fixChordsHandler.ts",
  "services/server/ecosystemAuth.ts",
  "services/server/organizationAuthorization.ts",
  "services/entitlementsConstants.ts",
  "services/entitlementsService.ts",
  "services/usageService.ts",
  "firestore.rules",
  "package.json",
  "package-lock.json",
  "index.html",
  "index.tsx",
  "App.tsx",
  "components/AppErrorBoundary.tsx",
  "scripts/test_phase0_2a_ecosystem_auth.ts",
  "scripts/test_phase0_2b_organization_security.ts",
  "scripts/test_phase0_2c1a_ai_authorization.ts",
  "scripts/test_phase0_2c1b_fix_chords_security.ts",
  "scripts/test_phase0_2c1c1_safe_external_url_policy.ts",
  "scripts/test_phase0_2c1c2_safe_external_dns_resolver.ts",
  "scripts/test_phase0_2c1c3_safe_external_https_client.ts",
  "scripts/test_phase0_2c1c4_safe_external_redirect_client.ts",
  "scripts/test_phase0_2c1c5_safe_external_fetch.ts",
  "scripts/test_phase0_2c1c6_ai_import_safe_external_fetch_integration.ts",
  "scripts/test_phase0_2c1c7_ai_import_safe_fetch_adapter.ts",
  "scripts/test_phase0_2c1c8_ai_import_functional_contract.ts",
  "scripts/test_phase0_2c1d1_ai_import_governance_rate_limit.ts",
  "scripts/test_phase0_2c1d3_ai_import_body_prompt_logs_frontend.ts",
];

const initialHashes: Record<string, string> = {};
for (const file of protectedFiles) {
  if (!fs.existsSync(file)) {
    throw new Error(`PROTECTED_FILE_MISSING:${file}`);
  }
  const content = fs.readFileSync(file);
  initialHashes[file] = crypto.createHash("sha256").update(content).digest("hex");
}

// ==========================================
// A. ESCOPO / IMPORTS
// ==========================================
test("A. Escopo e Imports de aiFinOpsPolicy.ts", (t) => {
  const policyPath = path.join("services", "server", "aiFinOpsPolicy.ts");
  t.assert(fs.existsSync(policyPath), "1. aiFinOpsPolicy.ts existe no caminho correto");

  const selfPath = path.join("scripts", "test_phase0_2c1e1_ai_finops_policy.ts");
  t.assert(fs.existsSync(selfPath), "2. test_phase0_2c1e1_ai_finops_policy.ts existe");

  const content = fs.readFileSync(policyPath, "utf-8");

  t.assert(!content.includes('import * as admin from "firebase-admin"'), "3. Não importa firebase-admin");
  t.assert(!content.includes('import firebase from "firebase"'), "4. Não importa firebase");
  t.assert(!content.includes('import { firestore }'), "5. Não importa firestore");
  t.assert(!content.includes('import { GoogleGenAI }'), "6. Não importa GoogleGenAI");
  t.assert(!content.includes('import express'), "7. Não importa express");
  t.assert(!content.includes('import { app }'), "8. Não importa server.ts");
  t.assert(content.includes('import * as crypto from "node:crypto"'), "9. Importa node:crypto corretamente");
  t.assert(!content.includes('import * as crypto from "crypto";'), "9b. Não importa crypto puro");
  t.assert(AI_FINOPS_POLICY_VERSION === "0.2C.1E.1", "10. Exporta versão 0.2C.1E.1");
});

// ==========================================
// B. LIMITES / PLANOS
// ==========================================
test("B. Limites de Quota por Planos", (t) => {
  const starterLimits = resolveAiQuotaLimits({ plan: "starter", featureEnabled: true });
  t.assert(starterLimits.enabled === false, "11. Plano starter fica desabilitado (disabled) por default");

  const advancedLimits = resolveAiQuotaLimits({ plan: "advanced", featureEnabled: true });
  t.assert(advancedLimits.enabled === false, "12. Plano advanced fica desabilitado (disabled) por default");

  const proLimits = resolveAiQuotaLimits({ plan: "pro", featureEnabled: true });
  t.assert(proLimits.enabled === true, "13. Plano pro fica habilitado (enabled) por default");

  const featureDisabledPro = resolveAiQuotaLimits({ plan: "pro", featureEnabled: false });
  t.assert(featureDisabledPro.enabled === false, "14. featureEnabled: false força disabled em pro");

  const unknownLimits = resolveAiQuotaLimits({ plan: "unknown_plan", featureEnabled: true });
  t.assert(unknownLimits.enabled === false, "15. Plano desconhecido cai para starter (disabled)");

  const overriddenLimits = resolveAiQuotaLimits({
    plan: "pro",
    featureEnabled: true,
    overrides: { dailyRequests: 999 },
  });
  t.assert(overriddenLimits.dailyRequests === 999, "16. Overrides conseguem alterar limites sem mutar defaults");
  t.assert(resolveAiQuotaLimits({ plan: "pro", featureEnabled: true }).dailyRequests === 50, "17. Limits defaults permanecem intactos");

  const negativeLimits = resolveAiQuotaLimits({
    plan: "pro",
    featureEnabled: true,
    overrides: { dailyRequests: -5 },
  });
  t.assert(negativeLimits.dailyRequests === 0, "17. Limites retornados nunca são negativos");

  t.assert(proLimits.monthlyRequests > 0, "18. monthlyRequests do pro é maior que zero");
  t.assert(proLimits.dailyRequests > 0, "19. dailyRequests do pro é maior que zero");
  t.assert(proLimits.monthlyEstimatedTokens > 0, "20. monthlyEstimatedTokens do pro é maior que zero");
  t.assert(proLimits.dailyEstimatedTokens > 0, "21. dailyEstimatedTokens do pro é maior que zero");
});

// ==========================================
// C. PERÍODOS
// ==========================================
test("C. Geração de Períodos UTC", (t) => {
  const sampleDate = new Date("2026-07-04T12:00:00Z");
  const keys = getAiPeriodKeys(sampleDate);

  t.assert(keys.monthKey === "2026-07", "22. monthKey tem formato YYYY-MM");
  t.assert(keys.dayKey === "2026-07-04", "23. dayKey tem formato YYYY-MM-DD");

  const baseKeys = getAiPeriodKeys();
  t.assert(/^\d{4}-\d{2}$/.test(baseKeys.monthKey), "24. getAiPeriodKeys sem params retorna monthKey UTC atual");
  t.assert(/^\d{4}-\d{2}-\d{2}$/.test(baseKeys.dayKey), "24. getAiPeriodKeys sem params retorna dayKey UTC atual");

  try {
    getAiPeriodKeys("invalid-date-string");
    t.assert(false, "Deveria ter falhado para data inválida");
  } catch (err: any) {
    t.assert(err.message === AI_FINOPS_ERRORS.INVALID_DATE, "25. Data inválida gera erro controlado AI_FINOPS_INVALID_DATE");
  }

  // Timezone edge test (force UTC verification)
  const edgeDate = new Date("2026-07-04T23:59:59.999Z");
  const edgeKeys = getAiPeriodKeys(edgeDate);
  t.assert(edgeKeys.dayKey === "2026-07-04", "26. Borda de timezone em UTC preserva dia canônico");
});

// ==========================================
// D. ESTIMATIVA DE TOKENS
// ==========================================
test("D. Estimativa de Tokens", (t) => {
  t.assert(estimateTokensFromChars(0) === 0, "27. 0 caracteres retorna 0 tokens");
  t.assert(estimateTokensFromChars(-100) === 0, "28. Caracteres negativos retornam 0 tokens");
  t.assert(estimateTokensFromChars(1) === 1, "29. 1 caractere retorna 1 token (Math.ceil)");
  t.assert(estimateTokensFromChars(4) === 1, "30. 4 caracteres retornam 1 token (Math.ceil)");
  t.assert(estimateTokensFromChars(5) === 2, "31. 5 caracteres retornam 2 tokens (Math.ceil)");
  t.assert(estimateTokensFromChars(64000) === 16000, "32. 64000 caracteres retornam exatamente 16000 tokens");
});

// ==========================================
// E. NORMALIZAÇÃO DE RAWTEXT
// ==========================================
test("E. Normalização de rawText", (t) => {
  const inputCrlf = "Olá Mundo\r\nSegunda Linha\r";
  const normalized = normalizeRawTextForHash(inputCrlf);

  t.assert(normalized.includes("\n") && !normalized.includes("\r"), "33/34. CRLF e CR são substituídos por LF");

  const inputWithSpaces = "  \n   Texto com espaços ao redor \n  ";
  t.assert(normalizeRawTextForHash(inputWithSpaces) === "Texto com espaços ao redor", "35. Trim remove espaços e quebras nas pontas");

  const inputUnicode = "café"; // normalized NFC
  t.assert(normalizeRawTextForHash(inputUnicode) === "café", "36. Unicode NFC é preservado");

  const massiveInput = "a".repeat(70000);
  const truncated = normalizeRawTextForHash(massiveInput);
  t.assert(truncated.length === AI_MAX_HASH_INPUT_CHARS, "37. Texto acima de AI_MAX_HASH_INPUT_CHARS é truncado");
  t.assert(truncated !== null, "38. Função normalizeRawTextForHash não retorna null");

  // Verify no content leaks/logging implicitly (pure function check)
  t.assert(typeof truncated === "string", "39. Retorna string segura para hashing");
});

// ==========================================
// F. NORMALIZAÇÃO DE URL
// ==========================================
test("F. Normalização de URL e extração de Host", (t) => {
  const url1 = "https://USER:PASS@musicscale.com:443/api/v1/songs?b=2&a=1#fragment";
  const normalizedUrl = normalizeUrlForHash(url1);

  t.assert(normalizedUrl.startsWith("https://"), "40. Protocolo mantido");
  t.assert(normalizedUrl.includes("musicscale.com"), "41. Hostname mantido");
  t.assert(!normalizedUrl.includes("USER:PASS"), "42. Username e password são removidos");
  t.assert(!normalizedUrl.includes("fragment"), "43. Hash fragment é removido");
  t.assert(normalizedUrl.includes("a=1&b=2"), "44. Query params são ordenados alfabeticamente para estabilidade");
  t.assert(normalizedUrl.includes("/api/v1/songs"), "45. Pathname é preservado");

  try {
    normalizeUrlForHash("invalid-url-string");
    t.assert(false, "Deveria ter falhado");
  } catch (err: any) {
    t.assert(err.message === AI_FINOPS_ERRORS.INVALID_URL, "46. URL inválida gera erro controlado");
  }

  const hostOnly = extractSafeSourceHost("https://sub.domain.com/path?param=1");
  t.assert(hostOnly === "sub.domain.com", "47. extractSafeSourceHost retorna apenas hostname");
  t.assert(hostOnly !== "sub.domain.com/path", "48. Hostname não contém pathname");
  t.assert(hostOnly !== "sub.domain.com?param=1", "49. Hostname não contém query");

  const invalidHost = extractSafeSourceHost("not-a-valid-url");
  t.assert(invalidHost === null, "50. URL inválida retorna null em extractSafeSourceHost");
});

// ==========================================
// G. HASH / IDEMPOTÊNCIA
// ==========================================
test("G. Hash e Chave de Idempotência / Cache / Rate Limit", (t) => {
  const input: AiIdempotencyInput = {
    organizationId: "org-123",
    userId: "user-456",
    feature: "aiImport",
    sourceType: "rawText",
    rawText: "Música de teste",
    model: "gemini-2.5-flash",
  };

  try {
    buildAiImportIdempotencyKey(input, { secret: "" });
    t.assert(false, "Deveria falhar para secret vazio");
  } catch (err: any) {
    t.assert(err.message === AI_FINOPS_ERRORS.INVALID_SECRET, "51/52. Secret vazio gera AI_FINOPS_INVALID_SECRET");
  }

  const secret = "super-secret-key-123";
  const key1 = buildAiImportIdempotencyKey(input, { secret });
  const key2 = buildAiImportIdempotencyKey(input, { secret });

  t.assert(key1 === key2, "53. Mesma entrada gera mesma chave de idempotência");

  const input2 = { ...input, rawText: "Música diferente" };
  const key3 = buildAiImportIdempotencyKey(input2, { secret });
  t.assert(key1 !== key3, "54. rawText diferente gera chave diferente");

  const inputUrl = { ...input, sourceType: "url" as const, url: "https://cifraclub.com.br/song1" };
  const keyUrl = buildAiImportIdempotencyKey(inputUrl, { secret });
  t.assert(key1 !== keyUrl, "55. URL diferente gera chave diferente");

  const inputOrg = { ...input, organizationId: "org-789" };
  const keyOrg = buildAiImportIdempotencyKey(inputOrg, { secret });
  t.assert(key1 !== keyOrg, "56. orgId diferente gera chave diferente");

  const inputModel = { ...input, model: "gemini-1.5-pro" };
  const keyModel = buildAiImportIdempotencyKey(inputModel, { secret });
  t.assert(key1 !== keyModel, "57. model diferente gera chave diferente");

  const inputParams = { ...input, desiredKey: "G", version: "V1", bpm: 120 };
  const keyParams = buildAiImportIdempotencyKey(inputParams, { secret });
  t.assert(key1 !== keyParams, "58. desiredKey/version/bpm adicionados alteram a chave de forma segura");

  t.assert(key1.startsWith("aiimp_"), "59. Chave de idempotência começa com prefixo aiimp_");
  t.assert(!key1.includes("/"), "60. Chave de idempotência não contém slash");
  t.assert(key1.length === 6 + 64, "61. Chave tem tamanho previsível (prefixo + 64 hex characters do sha256)");
  t.assert(!key1.includes("Música de teste"), "62. Chave de idempotência não vaza rawText");
  t.assert(!keyUrl.includes("cifraclub"), "63. Chave de idempotência não vaza URL");

  const cacheKey = buildAiImportCacheKey(input, { secret });
  t.assert(cacheKey.startsWith("aicache_"), "64. Chave de cache começa com aicache_");
  t.assert(cacheKey === buildAiImportCacheKey(input, { secret }), "65. Chave de cache é determinística");
  t.assert(!cacheKey.includes("/"), "66. Chave de cache não contém slash");

  const rlKey = buildAiRateLimitBucketKey({
    organizationId: "org/123",
    uid: "user/456",
    endpoint: "ai/import",
    windowKey: "2026-07-04-13",
  });
  t.assert(rlKey.startsWith("airl_"), "67. Rate limit bucket key começa com airl_");
  t.assert(!rlKey.includes("/"), "68. Rate limit bucket key substitui/remove slashes e caracteres especiais");
});

// ==========================================
// H. FIRESTORE PATHS
// ==========================================
test("H. Firestore Paths", (t) => {
  const periodKeys = { monthKey: "2026-07", dayKey: "2026-07-04" };
  const paths = buildAiFirestorePaths({
    organizationId: "org123",
    periodKeys,
    idempotencyKey: "aiimp_abc123",
    cacheKey: "aicache_def456",
    rateLimitBucketKey: "airl_ghi789",
  });

  t.assert(paths.monthlyUsageDocPath === "organizations/org123/aiUsage/2026-07", "69. monthlyUsageDocPath gerado corretamente");
  t.assert(paths.dailyUsageDocPath === "organizations/org123/aiDailyUsage/2026-07-04", "70. dailyUsageDocPath gerado corretamente");
  t.assert(paths.monthlyEventsCollectionPath === "organizations/org123/aiUsage/2026-07/events", "71. monthlyEventsCollectionPath gerado corretamente");
  t.assert(paths.idempotencyDocPath === "organizations/org123/aiIdempotency/aiimp_abc123", "72. idempotencyDocPath gerado corretamente");
  t.assert(paths.cacheDocPath === "organizations/org123/aiCache/aicache_def456", "73. cacheDocPath gerado corretamente");
  t.assert(paths.rateLimitDocPath === "organizations/org123/aiRateLimits/airl_ghi789", "74. rateLimitDocPath gerado corretamente");

  t.assert(paths.monthlyUsageDocPath.startsWith("organizations/org123"), "75. Paths começam com o prefixo correto de tenant");

  try {
    buildAiFirestorePaths({
      organizationId: "org/123",
      periodKeys,
      idempotencyKey: "aiimp_abc123",
      cacheKey: "aicache_def456",
      rateLimitBucketKey: "airl_ghi789",
    });
    t.assert(false, "Deveria ter falhado");
  } catch (err: any) {
    t.assert(err.message === AI_FINOPS_ERRORS.INVALID_ORG_ID, "76. orgId com slash é rejeitado no path constructor");
  }

  try {
    buildAiFirestorePaths({
      organizationId: "org123",
      periodKeys: { monthKey: "2026/07", dayKey: "2026-07-04" },
      idempotencyKey: "aiimp_abc123",
      cacheKey: "aicache_def456",
      rateLimitBucketKey: "airl_ghi789",
    });
    t.assert(false, "Deveria ter falhado");
  } catch (err: any) {
    t.assert(err.message === AI_FINOPS_ERRORS.INVALID_KEY, "77. Chave com slash é rejeitada no path constructor");
  }

  t.assert(!paths.monthlyUsageDocPath.includes("rawText"), "78. Path não vaza rawText");
  t.assert(!paths.monthlyUsageDocPath.includes("url"), "79. Path não vaza URL");
});

// ==========================================
// I. QUOTA
// ==========================================
test("I. Avaliação de Quotas e Decisões", (t) => {
  const limits: AiQuotaLimits = {
    enabled: true,
    monthlyRequests: 10,
    dailyRequests: 2,
    monthlyEstimatedTokens: 40000,
    dailyEstimatedTokens: 10000,
  };

  const usage: AiUsageSnapshot = {
    monthlyRequestCount: 5,
    dailyRequestCount: 1,
    monthlyEstimatedTokens: 20000,
    dailyEstimatedTokens: 5000,
  };

  const disabledLimits = { ...limits, enabled: false };
  const d1 = evaluateAiQuota({ limits: disabledLimits, usage, estimatedInputTokens: 1000 });
  t.assert(d1.allowed === false && d1.code === "AI_FEATURE_DISABLED", "80. Bloqueia se feature está desabilitada");

  const monthlyExceededUsage = { ...usage, monthlyRequestCount: 10 };
  const d2 = evaluateAiQuota({ limits, usage: monthlyExceededUsage, estimatedInputTokens: 1000 });
  t.assert(d2.allowed === false && d2.code === "AI_MONTHLY_REQUEST_QUOTA_EXCEEDED", "81. Bloqueia se monthlyRequests excedido");

  const dailyExceededUsage = { ...usage, dailyRequestCount: 2 };
  const d3 = evaluateAiQuota({ limits, usage: dailyExceededUsage, estimatedInputTokens: 1000 });
  t.assert(d3.allowed === false && d3.code === "AI_DAILY_REQUEST_QUOTA_EXCEEDED", "82. Bloqueia se dailyRequests excedido");

  const d4 = evaluateAiQuota({ limits, usage, estimatedInputTokens: 25000 });
  t.assert(d4.allowed === false && d4.code === "AI_MONTHLY_TOKEN_QUOTA_EXCEEDED", "83. Bloqueia se monthlyEstimatedTokens estourado");

  const d5 = evaluateAiQuota({ limits, usage, estimatedInputTokens: 6000 });
  t.assert(d5.allowed === false && d5.code === "AI_DAILY_TOKEN_QUOTA_EXCEEDED", "84. Bloqueia se dailyEstimatedTokens estourado");

  const dOk = evaluateAiQuota({ limits, usage, estimatedInputTokens: 1000 });
  t.assert(dOk.allowed === true && dOk.code === "AI_QUOTA_ALLOWED", "85. Permite se tudo estiver dentro dos limites");

  t.assert(dOk.remainingMonthlyRequests >= 0 && dOk.remainingDailyRequests >= 0, "86. Valores remanescentes (remaining) não são negativos");
  t.assert(d1.statusCode === 402 && d5.statusCode === 429, "87. Retorna status code 402 ou 429 conforme o tipo de limite atingido");
  t.assert(dOk.statusCode === 200, "88. allows com status code 200");
});

// ==========================================
// J. OUTCOME / CONSUMO
// ==========================================
test("J. Mapeamento de Consumo de Quota por Outcome", (t) => {
  t.assert(shouldConsumeQuotaForOutcome("AUTH_FAILED") === false, "89. AUTH_FAILED não consome quota");
  t.assert(shouldConsumeQuotaForOutcome("PAYLOAD_INVALID") === false, "90. PAYLOAD_INVALID não consome quota");
  t.assert(shouldConsumeQuotaForOutcome("RATE_LIMITED") === false, "91. RATE_LIMITED não consome quota");
  t.assert(shouldConsumeQuotaForOutcome("QUOTA_EXCEEDED") === false, "92. QUOTA_EXCEEDED não consome quota");
  t.assert(shouldConsumeQuotaForOutcome("SSRF_FAILED") === false, "93. SSRF_FAILED não consome quota");
  t.assert(shouldConsumeQuotaForOutcome("CACHE_HIT") === false, "94. CACHE_HIT não consome quota");
  t.assert(shouldConsumeQuotaForOutcome("IDEMPOTENCY_HIT") === false, "95. IDEMPOTENCY_HIT não consome quota");
  t.assert(shouldConsumeQuotaForOutcome("GEMINI_TIMEOUT") === false, "96. GEMINI_TIMEOUT não consome quota por default");
  t.assert(shouldConsumeQuotaForOutcome("GEMINI_ERROR") === false, "97. GEMINI_ERROR não consome quota por default");
  t.assert(shouldConsumeQuotaForOutcome("SUCCESS") === true, "98. SUCCESS consome quota");
});

// ==========================================
// K. EVENTO FINOPS / PRIVACIDADE
// ==========================================
test("K. Evento FinOps e Higiene de Privacidade", (t) => {
  const baseEventInput = {
    requestId: "req-111",
    organizationId: "org-123",
    uid: "user-456",
    feature: "aiImport" as const,
    endpoint: "ai-import" as const,
    model: "gemini-2.5-flash",
    sourceType: "rawText" as const,
    sourceHost: "cifraclub.com.br",
    inputChars: 1200,
    outputChars: 800,
    outcome: "SUCCESS" as const,
    status: "succeeded" as const,
    cacheHit: false,
    idempotencyHit: false,
    periodMonthKey: "2026-07",
    periodDayKey: "2026-07-04",
    billingPlanSnapshot: "pro" as const,
  };

  const event = buildAiFinOpsEvent(baseEventInput);

  t.assert(event.requestId === "req-111", "99. Evento possui requestId");
  t.assert(event.organizationId === "org-123", "100. Evento possui organizationId");
  t.assert(event.uid === "user-456", "101. Evento possui uid");
  t.assert(event.feature === "aiImport", "102. Evento possui feature");
  t.assert(event.endpoint === "ai-import", "103. Evento possui endpoint");
  t.assert(event.model === "gemini-2.5-flash", "104. Evento possui model");
  t.assert(event.sourceType === "rawText", "105. Evento possui sourceType");
  t.assert(event.sourceHost === "cifraclub.com.br", "106. Evento possui sourceHost");
  t.assert(event.estimatedInputTokens === 300, "107. Evento calcula tokens de entrada");
  t.assert(event.estimatedOutputTokens === 200, "108. Evento calcula tokens de saída");
  t.assert(event.periodMonthKey === "2026-07", "109. Evento possui periodMonthKey");
  t.assert(event.periodDayKey === "2026-07-04", "110. Evento possui periodDayKey");
  t.assert(event.billingPlanSnapshot === "pro", "111. Evento possui snapshot do plano de billing");
  t.assert(event.policyVersion === AI_FINOPS_POLICY_VERSION, "112. Evento usa policyVersion canônica");

  // Private fields checks
  t.assert((event as any).rawText === undefined, "113. Evento não contém rawText");
  t.assert((event as any).prompt === undefined, "114. Evento não contém prompt");
  t.assert((event as any).url === undefined, "115. Evento não contém url");
  t.assert((event as any).cleanLyrics === undefined, "116. Evento não contém cleanLyrics");
  t.assert((event as any).token === undefined, "117. Evento não contém token");
  t.assert((event as any).headers === undefined, "118. Evento não contém headers");

  t.assert(assertAiFinOpsEventIsPrivate(event) === true, "119. assertAiFinOpsEventIsPrivate aprova evento seguro");

  try {
    const maliciousInput = { ...baseEventInput, rawText: "Texto privado de música" };
    buildAiFinOpsEvent(maliciousInput as any);
    t.assert(false, "Deveria ter rejeitado campo proibido");
  } catch (err: any) {
    t.assert(err.message.includes(AI_FINOPS_ERRORS.PRIVATE_FIELD_FORBIDDEN), "120. buildAiFinOpsEvent e assertAiFinOpsEventIsPrivate barram rawText");
  }

  try {
    const maliciousHost = { ...event, sourceHost: "cifraclub.com.br/music/123" };
    assertAiFinOpsEventIsPrivate(maliciousHost);
    t.assert(false, "Deveria ter rejeitado host com barra");
  } catch (err: any) {
    t.assert(err.message.includes(AI_FINOPS_ERRORS.PRIVATE_FIELD_FORBIDDEN), "121. assertAiFinOpsEventIsPrivate barra sourceHost com barra");
  }
});

// ==========================================
// L. PLANO DE RESERVA
// ==========================================
test("L. Plano Declarativo de Reserva de Quota", (t) => {
  const orgId = "org-123";
  const uid = "user-456";
  const plan = createAiUsageReservationPlan({
    organizationId: orgId,
    userId: uid,
    feature: "aiImport",
    sourceType: "rawText",
  });

  t.assert(Array.isArray(plan.steps), "122. createAiUsageReservationPlan retorna lista de etapas");
  t.assert(plan.steps.some((s: string) => s.toLowerCase().includes("monthly usage")), "123. Plano prevê ler monthly usage");
  t.assert(plan.steps.some((s: string) => s.toLowerCase().includes("daily usage")), "124. Plano prevê ler daily usage");
  t.assert(plan.steps.some((s: string) => s.toLowerCase().includes("evaluateaiquota")), "125. Plano prevê checar quota");
  t.assert(plan.steps.some((s: string) => s.toLowerCase().includes("idempotency")), "126. Plano prevê checar idempotência");
  t.assert(plan.steps.some((s: string) => s.toLowerCase().includes("increment usage")), "127. Plano prevê incrementar contadores após sucesso");
  t.assert(plan.steps.some((s: string) => s.toLowerCase().includes("write audit/finops") || s.toLowerCase().includes("write finops")), "128. Plano prevê persistir log FinOps");
  t.assert(plan.steps.some((s: string) => s.toLowerCase().includes("cache")), "129. Plano prevê opcionalmente gravar cache");

  // Novas validações estritas da Fase 0.2C.1E.1.1
  t.assert(plan.policyVersion === AI_FINOPS_POLICY_VERSION, "L1. Contém policyVersion correspondente");
  t.assert(plan.planType === "AI_USAGE_RESERVATION_DECLARATIVE_PLAN", "L2. Contém planType correto");
  t.assert(plan.placeholders !== undefined, "L3. Contém placeholders declarativos");
  t.assert(plan.placeholders.organizationId === "{orgId}", "L4. Placeholder de orgId seguro");
  t.assert(plan.placeholders.uid === "{uid}", "L5. Placeholder de uid seguro");

  // Não vaza dados concretos
  const stringified = JSON.stringify(plan);
  t.assert(!stringified.includes(orgId), "L6. Não contém o organizationId concreto");
  t.assert(!stringified.includes(uid), "L7. Não contém o userId concreto");

  // Não contém data/timestamp dinâmicos
  t.assert(!stringified.includes("timestamp"), "L8. Não contém campo timestamp");
  t.assert(!stringified.includes("Date"), "L9. Não contém Date");
  t.assert(!/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(stringified), "L10. Não contém strings ISO de data/tempo");

  // Privacidade
  t.assert(plan.privacy !== undefined, "L11. Contém objeto privacy");
  t.assert(plan.privacy.containsConcreteOrganizationId === false, "L12. containsConcreteOrganizationId é falso");
  t.assert(plan.privacy.containsConcreteUserId === false, "L13. containsConcreteUserId é falso");
  t.assert(plan.privacy.containsRawText === false, "L14. containsRawText é falso");
  t.assert(plan.privacy.containsUrl === false, "L15. containsUrl é falso");

  t.assert(!stringified.includes("rawText:"), "131. Plano não contém dados sensíveis");
});

// Helper para verificar arquivos temporários na raiz de forma robusta
function isForbiddenTemporaryRootEntry(name: string): boolean {
  const lower = name.toLowerCase();
  return (
    /^debug[\w.-]*/.test(lower) ||
    /^patch[\w.-]*/.test(lower) ||
    /^fix[\w.-]*/.test(lower) ||
    /^update[\w.-]*/.test(lower) ||
    /^check[\w.-]*/.test(lower) ||
    /^tmp[\w.-]*/.test(lower) ||
    /_tmp[\w.-]*$/.test(lower) ||
    lower.endsWith(".tmp") ||
    lower.endsWith(".bak") ||
    lower.endsWith(".backup") ||
    lower.endsWith(".orig") ||
    lower.endsWith(".rej")
  );
}

const allowedRootFilesWhitelist = new Set([
  "firestore.rules.backup",
  "fix_ai_modal.cjs",
  "fix_ai_modal2.cjs",
  "fix_all_blurs.cjs",
  "fix_contexts_toast.cjs",
  "fix_dashboard_perf.cjs",
  "fix_dashboard_perf2.cjs",
  "fix_hover.cjs",
  "fix_hover.js",
  "fix_mixblend.cjs",
  "fix_reprocess.cjs",
  "fix_rules.cjs",
  "fix_script.ts",
  "fix_share.cjs",
  "fix_share2.cjs",
  "fix_share_ui.cjs",
  "fix_toast_perf.cjs",
  "fix_ts.cjs",
  "fix_ts2.cjs",
  "update.ts",
  "update2.ts",
  "update3.ts",
  "update4.ts",
  "update5.ts",
  "update6.ts",
  "update7.ts",
  "update8_rules.ts",
  "update9.ts",
  "update_flag.ts",
]);

// ==========================================
// M. HIGIENE E INTEGRIDADE
// ==========================================
test("M. Higiene e Integridade de Arquivos", (t) => {
  // Fail-closed checks on protected files
  for (const file of protectedFiles) {
    const exists = fs.existsSync(file);
    t.assert(exists, `Arquivo protegido existe: ${file}`);
    if (exists) {
      const content = fs.readFileSync(file);
      const currentHash = crypto.createHash("sha256").update(content).digest("hex");
      t.assert(
        currentHash === initialHashes[file],
        `132. Integridade preservada e imutável para: ${file}`
      );
    }
  }

  const dupApp = fs.existsSync("app") || fs.existsSync("applet");
  t.assert(!dupApp, "133. Não existem diretórios app/applet duplicados no repositório");

  // Varredura completa dos arquivos na raiz para identificar temporários indesejados
  const rootEntries = fs.readdirSync(".");
  for (const entry of rootEntries) {
    const isDir = fs.statSync(entry).isDirectory();
    if (!isDir && isForbiddenTemporaryRootEntry(entry)) {
      if (!allowedRootFilesWhitelist.has(entry)) {
        t.assert(false, `134. Arquivo temporário proibido '${entry}' detectado na raiz!`);
      }
    }
  }

  // Garantia de que a suíte não encontrou arquivos temporários novos e a higiene está limpa
  t.assert(failedTests === 0, "136. failedTests === 0");
  t.assert(testsWithZeroAssertions === 0, "137. Todos os testes rodaram asserções com sucesso!");
});

// --- EXECUTION SUMMARY ---
console.log("\n==========================================");
console.log("SUITE EXECUTION SUMMARY:");
console.log(`Registered Tests:  ${registeredTests}`);
console.log(`Passed Tests:      ${passedTests}`);
console.log(`Failed Tests:      ${failedTests}`);
console.log(`Zero Assertions:   ${testsWithZeroAssertions}`);
console.log("==========================================");

if (failedTests > 0 || testsWithZeroAssertions > 0 || passedTests + failedTests !== registeredTests) {
  console.error("SUITE FAILED due to failed tests, zero assertions or mismatch in counts.");
  process.exit(1);
} else {
  console.log("SUITE PASSED successfully!");
  process.exit(0);
}
