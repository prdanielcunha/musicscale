import fs from "fs";

let registeredTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, message: string) {
  registeredTests++;
  if (!condition) {
    console.error(`  [FAIL] ${message}`);
    failedTests++;
  } else {
    console.log(`  [OK] ${message}`);
    passedTests++;
  }
}

async function runIntegrationTests() {
  console.log("=== RUNNING TEST: 0.2C.1E.9 FinOps Shadow-Write Integration ===");

  // Scenario 1: Verify presence and exact structure of markers in server.ts
  console.log("\nScenario 1: Verify presence of shadow-write markers in server.ts");
  const serverContent = fs.readFileSync("server.ts", "utf8");

  assert(
    serverContent.includes("// AI_FINOPS_SHADOW_WRITE_PATH_START") &&
    serverContent.includes("// AI_FINOPS_SHADOW_WRITE_PATH_END"),
    "server.ts contains AI_FINOPS_SHADOW_WRITE_PATH_START and END markers"
  );

  assert(
    serverContent.includes("// AI_FINOPS_SHADOW_WRITE_FINALIZE_START") &&
    serverContent.includes("// AI_FINOPS_SHADOW_WRITE_FINALIZE_END"),
    "server.ts contains AI_FINOPS_SHADOW_WRITE_FINALIZE_START and END markers"
  );

  assert(
    serverContent.includes("// AI_FINOPS_SHADOW_WRITE_FINALIZE_FALLBACK_START") &&
    serverContent.includes("// AI_FINOPS_SHADOW_WRITE_FINALIZE_FALLBACK_END"),
    "server.ts contains AI_FINOPS_SHADOW_WRITE_FINALIZE_FALLBACK_START and END markers"
  );

  const idxAiImportRoute = serverContent.indexOf('app.post("/api/ai-import"');
  assert(idxAiImportRoute > 0, "Found /api/ai-import POST route in server.ts");

  // Scenario 2: Validate feature flag check and HMAC secret safety
  console.log("\nScenario 2: Validate feature flag and secret protection in server.ts");
  const beginBlock = serverContent.substring(
    serverContent.indexOf("// AI_FINOPS_SHADOW_WRITE_PATH_START", idxAiImportRoute),
    serverContent.indexOf("// AI_FINOPS_SHADOW_WRITE_PATH_END", idxAiImportRoute)
  );

  assert(
    beginBlock.includes('process.env.AI_IMPORT_FINOPS_WRITE_PATH_ENABLED === "true"'),
    "Shadow write path check is protected by AI_IMPORT_FINOPS_WRITE_PATH_ENABLED flag"
  );

  assert(
    beginBlock.includes("process.env.AI_FINOPS_HMAC_SECRET"),
    "Shadow write path check verifies the existence of AI_FINOPS_HMAC_SECRET"
  );

  assert(
    beginBlock.includes("beginAiImportFinOpsWritePath"),
    "Shadow write block invokes beginAiImportFinOpsWritePath helper"
  );

  // Scenario 3: Verify finalize safety and local function presence
  console.log("\nScenario 3: Validate local safe finalize logic");
  const finalizeBlock = serverContent.substring(
    serverContent.indexOf("// AI_FINOPS_SHADOW_WRITE_FINALIZE_START", idxAiImportRoute),
    serverContent.indexOf("// AI_FINOPS_SHADOW_WRITE_FINALIZE_END", idxAiImportRoute)
  );

  assert(
    finalizeBlock.includes("finalizeAiImportFinOpsShadowWriteOnce"),
    "Local helper finalizeAiImportFinOpsShadowWriteOnce is declared"
  );

  assert(
    finalizeBlock.includes("finalizeAiImportFinOpsWritePath"),
    "Local helper calls external finalizeAiImportFinOpsWritePath"
  );

  assert(
    finalizeBlock.includes("aiImportFinOpsWriteFinalized = true"),
    "Local helper sets aiImportFinOpsWriteFinalized state to ensure idempotency"
  );

  // Scenario 4: Verify fallback finalization in finally block
  console.log("\nScenario 4: Validate fallback finalization block in server.ts");
  const fallbackBlock = serverContent.substring(
    serverContent.indexOf("// AI_FINOPS_SHADOW_WRITE_FINALIZE_FALLBACK_START", idxAiImportRoute),
    serverContent.indexOf("// AI_FINOPS_SHADOW_WRITE_FINALIZE_FALLBACK_END", idxAiImportRoute)
  );

  assert(
    fallbackBlock.includes("aiImportFinOpsWriteContext"),
    "Fallback checks for active aiImportFinOpsWriteContext"
  );

  assert(
    fallbackBlock.includes("!aiImportFinOpsWriteFinalized"),
    "Fallback checks if transaction has not yet been finalized"
  );

  assert(
    fallbackBlock.includes("finalizeAiImportFinOpsShadowWriteOnce"),
    "Fallback invokes finalizeAiImportFinOpsShadowWriteOnce on exit"
  );

  // Requirement A: Escopo e higiene
  console.log("\nRequirement A: Escopo e higiene");
  assert(fs.existsSync("server.ts"), "server.ts exists");
  assert(fs.existsSync("services/server/aiImportFinOpsWritePath.ts"), "aiImportFinOpsWritePath.ts exists");
  assert(fs.existsSync("scripts/test_phase0_2c1e8_ai_import_finops_write_path.ts"), "0.2C.1E.8 test exists");
  assert(fs.existsSync("scripts/test_phase0_2c1e9_ai_import_finops_shadow_write_integration.ts"), "0.2C.1E.9 test exists");
  assert(!fs.existsSync("run_test.js"), "run_test.js does not exist");
  assert(!fs.existsSync("run_test2.js"), "run_test2.js does not exist");
  assert(!fs.existsSync("scripts/test_gate_check.ts"), "test_gate_check.ts does not exist");

  // Requirement B: Imports corretos
  console.log("\nRequirement B: Imports corretos");
  assert(serverContent.includes('beginAiImportFinOpsWritePath'), "server.ts contains beginAiImportFinOpsWritePath");
  assert(serverContent.includes('finalizeAiImportFinOpsWritePath'), "server.ts contains finalizeAiImportFinOpsWritePath");
  assert(
    serverContent.includes('import { beginAiImportFinOpsWritePath, finalizeAiImportFinOpsWritePath } from "./services/server/aiImportFinOpsWritePath.js"') ||
    serverContent.includes('import { beginAiImportFinOpsWritePath, finalizeAiImportFinOpsWritePath } from "./services/server/aiImportFinOpsWritePath"'),
    "server.ts imports from ./services/server/aiImportFinOpsWritePath.js or relative"
  );
  assert(!serverContent.includes('beginAiFinOpsReservation'), "server.ts does NOT directly import/use beginAiFinOpsReservation");
  assert(!serverContent.includes('finalizeAiFinOpsReservation'), "server.ts does NOT directly import/use finalizeAiFinOpsReservation");
  assert(!serverContent.includes('AiFinOpsRepositoryInput'), "server.ts does NOT import AiFinOpsRepositoryInput");

  // Requirement C: Feature flag e secret
  console.log("\nRequirement C: Feature flag e secret");
  assert(serverContent.includes('process.env.AI_IMPORT_FINOPS_WRITE_PATH_ENABLED === "true"'), "server.ts checks write-path enabled flag explicitly");
  assert(serverContent.includes('process.env.AI_FINOPS_HMAC_SECRET'), "server.ts accesses AI_FINOPS_HMAC_SECRET");
  assert(serverContent.includes('AI_IMPORT_FINOPS_WRITE_PATH_ENABLED'), "server.ts has AI_IMPORT_FINOPS_WRITE_PATH_ENABLED");
  assert(serverContent.includes('AI_IMPORT_FINOPS_READ_PATH_ENABLED'), "server.ts has AI_IMPORT_FINOPS_READ_PATH_ENABLED");
  assert(
    serverContent.indexOf('AI_IMPORT_FINOPS_WRITE_PATH_ENABLED') !== serverContent.indexOf('AI_IMPORT_FINOPS_READ_PATH_ENABLED'),
    "Write path and read path flags are distinct"
  );

  // Requirement D: Marcadores obrigatórios
  console.log("\nRequirement D: Marcadores obrigatórios");
  const markers = [
    "AI_FINOPS_SHADOW_WRITE_PATH_START",
    "AI_FINOPS_SHADOW_WRITE_PATH_END",
    "AI_FINOPS_SHADOW_WRITE_FINALIZE_START",
    "AI_FINOPS_SHADOW_WRITE_FINALIZE_END",
    "AI_FINOPS_SHADOW_WRITE_FINALIZE_FALLBACK_START",
    "AI_FINOPS_SHADOW_WRITE_FINALIZE_FALLBACK_END"
  ];
  for (const marker of markers) {
    assert(serverContent.includes(marker), `server.ts contains marker: ${marker}`);
  }

  // Requirement E: Posicionamento por índice
  console.log("\nRequirement E: Posicionamento por índice");
  const idxPreProcessing = serverContent.indexOf("6.5_PRE_PROCESSING", idxAiImportRoute);
  const idxShadowWriteStart = serverContent.indexOf("AI_FINOPS_SHADOW_WRITE_PATH_START", idxAiImportRoute);
  const idxGeminiPreparation = serverContent.indexOf("7_GEMINI_PREPARATION", idxAiImportRoute);
  const idxFinalizeStart = serverContent.indexOf("AI_FINOPS_SHADOW_WRITE_FINALIZE_START", idxAiImportRoute);
  const idxFallbackStart = serverContent.indexOf("AI_FINOPS_SHADOW_WRITE_FINALIZE_FALLBACK_START", idxAiImportRoute);
  const idxRelease = serverContent.indexOf("aiImportRateLimitSlot.release()", idxAiImportRoute);

  assert(idxPreProcessing < idxShadowWriteStart, "6.5_PRE_PROCESSING appears before shadow write start");
  assert(idxShadowWriteStart < idxGeminiPreparation, "shadow write start appears before 7_GEMINI_PREPARATION");
  assert(idxFinalizeStart > 0, "finalize start block exists");

  // Success finalize occurrence checking
  const idxOutcomeSuccess = serverContent.indexOf('outcome: "SUCCESS"', idxAiImportRoute);
  const idxResJson = serverContent.indexOf("return res.json({", idxOutcomeSuccess);
  assert(idxOutcomeSuccess < idxResJson && idxOutcomeSuccess > 0, "SUCCESS finalize occurs before final res.json");
  assert(idxFallbackStart > 0, "fallback start marker exists");
  assert(idxFallbackStart < idxRelease, "fallback occurs before slot release");

  // Requirement F: Bloco begin shadow-only
  console.log("\nRequirement F: Bloco begin shadow-only");
  const shadowBeginContent = serverContent.substring(idxShadowWriteStart, serverContent.indexOf("AI_FINOPS_SHADOW_WRITE_PATH_END", idxAiImportRoute));
  const forbiddenKeywordsInBegin = ["return res.", "res.json", "res.status", "throw", "makeErrorResponse", "beginAiFinOpsReservation", "finalizeAiFinOpsReservation"];
  for (const kw of forbiddenKeywordsInBegin) {
    assert(!shadowBeginContent.includes(kw), `Shadow begin block does not contain forbidden keyword: '${kw}'`);
  }

  // Requirement G: Ausência de alteração no response público
  console.log("\nRequirement G: Ausência de alteração no response público");
  const resBlock = serverContent.substring(idxResJson, serverContent.indexOf("});", idxResJson) + 3);
  const forbiddenResponseKeys = [
    "finOps", "aiFinOps", "cacheHit", "idempotencyHit", "quotaStatus", "quotaBlocked", "billing", "usage", "plan", "entitlement"
  ];
  for (const rk of forbiddenResponseKeys) {
    assert(!resBlock.includes(`"${rk}":`) && !resBlock.includes(`${rk}:`), `Public response does not expose key: '${rk}'`);
  }
  const knownResponseKeys = [
    "ok", "song", "result", "processingTimeMs", "usedAi", "requestId", "metrics"
  ];
  for (const kk of knownResponseKeys) {
    assert(resBlock.includes(kk), `Public response preserves key: '${kk}'`);
  }

  // Requirement H: Finalize success seguro
  console.log("\nRequirement H: Finalize success seguro");
  const successFinalizeBlock = serverContent.substring(idxOutcomeSuccess - 200, idxOutcomeSuccess + 400);
  assert(successFinalizeBlock.includes("finalizeAiImportFinOpsShadowWriteOnce"), "Success finalize block calls finalizeAiImportFinOpsShadowWriteOnce");
  assert(successFinalizeBlock.includes("estimatedOutputChars"), "Success finalize block calculates estimatedOutputChars");
  assert(successFinalizeBlock.includes("cacheSummary"), "Success finalize block passes cacheSummary");
  assert(successFinalizeBlock.includes("title"), "cacheSummary includes title");
  assert(successFinalizeBlock.includes("artist"), "cacheSummary includes artist");
  assert(successFinalizeBlock.includes("hasLyrics"), "cacheSummary includes hasLyrics");
  assert(successFinalizeBlock.includes("hasChords"), "cacheSummary includes hasChords");

  const forbiddenKeysInCacheSummary = [
    "lyrics", "chords", "rawText", "url", "sourceUrl", "prompt", "headers", "cookies", "authorization", "token", "secret", "stack", "message"
  ];
  const cacheSummaryContent = successFinalizeBlock.substring(successFinalizeBlock.indexOf("cacheSummary"));
  for (const fk of forbiddenKeysInCacheSummary) {
    // We want to make sure it's not present as a key: e.g. lyrics: or "lyrics":
    assert(
      !cacheSummaryContent.includes(`${fk}:`) && !cacheSummaryContent.includes(`"${fk}":`),
      `cacheSummary does not leak sensitive key: '${fk}'`
    );
  }

  // Requirement I: Fallback no finally
  console.log("\nRequirement I: Fallback no finally");
  const shadowFallbackContent = serverContent.substring(idxFallbackStart, serverContent.indexOf("AI_FINOPS_SHADOW_WRITE_FINALIZE_FALLBACK_END", idxAiImportRoute));
  assert(shadowFallbackContent.includes("aiImportFinOpsWriteContext"), "Fallback contains aiImportFinOpsWriteContext check");
  assert(shadowFallbackContent.includes("!aiImportFinOpsWriteFinalized"), "Fallback contains !aiImportFinOpsWriteFinalized check");
  assert(shadowFallbackContent.includes("finalizeAiImportFinOpsShadowWriteOnce"), "Fallback contains finalizeAiImportFinOpsShadowWriteOnce call");
  assert(shadowFallbackContent.includes("AI_IMPORT_SHADOW_WRITE_UNFINALIZED_ROUTE_EXIT"), "Fallback passes AI_IMPORT_SHADOW_WRITE_UNFINALIZED_ROUTE_EXIT");
  assert(shadowFallbackContent.includes("Date.now() - startTime"), "Fallback calculates duration using Date.now() - startTime");

  const forbiddenKeywordsInFallback = ["return res.", "res.json", "res.status", "throw"];
  for (const kw of forbiddenKeywordsInFallback) {
    assert(!shadowFallbackContent.includes(kw), `Fallback block does not contain forbidden keyword: '${kw}'`);
  }

  // Requirement J: Logs seguros
  console.log("\nRequirement J: Logs seguros");
  const combinedShadowBlocks = beginBlock + "\n" + finalizeBlock + "\n" + shadowFallbackContent;
  const logRegex = /(?:logInfo|logWarn|logError)\s*\(([^)]+)\)/g;
  let match;
  let hasLeak = false;

  const forbiddenTerms = [
    "rawText", "url", "normalizedUrlStr", "sourceUrl", "prompt", "lyrics", "chords", "cleanLyrics", "cleanChords",
    "headers", "cookies", "authorization", "token", "secret", "stack", "message", "html", "extractedRawText",
    "sanitizedText", "rawContentText", "parsedAiObj", "result"
  ];

  while ((match = logRegex.exec(combinedShadowBlocks)) !== null) {
    const logArgs = match[1];
    for (const term of forbiddenTerms) {
      if (logArgs.includes(term)) {
        // If the variable is referenced in the arguments and is NOT part of a safe string literal:
        const variableReferencePattern = new RegExp(`\\b${term}\\b`);
        if (variableReferencePattern.test(logArgs) && !logArgs.includes(`"AI_FINOPS_HMAC_SECRET"`)) {
          console.error(`  [FAIL] Log statement leaks sensitive term '${term}': ${match[0]}`);
          hasLeak = true;
        }
      }
    }
  }
  assert(!hasLeak, "Logs inside shadow blocks are clean of any raw variable or PII references");

  // Requirement K: Sem persistência de conteúdo sensível
  console.log("\nRequirement K: Sem persistência de conteúdo sensível");
  assert(beginBlock.includes("rawText: typeof rawText === \"string\" ? rawText : undefined"), "beginAiImportFinOpsWritePath receives rawText for hashing");
  assert(beginBlock.includes("url: typeof url === \"string\" ? url : undefined"), "beginAiImportFinOpsWritePath receives url for hashing");
  assert(!beginBlock.includes("logSafeSummary.rawText"), "logSafeSummary does not include rawText");
  assert(!beginBlock.includes("logSafeSummary.url"), "logSafeSummary does not include url");
  assert(!beginBlock.includes("logSafeSummary.secret"), "logSafeSummary does not include secret");

  // Requirement L: Teste 0.2C.1E.8 atualizado
  console.log("\nRequirement L: Teste 0.2C.1E.8 atualizado");
  const test1E8Content = fs.readFileSync("scripts/test_phase0_2c1e8_ai_import_finops_write_path.ts", "utf8");
  assert(test1E8Content.includes('server.ts contains beginAiImportFinOpsWritePath'), "0.2C.1E.8 test validates beginAiImportFinOpsWritePath");
  assert(test1E8Content.includes('server.ts contains finalizeAiImportFinOpsWritePath'), "0.2C.1E.8 test validates finalizeAiImportFinOpsWritePath");
  assert(test1E8Content.includes('server.ts contains AI_IMPORT_FINOPS_WRITE_PATH_ENABLED'), "0.2C.1E.8 test validates AI_IMPORT_FINOPS_WRITE_PATH_ENABLED");
  assert(test1E8Content.includes('server.ts contains AI_FINOPS_SHADOW_WRITE_PATH_START'), "0.2C.1E.8 test validates AI_FINOPS_SHADOW_WRITE_PATH_START");
  assert(test1E8Content.includes('server.ts contains AI_FINOPS_SHADOW_WRITE_PATH_END'), "0.2C.1E.8 test validates AI_FINOPS_SHADOW_WRITE_PATH_END");
  assert(test1E8Content.includes('server.ts contains AI_FINOPS_SHADOW_WRITE_FINALIZE_START'), "0.2C.1E.8 test validates AI_FINOPS_SHADOW_WRITE_FINALIZE_START");
  assert(test1E8Content.includes('server.ts contains AI_FINOPS_SHADOW_WRITE_FINALIZE_END'), "0.2C.1E.8 test validates AI_FINOPS_SHADOW_WRITE_FINALIZE_END");
  assert(test1E8Content.includes('server.ts contains AI_FINOPS_SHADOW_WRITE_FINALIZE_FALLBACK_START'), "0.2C.1E.8 test validates AI_FINOPS_SHADOW_WRITE_FINALIZE_FALLBACK_START");
  assert(test1E8Content.includes('server.ts contains AI_FINOPS_SHADOW_WRITE_FINALIZE_FALLBACK_END'), "0.2C.1E.8 test validates AI_FINOPS_SHADOW_WRITE_FINALIZE_FALLBACK_END");
  assert(test1E8Content.includes('server.ts does not contain beginAiFinOpsReservation'), "0.2C.1E.8 test validates lack of beginAiFinOpsReservation");
  assert(test1E8Content.includes('server.ts does not contain finalizeAiFinOpsReservation'), "0.2C.1E.8 test validates lack of finalizeAiFinOpsReservation");

  console.log("\n=============================================");
  console.log("INTEGRATION SUITE SUMMARY:");
  console.log(`Registered Tests:  ${registeredTests}`);
  console.log(`Passed Tests:      ${passedTests}`);
  console.log(`Failed Tests:      ${failedTests}`);
  console.log("=============================================");

  if (failedTests > 0 || registeredTests !== passedTests) {
    console.error("\nINTEGRATION SUITE FAILED!");
    process.exit(1);
  } else {
    console.log("\nINTEGRATION SUITE PASSED successfully!");
  }
}

runIntegrationTests().catch(err => {
  console.error(err);
  process.exit(1);
});
