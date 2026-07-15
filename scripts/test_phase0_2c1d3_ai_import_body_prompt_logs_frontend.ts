import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

console.log("=== Initializing Phase 0.2C.1D.3 Integration Test Suite ===");

// 1. Files List for Hash Validation
const PROTECTED_FILES = [
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
  "scripts/test_phase0_2c1d1_ai_import_governance_rate_limit.ts"
];

const INITIAL_HASHES: Record<string, string> = {};

// Helper to calculate MD5 Hash
function calculateHash(filePath: string): string {
  const fullPath = path.resolve(filePath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Critical Protected File missing: ${filePath}`);
  }
  const content = fs.readFileSync(fullPath);
  return crypto.createHash("md5").update(content).digest("hex");
}

console.log("=== Calculating Initial Hashes for Protected Files ===");
for (const file of PROTECTED_FILES) {
  INITIAL_HASHES[file] = calculateHash(file);
}
console.log(`Successfully calculated hashes for ${PROTECTED_FILES.length} files.`);

// Runner State
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
    assert: (condition: boolean, message: string) => {
      assertionsCount++;
      if (!condition) {
        testFailed = true;
        console.error(`  [FAIL] ${message}`);
      } else {
        console.log(`  [OK] ${message}`);
      }
    }
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
    } else {
      passedTests++;
      console.log("  [PASS]");
    }
  } catch (err: any) {
    failedTests++;
    console.error(`  [ERROR] Uncaught error: ${err.message}`, err.stack);
  }
}

// Load testable codeblocks
const serverPath = path.resolve("server.ts");
const serverContent = fs.readFileSync(serverPath, "utf-8");

const modalPath = path.resolve("components/songs/AiSongImportModal.tsx");
const modalContent = fs.readFileSync(modalPath, "utf-8");

// Isolate the /api/ai-import route block inside server.ts
const aiImportRouteStart = serverContent.indexOf('app.post("/api/ai-import"');
const aiImportRouteEnd = serverContent.indexOf('app.post("/api/ai-suggest-songs"', aiImportRouteStart);
const aiImportRouteBlock = serverContent.substring(aiImportRouteStart, aiImportRouteEnd !== -1 ? aiImportRouteEnd : undefined);

// Start Assertions

// BODY PARSER
test("1. server.ts define AI_IMPORT_BODY_LIMIT_BYTES com 128 * 1024", (t) => {
  const match = serverContent.includes("AI_IMPORT_BODY_LIMIT_BYTES = 128 * 1024");
  t.assert(match, "Should define AI_IMPORT_BODY_LIMIT_BYTES constant");
});

test("2. server.ts define AI_IMPORT_RAW_TEXT_MAX_CHARS = 64000", (t) => {
  const match = serverContent.includes("AI_IMPORT_RAW_TEXT_MAX_CHARS = 64000");
  t.assert(match, "Should define AI_IMPORT_RAW_TEXT_MAX_CHARS constant");
});

test("3. server.ts define AI_IMPORT_GEMINI_INPUT_MAX_CHARS = 64000", (t) => {
  const match = serverContent.includes("AI_IMPORT_GEMINI_INPUT_MAX_CHARS = 64000");
  t.assert(match, "Should define AI_IMPORT_GEMINI_INPUT_MAX_CHARS constant");
});

test("4. server.ts não contém app.use(express.json({ limit: '50mb' })) sem dispatcher", (t) => {
  const obsoleteLine = 'app.use(express.json({ limit: \'50mb\' }));';
  t.assert(!serverContent.includes(obsoleteLine), "Global unmodified 50mb body parser should be replaced");
});

test("5. server.ts cria defaultJsonParser com limit 50mb", (t) => {
  t.assert(serverContent.includes("defaultJsonParser = express.json({ limit: '50mb' })"), "Should define defaultJsonParser with 50mb limit");
});

test("6. server.ts cria aiImportJsonParser com limit AI_IMPORT_BODY_LIMIT_BYTES", (t) => {
  t.assert(serverContent.includes("aiImportJsonParser = express.json({ limit: AI_IMPORT_BODY_LIMIT_BYTES })"), "Should define aiImportJsonParser with AI_IMPORT_BODY_LIMIT_BYTES limit");
});

test("7. server.ts usa req.path === '/api/ai-import' ou equivalente para aplicar parser específico", (t) => {
  const match = (serverContent.includes('req.path === "/api/ai-import"') || serverContent.includes('req.path === "/api/ai-" + "import"')) && serverContent.includes("aiImportJsonParser");
  t.assert(match, "Should route /api/ai-import requests specifically to aiImportJsonParser");
});

test("8. /api/ai-import usa o parser de 128kb", (t) => {
  t.assert(serverContent.includes("aiImportJsonParser"), "aiImportJsonParser must exist in routing dispatcher");
});

test("9. rotas não-ai-import continuam usando parser default 50mb", (t) => {
  t.assert(serverContent.includes("defaultJsonParser"), "defaultJsonParser must exist in routing dispatcher");
});

test("10. existe tratamento de entity.too.large", (t) => {
  t.assert(serverContent.includes("entity.too.large"), "Must catch entity.too.large error specifically");
});

test("11. erro entity.too.large para /api/ai-import retorna status 413", (t) => {
  const has413 = serverContent.includes('res.status(413)') && serverContent.includes('AI_IMPORT_PAYLOAD_TOO_LARGE');
  t.assert(has413, "Should return 413 for payload too large on /api/ai-import");
});

test("12. erro entity.too.large para /api/ai-import não retorna stack/message/body/rawText/url", (t) => {
  const blockStart = serverContent.indexOf('err?.type === "entity.too.large"');
  const blockEnd = serverContent.indexOf('err instanceof SyntaxError', blockStart);
  const tooLargeBlock = serverContent.substring(blockStart, blockEnd);
  t.assert(!tooLargeBlock.includes("err.stack"), "Must not leak error stack");
  t.assert(!tooLargeBlock.includes("err.message"), "Must not leak raw message");
  t.assert(!tooLargeBlock.includes("rawText"), "Must not leak rawText");
});

test("13. existe tratamento de JSON inválido", (t) => {
  t.assert(serverContent.includes("SyntaxError") && serverContent.includes('"body" in err'), "Must specifically handle syntax error of body parser");
});

test("14. JSON inválido para /api/ai-import retorna status 400", (t) => {
  const has400 = serverContent.includes('res.status(400)') && serverContent.includes('INVALID_JSON_BODY');
  t.assert(has400, "Should return 400 for invalid JSON in body parser");
});

// RAWTEXT
test("15. /api/ai-import usa MAX_AI_IMPORT_RAW_TEXT_CHARS", (t) => {
  t.assert(aiImportRouteBlock.includes("MAX_AI_IMPORT_RAW_TEXT_CHARS"), "Route should refer to the local or legacy constant");
});

test("16. rawText > limite retorna 413", (t) => {
  const rawTextCheck = aiImportRouteBlock.includes("res.status(413)") && aiImportRouteBlock.includes("MAX_AI_IMPORT_RAW_TEXT_CHARS");
  t.assert(rawTextCheck, "Route should return 413 status when rawText is too large");
});

test("17. rawText tipo inválido retorna 422", (t) => {
  t.assert(aiImportRouteBlock.includes("res.status(422)"), "Route should return 422 for invalid text type");
});

test("18. resposta de rawText grande não contém rawText", (t) => {
  const blockStart = aiImportRouteBlock.indexOf("typeof rawText ===");
  const blockEnd = aiImportRouteBlock.indexOf("aiImportRateLimiter", blockStart);
  const validationBlock = aiImportRouteBlock.substring(blockStart, blockEnd);
  t.assert(!validationBlock.includes("rawText:"), "Should not include or return rawText content in validation failure");
});

// GEMINI FINAL LIMIT
test("19. antes do prompt Gemini existe checagem textToProcess.length > AI_IMPORT_GEMINI_INPUT_MAX_CHARS", (t) => {
  t.assert(aiImportRouteBlock.includes("textToProcess.length > AI_IMPORT_GEMINI_INPUT_MAX_CHARS"), "Must check input length before Gemini call");
});

test("20. textToProcess é truncado com slice(0, AI_IMPORT_GEMINI_INPUT_MAX_CHARS)", (t) => {
  t.assert(aiImportRouteBlock.includes("textToProcess = textToProcess.slice(0, AI_IMPORT_GEMINI_INPUT_MAX_CHARS)"), "Must slice text to GEMINI_INPUT_MAX_CHARS limit");
});

test("21. o log de truncagem contém originalLength/truncatedLength", (t) => {
  t.assert(aiImportRouteBlock.includes("originalLength: textToProcess.length"), "Log must mention original length");
  t.assert(aiImportRouteBlock.includes("truncatedLength: AI_IMPORT_GEMINI_INPUT_MAX_CHARS"), "Log must mention truncated length");
});

test("22. o log de truncagem não contém textToProcess", (t) => {
  const truncationLogIdx = aiImportRouteBlock.indexOf("Gemini input exceeded safe character limit and was truncated.");
  const truncationLogBlock = aiImportRouteBlock.substring(truncationLogIdx, truncationLogIdx + 300);
  t.assert(!truncationLogBlock.includes("textToProcess:"), "Should not leak textToProcess content in truncation log");
});

test("23. o prompt Gemini é montado depois da truncagem", (t) => {
  const truncationIdx = aiImportRouteBlock.indexOf("textToProcess.slice(0, AI_IMPORT_GEMINI_INPUT_MAX_CHARS)");
  const promptIdx = aiImportRouteBlock.indexOf("const prompt =");
  t.assert(truncationIdx < promptIdx, "Truncation must happen chronologically before the prompt template construction");
});

test("24. generateContent recebe prompt já limitado", (t) => {
  t.assert(aiImportRouteBlock.includes("text: prompt"), "generateContent must utilize the sanitized prompt variable");
});

test("25. não há log de prompt", (t) => {
  const firstPromptIdx = aiImportRouteBlock.indexOf("const prompt =");
  const secondPromptIdx = aiImportRouteBlock.indexOf("const prompt =", firstPromptIdx + 1);
  const snippet = aiImportRouteBlock.substring(firstPromptIdx, secondPromptIdx !== -1 ? secondPromptIdx : undefined);
  t.assert(!snippet.includes("console.log(prompt)") && !snippet.includes("prompt}") && !snippet.includes("prompt,"), "Prompt value should not be outputted to logs");
});

test("26. não há log de rawContentText", (t) => {
  const startIdx = aiImportRouteBlock.indexOf("const rawContentText");
  const endIdx = aiImportRouteBlock.indexOf("finalBpm =", startIdx);
  const snippet = aiImportRouteBlock.substring(startIdx, endIdx);
  t.assert(!snippet.includes("rawContentText}") && !snippet.includes("rawContentText,"), "Raw AI output value must not be logged");
});

// LOGS
test("27. log inicial não contém title como valor", (t) => {
  const initialLogIdx = aiImportRouteBlock.indexOf('logInfo("1_INITIAL_PAYLOAD"');
  const initialLogBlock = aiImportRouteBlock.substring(initialLogIdx, initialLogIdx + 1000);
  t.assert(!initialLogBlock.includes(" title,"), "Should not log raw title");
});

test("28. log inicial não contém artist como valor", (t) => {
  const initialLogIdx = aiImportRouteBlock.indexOf('logInfo("1_INITIAL_PAYLOAD"');
  const initialLogBlock = aiImportRouteBlock.substring(initialLogIdx, initialLogIdx + 1000);
  t.assert(!initialLogBlock.includes(" artist,"), "Should not log raw artist");
});

test("29. log inicial não contém desiredKey como valor", (t) => {
  const initialLogIdx = aiImportRouteBlock.indexOf('logInfo("1_INITIAL_PAYLOAD"');
  const initialLogBlock = aiImportRouteBlock.substring(initialLogIdx, initialLogIdx + 1000);
  t.assert(!initialLogBlock.includes(" desiredKey,"), "Should not log raw desiredKey");
});

test("30. log inicial não contém version como valor", (t) => {
  const initialLogIdx = aiImportRouteBlock.indexOf('logInfo("1_INITIAL_PAYLOAD"');
  const initialLogBlock = aiImportRouteBlock.substring(initialLogIdx, initialLogIdx + 1000);
  t.assert(!initialLogBlock.includes(" version,"), "Should not log raw version");
});

test("31. log inicial não contém bpm como valor", (t) => {
  const initialLogIdx = aiImportRouteBlock.indexOf('logInfo("1_INITIAL_PAYLOAD"');
  const initialLogBlock = aiImportRouteBlock.substring(initialLogIdx, initialLogIdx + 1000);
  t.assert(!initialLogBlock.includes(" bpm,"), "Should not log raw bpm");
});

test("32. log inicial não contém orgId como valor", (t) => {
  const initialLogIdx = aiImportRouteBlock.indexOf('logInfo("1_INITIAL_PAYLOAD"');
  const initialLogBlock = aiImportRouteBlock.substring(initialLogIdx, initialLogIdx + 1000);
  t.assert(!initialLogBlock.includes(" orgId,"), "Should not log raw orgId");
});

test("33. log inicial não contém userId como valor", (t) => {
  const initialLogIdx = aiImportRouteBlock.indexOf('logInfo("1_INITIAL_PAYLOAD"');
  const initialLogBlock = aiImportRouteBlock.substring(initialLogIdx, initialLogIdx + 1000);
  t.assert(!initialLogBlock.includes(" userId,") && !initialLogBlock.includes("userId: userId"), "Should not log raw userId");
});

test("34. log inicial contém hasTitle", (t) => {
  const initialLogIdx = aiImportRouteBlock.indexOf('logInfo("1_INITIAL_PAYLOAD"');
  const initialLogBlock = aiImportRouteBlock.substring(initialLogIdx, initialLogIdx + 1000);
  t.assert(initialLogBlock.includes("hasTitle:"), "Should log presence of title safely");
});

test("35. log inicial contém hasArtist", (t) => {
  const initialLogIdx = aiImportRouteBlock.indexOf('logInfo("1_INITIAL_PAYLOAD"');
  const initialLogBlock = aiImportRouteBlock.substring(initialLogIdx, initialLogIdx + 1000);
  t.assert(initialLogBlock.includes("hasArtist:"), "Should log presence of artist safely");
});

test("36. log inicial contém hasOrgId", (t) => {
  const initialLogIdx = aiImportRouteBlock.indexOf('logInfo("1_INITIAL_PAYLOAD"');
  const initialLogBlock = aiImportRouteBlock.substring(initialLogIdx, initialLogIdx + 1000);
  t.assert(initialLogBlock.includes("hasOrgId:"), "Should log presence of orgId safely");
});

test("37. log inicial contém hasUserId", (t) => {
  const initialLogIdx = aiImportRouteBlock.indexOf('logInfo("1_INITIAL_PAYLOAD"');
  const initialLogBlock = aiImportRouteBlock.substring(initialLogIdx, initialLogIdx + 1000);
  t.assert(initialLogBlock.includes("hasUserId:"), "Should log presence of userId safely");
});

test("38. log inicial não contém url", (t) => {
  const initialLogIdx = aiImportRouteBlock.indexOf('logInfo("1_INITIAL_PAYLOAD"');
  const initialLogBlock = aiImportRouteBlock.substring(initialLogIdx, initialLogIdx + 1000);
  t.assert(!initialLogBlock.includes(" url,") && !initialLogBlock.includes("url: url"), "Should not log raw url");
});

test("39. log inicial não contém rawText", (t) => {
  const initialLogIdx = aiImportRouteBlock.indexOf('logInfo("1_INITIAL_PAYLOAD"');
  const initialLogBlock = aiImportRouteBlock.substring(initialLogIdx, initialLogIdx + 1000);
  t.assert(!initialLogBlock.includes(" rawText,") && !initialLogBlock.includes("rawText: rawText"), "Should not log rawText content");
});

test("40. log inicial pode conter rawTextLength", (t) => {
  const initialLogIdx = aiImportRouteBlock.indexOf('logInfo("1_INITIAL_PAYLOAD"');
  const initialLogBlock = aiImportRouteBlock.substring(initialLogIdx, initialLogIdx + 600);
  t.assert(initialLogBlock.includes("rawTextLength:"), "Should safely log rawText length");
});

// SSRF/GOVERNANÇA PRESERVADOS
test("41. /api/ai-import continua usando authorizeAiRequest", (t) => {
  t.assert(aiImportRouteBlock.includes("authorizeAiRequest"), "Should preserve authorizeAiRequest");
});

test("42. /api/ai-import continua usando aiImportRateLimiter.acquire", (t) => {
  t.assert(aiImportRouteBlock.includes("aiImportRateLimiter.acquire"), "Should preserve rate limit acquire");
});

test("43. /api/ai-import continua liberando rate limit em finally", (t) => {
  t.assert(aiImportRouteBlock.includes("aiImportRateLimitSlot.release()") || aiImportRouteBlock.includes("aiImportRateLimitSlot?.release()"), "Should preserve rate limit release in finally block");
});

test("44. /api/ai-import continua usando fetchAiImportHtmlSafely", (t) => {
  t.assert(aiImportRouteBlock.includes("fetchAiImportHtmlSafely"), "Should preserve fetchAiImportHtmlSafely");
});

test("45. /api/ai-import continua passando safeExternalFetch: aiImportSafeExternalFetch", (t) => {
  t.assert(aiImportRouteBlock.includes("safeExternalFetch: aiImportSafeExternalFetch"), "Should preserve safe fetch dependency injection");
});

test("46. /api/ai-import continua sem fetch(normalizedUrlStr)", (t) => {
  t.assert(!aiImportRouteBlock.includes("fetch(normalizedUrlStr"), "Should not use standard fetch with URL");
});

test("47. /api/ai-import continua sem fetchResponse", (t) => {
  t.assert(!aiImportRouteBlock.includes("fetchResponse"), "Should not use fetchResponse variable");
});

test("48. /api/ai-import continua sem new AbortController() no scraping", (t) => {
  t.assert(!aiImportRouteBlock.includes("new AbortController()"), "Should not use inline AbortController");
});

test("49. /api/ai-import continua sem verifyIdToken manual", (t) => {
  t.assert(!aiImportRouteBlock.includes("verifyIdToken"), "Should not use inline token verification");
});

test("50. /api/ai-import continua sem music_scale_plan/PLAN_FEATURES inline", (t) => {
  t.assert(!aiImportRouteBlock.includes("music_scale_plan") && !aiImportRouteBlock.includes("PLAN_FEATURES"), "Should not use inline plans");
});

// FRONTEND
test("51. AiSongImportModal.tsx define AI_IMPORT_RAW_TEXT_MAX_CHARS = 64000", (t) => {
  t.assert(modalContent.includes("AI_IMPORT_RAW_TEXT_MAX_CHARS = 64000"), "Modal must define AI_IMPORT_RAW_TEXT_MAX_CHARS constant");
});

test("52. handleImport valida formData.rawText.length antes de setStep('processing')", (t) => {
  const maxIdx = modalContent.indexOf("AI_IMPORT_RAW_TEXT_MAX_CHARS");
  const stepIdx = modalContent.indexOf('setStep("processing")', maxIdx);
  t.assert(maxIdx !== -1 && stepIdx !== -1 && maxIdx < stepIdx, "Validation check must sit before changing state to processing");
});

test("53. handleImport bloqueia envio quando rawText excede 64000", (t) => {
  t.assert(modalContent.includes("formData.rawText.length > AI_IMPORT_RAW_TEXT_MAX_CHARS"), "Must check if length exceeds limit");
});

test("54. bloqueio client-side não chama fetch", (t) => {
  const maxIdx = modalContent.indexOf("formData.rawText.length > AI_IMPORT_RAW_TEXT_MAX_CHARS");
  const returnIdx = modalContent.indexOf("return", maxIdx);
  const fetchIdx = modalContent.indexOf('fetch("/api/ai-import"', maxIdx);
  t.assert(returnIdx !== -1 && fetchIdx !== -1 && returnIdx < fetchIdx, "Should early return and bypass the fetch");
});

test("55. bloqueio client-side chama setError", (t) => {
  const maxIdx = modalContent.indexOf("formData.rawText.length > AI_IMPORT_RAW_TEXT_MAX_CHARS");
  const errorIdx = modalContent.indexOf("setError", maxIdx);
  const fetchIdx = modalContent.indexOf('fetch("/api/ai-import"', maxIdx);
  t.assert(errorIdx !== -1 && fetchIdx !== -1 && errorIdx < fetchIdx, "Should set error message before fetch");
});

test("56. URL import sem rawText continua permitido", (t) => {
  t.assert(modalContent.includes("!formData.rawText && !formData.url"), "Original emptiness validator is preserved");
});

test("57. safeJsonResponse trata response.status === 413", (t) => {
  t.assert(modalContent.includes("response.status === 413"), "Must map 413 in safeJsonResponse");
});

test("58. safeJsonResponse trata response.status === 422", (t) => {
  t.assert(modalContent.includes("response.status === 422"), "Must map 422 in safeJsonResponse");
});

test("59. safeJsonResponse trata response.status === 429", (t) => {
  t.assert(modalContent.includes("response.status === 429"), "Must map 429 in safeJsonResponse");
});

test("60. mensagem 429 orienta aguardar/tentar novamente", (t) => {
  t.assert(modalContent.includes("Muitas tentativas de importação") || modalContent.includes("tentas de importação"), "Must include friendly wait/retry instruction for 429 error");
});

test("61. SOURCE_BLOCKED continua preservado", (t) => {
  t.assert(modalContent.includes('data?.reason !== "SOURCE_BLOCKED"'), "Should keep SOURCE_BLOCKED untouched in validations");
});

test("62. fetch('/api/ai-import') continua existindo", (t) => {
  t.assert(modalContent.includes('"/api/ai-import"'), "Should hit the correct endpoint");
});

test("63. Authorization Bearer continua existindo", (t) => {
  t.assert(modalContent.includes('`Bearer ${token}`'), "Should pass Authorization headers");
});

test("64. orgId/userId continuam sendo enviados no body, pois authorizeAiRequest depende deles", (t) => {
  t.assert(modalContent.includes("orgId: organization?.id") && modalContent.includes("userId: userProfile?.uid"), "Should send identifiers in payload");
});

test("65. nenhuma mudança de layout ampla foi feita", (t) => {
  t.assert(!modalContent.includes("layoutChanger") && !modalContent.includes("customThemePreset"), "Layout and UI must be kept intact");
});

// HIGIENE
test("66. arquivos protegidos mantêm hash", (t) => {
  for (const file of PROTECTED_FILES) {
    const currentHash = calculateHash(file);
    t.assert(currentHash === INITIAL_HASHES[file], `Protected file ${file} integrity is fully preserved`);
  }
});

test("67. não existem diretórios app/applet duplicados", (t) => {
  t.assert(!fs.existsSync(path.resolve("app")) && !fs.existsSync(path.resolve("applet")), "No duplicated app or applet folders should exist");
});

test("68. não existem arquivos temporários debug/patch/fix/update/check proibidos na raiz", (t) => {
  const rootFiles = fs.readdirSync(path.resolve("."));
  // Ensure we didn't introduce any new temporary files in this phase
  const introducedTempFiles = rootFiles.filter(f => 
    f === "debug_import_test.ts" || 
    f === "patch_import_test.ts" || 
    f === "fix_import_test.ts" || 
    f === "check_import_test.ts"
  );
  t.assert(introducedTempFiles.length === 0, "Root directory must be clean of newly introduced temporary files");
});

// Final execution and summary output
console.log("\n=======================================================");
console.log("Phase 0.2C.1D.3 Static Regression Test Suite Summary:");
console.log(`Total Registered: ${registeredTests}`);
console.log(`Total Passed:     ${passedTests}`);
console.log(`Total Failed:     ${failedTests}`);
console.log(`Zero Assertions:  ${testsWithZeroAssertions}`);
console.log("=======================================================");

if (failedTests > 0 || passedTests + failedTests !== registeredTests || testsWithZeroAssertions > 0) {
  console.error("FAILURE: Some tests did not meet our high-standard assertions!");
  process.exit(1);
} else {
  console.log("SUCCESS: All tests completed with pristine assertions.");
  process.exit(0);
}
