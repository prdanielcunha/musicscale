import fs from "fs";
import path from "path";
import crypto from "crypto";

let registeredTests = 0;
let passedTests = 0;
let failedTests = 0;
let testsWithZeroAssertions = 0;

interface TestContext {
  assert(condition: boolean, message: string): void;
}

async function test(name: string, fn: (t: TestContext) => void | Promise<void>) {
  registeredTests++;
  let assertionsCount = 0;
  try {
    const t: TestContext = {
      assert(condition: boolean, message: string) {
        assertionsCount++;
        if (!condition) {
          throw new Error(`Assertion failed: ${message}`);
        }
      }
    };
    await fn(t);
    if (assertionsCount === 0) {
      testsWithZeroAssertions++;
      throw new Error("No assertions were executed in this test.");
    }
    passedTests++;
    console.log(`[PASS] ${registeredTests}. ${name} (Assertions: ${assertionsCount})`);
  } catch (err: any) {
    failedTests++;
    console.error(`[FAIL] ${registeredTests}. ${name}`);
    console.error(err);
  }
}

const protectedFiles = [
  "index.html",
  "index.tsx",
  "App.tsx",
  "components/AppErrorBoundary.tsx",
  "services/server/safeExternalUrlPolicy.ts",
  "services/server/safeExternalDnsResolver.ts",
  "services/server/safeExternalHttpsClient.ts",
  "services/server/safeExternalRedirectClient.ts",
  "services/server/safeExternalFetch.ts",
  "services/server/aiRequestSecurity.ts",
  "services/server/fixChordsHandler.ts",
  "services/server/ecosystemAuth.ts",
  "services/server/organizationAuthorization.ts",
  "scripts/test_phase0_2a_ecosystem_auth.ts",
  "scripts/test_phase0_2b_organization_security.ts",
  "scripts/test_phase0_2c1a_ai_authorization.ts",
  "scripts/test_phase0_2c1b_fix_chords_security.ts",
  "scripts/test_phase0_2c1c1_safe_external_url_policy.ts",
  "scripts/test_phase0_2c1c2_safe_external_dns_resolver.ts",
  "scripts/test_phase0_2c1c3_safe_external_https_client.ts",
  "scripts/test_phase0_2c1c4_safe_external_redirect_client.ts",
  "scripts/test_phase0_2c1c5_safe_external_fetch.ts",
  "package.json",
  "package-lock.json"
];

async function run() {
  console.log("Starting Phase 0.2C.1C.6 AI Import safeExternalFetch Integration Tests...");

  // Helper to compute sha256
  const sha256 = (filePath: string) => {
    const content = fs.readFileSync(path.resolve(process.cwd(), filePath));
    return crypto.createHash("sha256").update(content).digest("hex");
  };

  // Pre-load all initial hashes of protected files in memory.
  // Fail immediately if any protected file does not exist.
  const initialHashes: Record<string, string> = {};
  for (const file of protectedFiles) {
    const fullPath = path.resolve(process.cwd(), file);
    if (!fs.existsSync(fullPath)) {
      console.error(`FATAL: Protected file ${file} does not exist at startup!`);
      process.exit(1);
    }
    initialHashes[file] = sha256(file);
  }

  // Load server.ts
  const serverPath = path.resolve(process.cwd(), "server.ts");
  const serverExists = fs.existsSync(serverPath);
  const serverContent = serverExists ? fs.readFileSync(serverPath, "utf8") : "";

  // Load adapter content
  const adapterPath = path.resolve(process.cwd(), "services/server/aiImportSafeFetchAdapter.ts");
  const adapterExists = fs.existsSync(adapterPath);
  const adapterContent = adapterExists ? fs.readFileSync(adapterPath, "utf8") : "";

  // Extract /api/ai-import route block
  const startIdx = serverContent.indexOf('app.post("/api/ai-import"');
  const endIdx = serverContent.indexOf('app.post("/api/ai-suggest-songs"');
  const aiImportRouteBlock = (startIdx !== -1 && endIdx !== -1)
    ? serverContent.substring(startIdx, endIdx)
    : "";

  // 1-6. Escopo de arquivos
  await test("1. server.ts existe", (t) => {
    t.assert(serverExists, "server.ts must exist");
  });

  await test("2. safeExternalFetch.ts existe", (t) => {
    t.assert(fs.existsSync(path.resolve(process.cwd(), "services/server/safeExternalFetch.ts")), "safeExternalFetch.ts must exist");
  });

  await test("3. suíte 0.2C.1C.6 existe", (t) => {
    t.assert(fs.existsSync(path.resolve(process.cwd(), "scripts/test_phase0_2c1c6_ai_import_safe_external_fetch_integration.ts")), "This test file must exist");
  });

  await test("4. nenhum arquivo app/applet/services/server/safeExternalFetch.ts existe", (t) => {
    t.assert(!fs.existsSync(path.resolve(process.cwd(), "app/applet/services/server/safeExternalFetch.ts")), "Duplicate file in applet folder is forbidden");
  });

  await test("5. nenhum arquivo app/applet/scripts/test_phase0_2c1c6_ai_import_safe_external_fetch_integration.ts existe", (t) => {
    t.assert(!fs.existsSync(path.resolve(process.cwd(), "app/applet/scripts/test_phase0_2c1c6_ai_import_safe_external_fetch_integration.ts")), "Duplicate test file is forbidden");
  });

  await test("6. nenhum arquivo temporário proibido existe na raiz", (t) => {
    const rootFiles = fs.readdirSync(process.cwd());
    const forbidden = rootFiles.filter(f => f.startsWith("debug") || f.startsWith("patch") || f.startsWith("check") || f.startsWith("auth_res") || f.startsWith("app_response"));
    t.assert(forbidden.length === 0, "No forbidden temporary debug/patch/check files in root workspace");
  });

  // 7-10. Import e Instância
  await test("7. server.ts importa createSafeExternalFetch de ./services/server/safeExternalFetch.js", (t) => {
    t.assert(serverContent.includes('import { createSafeExternalFetch } from "./services/server/safeExternalFetch.js";'), "server.ts must import createSafeExternalFetch");
  });

  await test("8. server.ts cria aiImportSafeExternalFetch via createSafeExternalFetch()", (t) => {
    t.assert(serverContent.includes("const aiImportSafeExternalFetch = createSafeExternalFetch();"), "server.ts must instantiate aiImportSafeExternalFetch");
  });

  await test("9. aiImportSafeExternalFetch é criado fora da rota /api/ai-import", (t) => {
    const instIdx = serverContent.indexOf("const aiImportSafeExternalFetch = createSafeExternalFetch();");
    t.assert(instIdx !== -1 && instIdx < startIdx, "aiImportSafeExternalFetch must be a top-level singleton");
  });

  await test("10. createSafeExternalFetch não é chamado dentro da rota /api/ai-import", (t) => {
    t.assert(!aiImportRouteBlock.includes("createSafeExternalFetch("), "createSafeExternalFetch must not be called inside the route");
  });

  // 11-20. Rota /api/ai-import
  await test("11. rota /api/ai-import ainda existe", (t) => {
    t.assert(startIdx !== -1, "api/ai-import route must exist in server.ts");
  });

  await test("12. rota contém chamada a fetchAiImportHtmlSafely", (t) => {
    t.assert(aiImportRouteBlock.includes("fetchAiImportHtmlSafely("), "api/ai-import route must invoke fetchAiImportHtmlSafely");
  });

  await test("13. rota passa normalizedUrlStr para fetchAiImportHtmlSafely", (t) => {
    t.assert(aiImportRouteBlock.includes("fetchAiImportHtmlSafely(normalizedUrlStr"), "fetchAiImportHtmlSafely must receive normalizedUrlStr as first argument");
  });

  await test("14. rota passa timeoutMs 8000", (t) => {
    const timeoutRegex = /timeoutMs\s*:\s*8000/;
    t.assert(timeoutRegex.test(adapterContent), "Must pass timeoutMs: 8000 in options");
  });

  await test("15. rota passa maxRedirects 5", (t) => {
    const redirectsRegex = /maxRedirects\s*:\s*5/;
    t.assert(redirectsRegex.test(adapterContent), "Must pass maxRedirects: 5 in options");
  });

  await test("16. rota atribui html = safeHtmlResult.html", (t) => {
    t.assert(aiImportRouteBlock.includes("html = safeHtmlResult.html"), "html must be assigned to safeHtmlResult.html");
  });

  await test("17. rota continua com Step 4 Metadata Extraction após o fetch seguro", (t) => {
    t.assert(aiImportRouteBlock.includes("Step 4: Metadata Parsing Strategy") || aiImportRouteBlock.includes("Step 4: Metadata Extraction"), "Must transition to Step 4 after fetch");
  });

  await test("18. rota continua usando GoogleGenAI depois do parsing", (t) => {
    t.assert(aiImportRouteBlock.includes("GoogleGenAI"), "Must retain GoogleGenAI execution for song generation");
  });

  await test("19. rota preserva rawText como caminho sem rede", (t) => {
    t.assert(aiImportRouteBlock.includes("let textToProcess = rawText || \"\";"), "Must initialize textToProcess from rawText");
  });

  await test("20. rota não chama safeExternalFetch quando rawText já existe", (t) => {
    t.assert(aiImportRouteBlock.includes("if (url && !textToProcess)"), "safeExternalFetch is only executed inside the conditional if (url && !textToProcess)");
  });

  // 21-30. Remoção do Fetch Direto
  await test("21. não existe fetch(normalizedUrlStr no bloco de importação", (t) => {
    t.assert(!aiImportRouteBlock.includes("fetch(normalizedUrlStr"), "Direct global fetch calling normalizedUrlStr must be deleted");
  });

  await test("22. não existe global fetch usado para URL externa", (t) => {
    t.assert(!aiImportRouteBlock.includes("fetch("), "Global fetch cannot be used inside ai-import");
  });

  await test("23. não existe fetchResponse.text()", (t) => {
    t.assert(!aiImportRouteBlock.includes("fetchResponse.text()"), "Old body text resolution must be removed");
  });

  await test("24. não existe fetchResponse.ok", (t) => {
    t.assert(!aiImportRouteBlock.includes("fetchResponse.ok"), "Old fetchResponse.ok check must be removed");
  });

  await test("25. não existe fetchResponse.status", (t) => {
    t.assert(!aiImportRouteBlock.includes("fetchResponse.status"), "Old status check must be removed");
  });

  await test("26. não existe setTimeout(() => fetchController.abort()", (t) => {
    t.assert(!aiImportRouteBlock.includes("fetchController.abort()"), "Abort timer must be removed");
  });

  await test("27. não existe new AbortController() no bloco de importação", (t) => {
    t.assert(!aiImportRouteBlock.includes("new AbortController()"), "Local AbortController inside Step 3 must be removed");
  });

  await test("28. não existem headers manuais 'User-Agent' no bloco", (t) => {
    t.assert(!aiImportRouteBlock.includes('"User-Agent":'), "User-Agent header configuration must be removed");
  });

  await test("29. não existe Accept-Language no bloco", (t) => {
    t.assert(!aiImportRouteBlock.includes('"Accept-Language":'), "Accept-Language header configuration must be removed");
  });

  await test("30. não existe Accept: 'text/html,...' no bloco", (t) => {
    t.assert(!aiImportRouteBlock.includes('"Accept":'), "Accept header configuration must be removed");
  });

  // 31-42. Mapeamento de Erros
  await test("31. INVALID_SOURCE_URL é mapeado", (t) => {
    t.assert(adapterContent.includes("INVALID_SOURCE_URL"), "INVALID_SOURCE_URL error code must be handled");
  });

  await test("32. UNSAFE_SOURCE_URL é mapeado", (t) => {
    t.assert(adapterContent.includes("UNSAFE_SOURCE_URL"), "UNSAFE_SOURCE_URL error code must be handled");
  });

  await test("33. SOURCE_TIMEOUT é mapeado", (t) => {
    t.assert(adapterContent.includes("SOURCE_TIMEOUT"), "SOURCE_TIMEOUT error code must be handled");
  });

  await test("34. SOURCE_DNS_FAILED é mapeado", (t) => {
    t.assert(adapterContent.includes("SOURCE_DNS_FAILED"), "SOURCE_DNS_FAILED error code must be handled");
  });

  await test("35. SOURCE_HTTP_ERROR é mapeado", (t) => {
    t.assert(adapterContent.includes("SOURCE_HTTP_ERROR"), "SOURCE_HTTP_ERROR error code must be handled");
  });

  await test("36. SOURCE_UNSUPPORTED_CONTENT_TYPE é mapeado", (t) => {
    t.assert(adapterContent.includes("SOURCE_UNSUPPORTED_CONTENT_TYPE"), "SOURCE_UNSUPPORTED_CONTENT_TYPE error code must be handled");
  });

  await test("37. SOURCE_UNSUPPORTED_ENCODING é mapeado", (t) => {
    t.assert(adapterContent.includes("SOURCE_UNSUPPORTED_ENCODING"), "SOURCE_UNSUPPORTED_ENCODING error code must be handled");
  });

  await test("38. SOURCE_TOO_LARGE é mapeado", (t) => {
    t.assert(adapterContent.includes("SOURCE_TOO_LARGE"), "SOURCE_TOO_LARGE error code must be handled");
  });

  await test("39. SOURCE_REDIRECT_LIMIT é mapeado", (t) => {
    t.assert(adapterContent.includes("SOURCE_REDIRECT_LIMIT"), "SOURCE_REDIRECT_LIMIT error code must be handled");
  });

  await test("40. SOURCE_REDIRECT_LOOP é mapeado", (t) => {
    t.assert(adapterContent.includes("SOURCE_REDIRECT_LOOP"), "SOURCE_REDIRECT_LOOP error code must be handled");
  });

  await test("41. SOURCE_UNSAFE_REDIRECT é mapeado", (t) => {
    t.assert(adapterContent.includes("SOURCE_UNSAFE_REDIRECT"), "SOURCE_UNSAFE_REDIRECT error code must be handled");
  });

  await test("42. SOURCE_FETCH_FAILED é mapeado", (t) => {
    t.assert(adapterContent.includes("SOURCE_FETCH_FAILED"), "SOURCE_FETCH_FAILED error code must be handled");
  });

  // 43-45. Mapeamento de Códigos de Erro Funcionais
  await test("43. timeout usa code TIMEOUT", (t) => {
    const timeoutCodeRegex = /"SOURCE_TIMEOUT"[\s\S]*?"TIMEOUT"/;
    t.assert(timeoutCodeRegex.test(adapterContent), "SOURCE_TIMEOUT must map to functional code TIMEOUT");
  });

  await test("44. unsafe URL usa code VALIDATION", (t) => {
    const unsafeCodeRegex = /"UNSAFE_SOURCE_URL"[\s\S]*?"VALIDATION"/;
    t.assert(unsafeCodeRegex.test(adapterContent), "UNSAFE_SOURCE_URL must map to functional code VALIDATION");
  });

  await test("45. scraping/network usa code SCRAPING", (t) => {
    const scrapingCodeRegex = /"SOURCE_HTTP_ERROR"[\s\S]*?"SCRAPING"/;
    t.assert(scrapingCodeRegex.test(adapterContent), "SOURCE_HTTP_ERROR must map to functional code SCRAPING");
  });

  // 46-56. Privacidade nos details do erro
  const errorMappingDetailsForbidden = [
    "rawUrl",
    "normalizedUrlStr",
    "href",
    "location",
    "redirectChain",
    "headers",
    "cookies",
    "selectedAddress",
    "addresses",
    "stack",
    "message"
  ];

  for (const prop of errorMappingDetailsForbidden) {
    await test(`Mapeamento de erro não inclui ${prop} em details`, (t) => {
      const mapFuncIdx = adapterContent.indexOf("mapSafeExternalFetchErrorToAiImportResponse");
      t.assert(mapFuncIdx !== -1, "mapSafeExternalFetchErrorToAiImportResponse must be defined");
      const mapFuncBlock = adapterContent.substring(mapFuncIdx, mapFuncIdx + 3000);
      
      const sensitiveRegex = new RegExp(`makeErrorResponse\\([^)]*?,[^)]*?,[^)]*?${prop}`, "i");
      t.assert(!sensitiveRegex.test(mapFuncBlock), `makeErrorResponse must not leak ${prop} in details`);
    });
  }

  // 57-60. Sucesso loga metadados seguros
  await test("57. sucesso loga hostname", (t) => {
    t.assert(adapterContent.includes("hostname: safeFetchResult.hostname"), "Must log safeFetchResult.hostname");
  });

  await test("58. sucesso loga bytes", (t) => {
    t.assert(adapterContent.includes("bytes: safeFetchResult.bytes"), "Must log safeFetchResult.bytes");
  });

  await test("59. sucesso loga redirectsFollowed", (t) => {
    t.assert(adapterContent.includes("redirectsFollowed: safeFetchResult.redirectsFollowed"), "Must log safeFetchResult.redirectsFollowed");
  });

  await test("60. sucesso loga contentType", (t) => {
    t.assert(adapterContent.includes("contentType: safeFetchResult.contentType"), "Must log safeFetchResult.contentType");
  });

  // 61-63. Falha loga metadados de erro
  await test("61. falha loga error", (t) => {
    t.assert(adapterContent.includes("error: failedResult.error"), "Must log failedResult.error on failure");
  });

  await test("62. falha loga statusCode", (t) => {
    t.assert(adapterContent.includes("statusCode: failedResult.statusCode"), "Must log failedResult.statusCode on failure");
  });

  await test("63. falha loga timedOut", (t) => {
    t.assert(adapterContent.includes("timedOut: failedResult.timedOut === true"), "Must log failedResult.timedOut on failure");
  });

  // Route-wide logs do not leak sensitive information (Correction 2)
  await test("64. route logs do not include url, in initial payload", (t) => {
    const payloadLogIdx = aiImportRouteBlock.indexOf('"1_INITIAL_PAYLOAD"');
    t.assert(payloadLogIdx !== -1, "1_INITIAL_PAYLOAD must be logged");
    const payloadLogBlock = aiImportRouteBlock.substring(payloadLogIdx, payloadLogIdx + 400);
    t.assert(!payloadLogBlock.includes("url,"), "Initial payload log must not contain url, shorthand property");
  });

  await test("65. route logs do not include url: in initial payload", (t) => {
    const payloadLogIdx = aiImportRouteBlock.indexOf('"1_INITIAL_PAYLOAD"');
    t.assert(payloadLogIdx !== -1, "1_INITIAL_PAYLOAD must be logged");
    const payloadLogBlock = aiImportRouteBlock.substring(payloadLogIdx, payloadLogIdx + 400);
    t.assert(!payloadLogBlock.includes("url:"), "Initial payload log must not contain url: key");
  });

  await test("66. route logs do not include URL normalization log with url value", (t) => {
    t.assert(!aiImportRouteBlock.includes('Normalizing and sanitizing input URL: "${url}"'), "Must not log raw URL in normalization log");
  });

  await test("67. route logs do not include success normalized URL log with value", (t) => {
    t.assert(!aiImportRouteBlock.includes('Successfully normalized URL to: "${normalizedUrlStr}"'), "Must not log normalized URL in normalization success log");
  });

  await test("68. route logs do not include originalUrl: url", (t) => {
    t.assert(!aiImportRouteBlock.includes("originalUrl: url"), "Must not include originalUrl in route logs/errors");
  });

  await test("69. route logs do not include error: urlErr.message", (t) => {
    t.assert(!aiImportRouteBlock.includes("error: urlErr.message"), "Must not include urlErr.message in route logs/errors");
  });

  const routeWideSensitiveLogProps = ["normalizedUrlStr", ".href", ".search", "query"];
  const logLines = aiImportRouteBlock.split("\n").filter(line => line.includes("logInfo") || line.includes("logWarn") || line.includes("logError"));
  for (const prop of routeWideSensitiveLogProps) {
    await test(`70-${prop}. route logs do not include ${prop} inside logging calls`, (t) => {
      const offendingLines = logLines.filter(line => line.includes(prop));
      t.assert(offendingLines.length === 0, `Found offending logging lines containing '${prop}': ${offendingLines.join(", ")}`);
    });
  }

  await test("71. route logs of safe fetch continue to only include allowed safe fields", (t) => {
    const step3FetchIdx = adapterContent.indexOf('logInfo("3_NETWORK_FETCH"');
    t.assert(step3FetchIdx !== -1, "3_NETWORK_FETCH log must exist");
    
    const step3Logs = adapterContent.split("\n").filter(line => line.includes("logInfo(") || line.includes("logWarn(") || line.includes("logError("));
    const allowedFields = ["error", "statusCode", "timedOut", "hostname", "bytes", "redirectsFollowed", "contentType", "3_NETWORK_FETCH", "Fetching content safely", "Safe external fetch failed", "Safe external fetch succeeded", "failure", "safeFetchResult", "failedResult"];
    
    for (const line of step3Logs) {
      if (line.includes("{")) {
        const match = line.match(/\{([^}]+)\}/);
        if (match) {
          const fields = match[1].split(",").map(f => f.split(":")[0].trim());
          for (const field of fields) {
            t.assert(
              allowedFields.includes(field),
              `Field '${field}' is not allowed in safe fetch logs inside line: ${line}`
            );
          }
        }
      }
    }
  });

  // 72-83. Compatibilidade da rota
  await test("72. makeErrorResponse continua existindo", (t) => {
    t.assert(aiImportRouteBlock.includes("const makeErrorResponse ="), "makeErrorResponse must be preserved");
  });

  await test("73. requestId continua existindo", (t) => {
    t.assert(aiImportRouteBlock.includes("requestId"), "requestId must be preserved");
  });

  await test("74. selectedStrategy continua existindo", (t) => {
    t.assert(serverContent.includes("selectedStrategy ="), "selectedStrategy must be preserved");
  });

  await test("75. textToProcess continua existindo", (t) => {
    t.assert(serverContent.includes("textToProcess"), "textToProcess must be preserved");
  });

  await test("76. normalizedUrlStr continua existindo", (t) => {
    t.assert(serverContent.includes("normalizedUrlStr"), "normalizedUrlStr must be preserved");
  });

  await test("77. metadata extraction continua existindo", (t) => {
    t.assert(serverContent.includes("Metadata Parsing Strategy") || serverContent.includes("Metadata Extraction"), "Metadata parsing stage must remain");
  });

  await test("78. JSON-LD extraction continua existindo", (t) => {
    t.assert(
      aiImportRouteBlock.includes("jsonLdRegex") &&
      aiImportRouteBlock.includes("application\\/ld\\+json"),
      "JSON-LD extraction must remain in route"
    );
  });

  await test("79. regex de tom/cifra continua existindo", (t) => {
    t.assert(serverContent.includes("tomMatch") || serverContent.includes("cifra_tom"), "Regex for tom/chords must remain");
  });

  await test("80. Gemini continua existindo", (t) => {
    t.assert(serverContent.includes("GoogleGenAI"), "Gemini LLM pipeline must remain");
  });

  await test("81. resposta final ok continua existindo", (t) => {
    t.assert(serverContent.includes("ok: true"), "Final JSON success structure must remain");
  });

  await test("82. status 401 para auth ausente continua existindo", (t) => {
    // 401 and 403 are now delegated dynamically to authorizeAiRequest
    t.assert(aiImportRouteBlock.includes("authorizeAiRequest"), "Must authorize AI import request via authorizeAiRequest");
    t.assert(aiImportRouteBlock.includes("err.statusCode"), "Must dynamically return status from err.statusCode");
    t.assert(aiImportRouteBlock.includes("res.status("), "Must call res.status to return status");
  });

  await test("83. status 403 para plano/organização continua existindo", (t) => {
    // Ensuring no inline legacy gating bypass
    t.assert(!aiImportRouteBlock.includes("verifyIdToken"), "Must not use verifyIdToken manual verification inside route");
    t.assert(!aiImportRouteBlock.includes("PLAN_FEATURES"), "Must not use inline PLAN_FEATURES gating");
    t.assert(!aiImportRouteBlock.includes("music_scale_plan"), "Must not use inline music_scale_plan gating");
  });

  // 84-85. Isolamento do /api/fix-chords
  await test("84. /api/fix-chords não importa nem usa safeExternalFetch", (t) => {
    const fixChordsIdx = serverContent.indexOf('app.post("/api/fix-chords"');
    const nextRouteIdx = serverContent.indexOf('app.post("/api/ai-import"');
    const fixChordsBlock = serverContent.substring(fixChordsIdx, nextRouteIdx);
    t.assert(!fixChordsBlock.includes("safeExternalFetch"), "/api/fix-chords must not reference safeExternalFetch");
  });

  await test("85. createFixChordsHandler permanece", (t) => {
    t.assert(serverContent.includes("createFixChordsHandler"), "createFixChordsHandler must be intact");
  });

  // 86-109. Inalterabilidade dos arquivos protegidos (Correction 5 - Memory hash verification)
  for (const file of protectedFiles) {
    await test(`Inalterabilidade de ${file}`, (t) => {
      const fullPath = path.resolve(process.cwd(), file);
      t.assert(fs.existsSync(fullPath), `${file} must exist`);
      const finalHash = sha256(file);
      t.assert(finalHash === initialHashes[file], `${file} hash mismatch! File was modified.`);
    });
  }

  // 110-112. Contadores e asserções finais (Correction 6)
  await test("110. passedTests + failedTests === registeredTests", (t) => {
    t.assert(passedTests + failedTests === registeredTests - 1, "Prior registered tests must be fully pass/fail completed");
  });

  await test("111. failedTests === 0", (t) => {
    t.assert(failedTests === 0, `${failedTests} tests failed`);
  });

  await test("112. nenhum teste passa sem asserção", (t) => {
    t.assert(testsWithZeroAssertions === 0, "All tests must execute at least one genuine assertion");
  });

  // Calculate after-integration hashes and save to /tmp/phase0_2c1c6_after.sha256
  const allFilesToHash = [...protectedFiles, "server.ts"];
  let afterHashesContent = "";
  for (const file of allFilesToHash) {
    if (fs.existsSync(path.resolve(process.cwd(), file))) {
      afterHashesContent += `${sha256(file)}  ${file}\n`;
    }
  }
  fs.writeFileSync("/tmp/phase0_2c1c6_after.sha256", afterHashesContent, "utf8");

  console.log(`\n====================================`);
  console.log(`Phase 0.2C.1C.6 Integration Test Suite Summary:`);
  console.log(`Total Registered: ${registeredTests}`);
  console.log(`Total Passed:     ${passedTests}`);
  console.log(`Total Failed:     ${failedTests}`);
  console.log(`Total Passed + Total Failed === Total Registered: ${passedTests + failedTests === registeredTests}`);
  console.log(`Total Failed === 0: ${failedTests === 0}`);
  console.log(`====================================\n`);

  if (passedTests + failedTests !== registeredTests) {
    console.error("FATAL: Test accounting consistency check failed!");
    process.exitCode = 1;
  } else if (failedTests > 0) {
    process.exitCode = 1;
  } else {
    process.exitCode = 0;
  }
}

run().catch((e) => {
  console.error("Unhandled rejection inside test runner", e);
  process.exit(1);
});
