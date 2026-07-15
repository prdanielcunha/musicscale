import fs from 'fs';
import path from 'path';
import { resolveAiImportFinOpsOutcome, sanitizeAiImportFinOpsErrorCode } from '../services/server/aiImportFinOpsOutcomeMapper';

let registeredTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, message: string) {
  registeredTests++;
  if (condition) {
    console.log(`  [OK] ${message}`);
    passedTests++;
  } else {
    console.error(`  [ERRO] ${message}`);
    failedTests++;
  }
}

async function runTests() {
  console.log("=== EXECUTANDO TESTES DO MAPPER DE FINOPS ===\\n");

  console.log("Running test: A. Escopo e higiene");
  const mapperPath = path.resolve(process.cwd(), 'services/server/aiImportFinOpsOutcomeMapper.ts');
  assert(fs.existsSync(mapperPath), "Arquivo services/server/aiImportFinOpsOutcomeMapper.ts existe");

  if (fs.existsSync(mapperPath)) {
    const content = fs.readFileSync(mapperPath, 'utf8');
    assert(!content.includes('firebase-admin'), "não importa firebase-admin");
    assert(!content.includes('express'), "não importa express");
    assert(!content.includes('server.ts'), "não importa server.ts");
    assert(!content.includes('GoogleGenAI'), "não importa GoogleGenAI");
    assert(!content.includes(' fetch('), "não usa fetch");
    assert(!content.includes('Firestore'), "não usa Firestore");
    assert(!content.includes('Date.now'), "não usa Date.now");
    assert(!content.includes('process.env'), "não usa process.env");
  } else {
    assert(false, "não importa firebase-admin");
    assert(false, "não importa express");
    assert(false, "não importa server.ts");
    assert(false, "não importa GoogleGenAI");
    assert(false, "não usa fetch");
    assert(false, "não usa Firestore");
    assert(false, "não usa Date.now");
    assert(false, "não usa process.env");
  }

  console.log("\\nRunning test: B. Mapeamentos principais");
  const t1 = resolveAiImportFinOpsOutcome({ cacheHit: true });
  assert(t1.outcome === "CACHE_HIT" && t1.shouldConsumeQuota === false && t1.cacheHit === true, "cacheHit -> CACHE_HIT");

  const t2 = resolveAiImportFinOpsOutcome({ idempotencyHit: true });
  assert(t2.outcome === "IDEMPOTENCY_HIT" && t2.shouldConsumeQuota === false && t2.idempotencyHit === true, "idempotencyHit -> IDEMPOTENCY_HIT");

  const t3 = resolveAiImportFinOpsOutcome({ quotaBlocked: true });
  assert(t3.outcome === "QUOTA_EXCEEDED" && t3.shouldConsumeQuota === false, "quotaBlocked -> QUOTA_EXCEEDED");

  const t4 = resolveAiImportFinOpsOutcome({ rateLimited: true });
  assert(t4.outcome === "RATE_LIMITED" && t4.shouldConsumeQuota === false, "rateLimited -> RATE_LIMITED");

  const t5 = resolveAiImportFinOpsOutcome({ httpStatus: 401 });
  assert(t5.outcome === "AUTH_FAILED" && t5.shouldConsumeQuota === false, "httpStatus 401 -> AUTH_FAILED");

  const t6 = resolveAiImportFinOpsOutcome({ httpStatus: 403 });
  assert(t6.outcome === "AUTH_FAILED" && t6.shouldConsumeQuota === false, "httpStatus 403 -> AUTH_FAILED");

  const t7 = resolveAiImportFinOpsOutcome({ routeCode: "VALIDATION" });
  assert(t7.outcome === "PAYLOAD_INVALID" && t7.shouldConsumeQuota === false, "routeCode VALIDATION -> PAYLOAD_INVALID");

  const t8 = resolveAiImportFinOpsOutcome({ step: "BODY_PARSER" });
  assert(t8.outcome === "PAYLOAD_INVALID", "step BODY_PARSER -> PAYLOAD_INVALID");

  const t9 = resolveAiImportFinOpsOutcome({ step: "1_INITIAL_PAYLOAD" });
  assert(t9.outcome === "PAYLOAD_INVALID", "step 1_INITIAL_PAYLOAD -> PAYLOAD_INVALID");

  const t10 = resolveAiImportFinOpsOutcome({ routeCode: "SCRAPING", errorCode: "SSRF_FAILED" });
  assert(t10.outcome === "SSRF_FAILED", "routeCode SCRAPING + errorCode SSRF_FAILED -> SSRF_FAILED");

  const t11 = resolveAiImportFinOpsOutcome({ errorCode: "SAFE_FETCH_BLOCKED" });
  assert(t11.outcome === "SSRF_FAILED", "errorCode SAFE_FETCH_BLOCKED -> SSRF_FAILED");

  const t11b = resolveAiImportFinOpsOutcome({ errorCode: "SAFE_EXTERNAL_FETCH_BLOCKED" });
  assert(t11b.outcome === "SSRF_FAILED", "errorCode SAFE_EXTERNAL_FETCH_BLOCKED -> SSRF_FAILED");

  const t12 = resolveAiImportFinOpsOutcome({ routeCode: "TIMEOUT" });
  assert(t12.outcome === "GEMINI_TIMEOUT", "routeCode TIMEOUT -> GEMINI_TIMEOUT");

  const t13 = resolveAiImportFinOpsOutcome({ errorCode: "GEMINI_TIMEOUT" });
  assert(t13.outcome === "GEMINI_TIMEOUT", "errorCode GEMINI_TIMEOUT -> GEMINI_TIMEOUT");

  const t14 = resolveAiImportFinOpsOutcome({ routeCode: "GEMINI" });
  assert(t14.outcome === "GEMINI_ERROR", "routeCode GEMINI -> GEMINI_ERROR");

  const t15 = resolveAiImportFinOpsOutcome({ routeCode: "PARSING", step: "9_RESP_PARSING" });
  assert(t15.outcome === "GEMINI_INVALID_JSON", "routeCode PARSING + step 9_RESP_PARSING -> GEMINI_INVALID_JSON");

  const t16 = resolveAiImportFinOpsOutcome({ usedDeterministicFallback: true });
  assert(t16.outcome === "DETERMINISTIC_FALLBACK", "usedDeterministicFallback true -> DETERMINISTIC_FALLBACK");

  const t17 = resolveAiImportFinOpsOutcome({ ok: true });
  assert(t17.outcome === "SUCCESS" && t17.shouldConsumeQuota === true, "ok true -> SUCCESS, shouldConsumeQuota true");

  console.log("\\nRunning test: C. Ordem de precedência");
  const p1 = resolveAiImportFinOpsOutcome({ cacheHit: true, ok: true });
  assert(p1.outcome === "CACHE_HIT", "cacheHit deve vencer ok true");

  const p2 = resolveAiImportFinOpsOutcome({ idempotencyHit: true, ok: true });
  assert(p2.outcome === "IDEMPOTENCY_HIT", "idempotencyHit deve vencer ok true");

  const p3 = resolveAiImportFinOpsOutcome({ quotaBlocked: true, ok: true });
  assert(p3.outcome === "QUOTA_EXCEEDED", "quotaBlocked deve vencer ok true");

  const p4 = resolveAiImportFinOpsOutcome({ rateLimited: true, ok: true });
  assert(p4.outcome === "RATE_LIMITED", "rateLimited deve vencer ok true");

  const p5 = resolveAiImportFinOpsOutcome({ step: "AUTH", errorCode: "UNKNOWN_ERROR" });
  assert(p5.outcome === "AUTH_FAILED", "AUTH deve vencer erro genérico");

  const p6 = resolveAiImportFinOpsOutcome({ usedDeterministicFallback: true, routeCode: "PARSING" });
  assert(p6.outcome === "DETERMINISTIC_FALLBACK", "DETERMINISTIC_FALLBACK não deve ser sobrescrito por routeCode PARSING");

  console.log("\\nRunning test: D. Sanitização de safeErrorCode");
  assert(sanitizeAiImportFinOpsErrorCode("gemini timeout") === "GEMINI_TIMEOUT", "'gemini timeout' -> 'GEMINI_TIMEOUT'");
  assert(sanitizeAiImportFinOpsErrorCode("Gemini.Invalid.Json") === "GEMINI_INVALID_JSON", "'Gemini.Invalid.Json' -> 'GEMINI_INVALID_JSON'");
  assert(sanitizeAiImportFinOpsErrorCode("A".repeat(100))?.length === 80, "string com mais de 80 caracteres é truncada");
  assert(sanitizeAiImportFinOpsErrorCode("https://site.com/path?token=abc") === "AI_IMPORT_ERROR", "'https://...' -> 'AI_IMPORT_ERROR'");
  assert(sanitizeAiImportFinOpsErrorCode("Bearer abc") === "AI_IMPORT_ERROR", "'Bearer abc' -> 'AI_IMPORT_ERROR'");
  assert(sanitizeAiImportFinOpsErrorCode("authorization failed") === "AI_IMPORT_ERROR", "'authorization failed' -> 'AI_IMPORT_ERROR'");
  assert(sanitizeAiImportFinOpsErrorCode("cookie=session") === "AI_IMPORT_ERROR", "'cookie=session' -> 'AI_IMPORT_ERROR'");
  assert(sanitizeAiImportFinOpsErrorCode(null) === null, "null -> null");
  assert(sanitizeAiImportFinOpsErrorCode(undefined) === null, "undefined -> null");
  assert(sanitizeAiImportFinOpsErrorCode({}) === "AI_IMPORT_ERROR", "objeto -> código seguro ou null, sem vazar conteúdo");

  console.log("\\nRunning test: E. Privacidade");
  const privacyInput = {
    errorCode: "TEST_ERROR",
    rawText: "secret text",
    prompt: "secret prompt",
    url: "https://secret.com",
    sourceUrl: "https://secret.com/2",
    lyrics: "secret lyrics",
    chords: "secret chords",
    cleanLyrics: "clean secret",
    cleanChords: "clean secret chords",
    headers: { "Authorization": "Bearer x" },
    cookies: "session=x",
    authorization: "Bearer y",
    token: "abc",
    stack: "Error: oops\\n at ...",
    message: "raw error message"
  };

  const privacyResult = resolveAiImportFinOpsOutcome(privacyInput);
  
  const anyResult = privacyResult as any;
  assert(anyResult.rawText === undefined, "resultado não contém rawText");
  assert(anyResult.url === undefined, "resultado não contém url");
  assert(anyResult.prompt === undefined, "resultado não contém prompt");
  assert(anyResult.lyrics === undefined, "resultado não contém lyrics");
  assert(anyResult.chords === undefined, "resultado não contém chords");
  assert(anyResult.headers === undefined, "resultado não contém headers");
  assert(anyResult.token === undefined, "resultado não contém token");
  assert(anyResult.stack === undefined, "resultado não contém stack");
  assert(anyResult.message === undefined, "resultado não contém message");
  
  assert(privacyResult.safeErrorCode === "TEST_ERROR", "safeErrorCode não vazou dados, retornou TEST_ERROR");

  console.log("\\n=============================================");
  console.log("SUITE EXECUTION SUMMARY:");
  let zeroAsserts = 'NO';
  if (passedTests === 0) zeroAsserts = 'YES';

  console.log(`Registered Tests:  ${registeredTests}`);
  console.log(`Passed Tests:      ${passedTests}`);
  console.log(`Failed Tests:      ${failedTests}`);
  console.log(`Zero Assertions:   ${zeroAsserts}`);
  console.log("==========================================");

  if (failedTests > 0 || passedTests !== registeredTests || passedTests === 0) {
    console.error("SUITE FAILED.");
    process.exit(1);
  } else {
    console.log("SUITE PASSED successfully!");
    process.exit(0);
  }
}

runTests().catch(e => {
  console.error("Unhandled exception:", e);
  process.exit(1);
});
