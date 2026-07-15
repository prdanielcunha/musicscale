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

// Requirement K: Embedded Operational Enablement Checklist
export const CONTROLLED_ENABLEMENT_CHECKLIST = [
  "1. Verificar se a flag server-side AI_IMPORT_FINOPS_WRITE_PATH_ENABLED está configurada como default-off (desligada) em todos os ambientes.",
  "2. Garantir que a flag de leitura AI_IMPORT_FINOPS_READ_PATH_ENABLED possa ser ativada de forma independente para shadow-read.",
  "3. Configurar de forma segura a variável confidencial AI_FINOPS_HMAC_SECRET no painel de segredos de Production (Google Secret Manager / Cloud Run).",
  "4. Monitorar ativamente os logs do Cloud Run utilizando filtros estruturados para identificar ocorrências de falhas no Shadow-Write.",
  "5. Auditar as coleções correspondentes no Firestore para checar se as transações de FinOps iniciam e finalizam corretamente.",
  "6. Assegurar que a resposta pública do endpoint de importação permanece intocada, não revelando detalhes de faturamento ao client.",
  "7. Validar que uma eventual negação por cota (QUOTA_BLOCKED) seja registrada de forma invisível nos logs, sem rejeitar o usuário de Preview.",
  "8. Testar resiliência offline do Firestore no ambiente de Preview antes de promover a alteração de escrita para Production.",
  "9. Acompanhar as métricas de latência operacional (processingTimeMs) no endpoint de importação durante o rollout controlado.",
  "10. Verificar a ausência de vazamento de credenciais ou variáveis de ambiente confidenciais em logs informativos.",
  "11. Executar a suíte de testes de regressão (fases 0.2C.1E.1 a 0.2C.1E.10) localmente e na esteira de CI/CD para evitar quebras.",
  "12. Estabelecer um plano de rollback imediato que desative AI_IMPORT_FINOPS_WRITE_PATH_ENABLED em segundos em caso de anomalia.",
  "13. Confirmar que nenhuma requisição legítima do usuário é bloqueada ou sofre lentidão por lentidão na rota secundária de FinOps."
];

async function runOperationalSmokeTests() {
  console.log("=== RUNNING TEST: 0.2C.1E.10 FinOps Shadow-Write Operational Smoke Test ===");

  // Scenario 1: Escopo e higiene
  console.log("\nScenario 1: Escopo e higiene (Verificação de arquivos autorizados e proibidos)");
  assert(fs.existsSync("server.ts"), "server.ts exists");
  assert(fs.existsSync("services/server/aiImportFinOpsWritePath.ts"), "aiImportFinOpsWritePath.ts exists");
  assert(fs.existsSync("scripts/test_phase0_2c1e9_ai_import_finops_shadow_write_integration.ts"), "0.2C.1E.9 integration test exists");
  assert(fs.existsSync("scripts/test_phase0_2c1e10_ai_import_finops_shadow_write_operational_smoke.ts"), "0.2C.1E.10 smoke test exists");
  assert(!fs.existsSync("run_test.js"), "run_test.js does not exist");
  assert(!fs.existsSync("run_test2.js"), "run_test2.js does not exist");
  assert(!fs.existsSync("scripts/test_gate_check.ts"), "test_gate_check.ts does not exist");

  const serverContent = fs.readFileSync("server.ts", "utf8");
  const idxAiImportRoute = serverContent.indexOf('app.post("/api/ai-import"');
  assert(idxAiImportRoute > 0, "Found /api/ai-import POST route in server.ts");

  // Scenario 2: Flag default-off
  console.log("\nScenario 2: Flag default-off (Garantir que a flag é comparada estritamente com \"true\")");
  const writeFlagOccurrences = [...serverContent.matchAll(/AI_IMPORT_FINOPS_WRITE_PATH_ENABLED/g)];
  assert(writeFlagOccurrences.length > 0, "AI_IMPORT_FINOPS_WRITE_PATH_ENABLED is referenced in server.ts");

  // Find where process.env.AI_IMPORT_FINOPS_WRITE_PATH_ENABLED is checked
  const idxFlagCheck = serverContent.indexOf("process.env.AI_IMPORT_FINOPS_WRITE_PATH_ENABLED", idxAiImportRoute);
  assert(idxFlagCheck > 0, "Found active check for AI_IMPORT_FINOPS_WRITE_PATH_ENABLED inside the route");
  
  const flagLine = serverContent.substring(idxFlagCheck - 50, idxFlagCheck + 100);
  assert(
    flagLine.includes('=== "true"') || flagLine.includes('== "true"'),
    "Feature flag check is strictly compared to 'true' string literal with no permissive fallbacks"
  );
  assert(
    !flagLine.includes("|| true") && !flagLine.includes("|| 'true'") && !flagLine.includes("|| \"true\""),
    "Feature flag has NO permissive fallback bypasses"
  );

  // Scenario 3: Separação read-path/write-path
  console.log("\nScenario 3: Separação read-path/write-path");
  assert(serverContent.includes("AI_IMPORT_FINOPS_READ_PATH_ENABLED"), "server.ts references AI_IMPORT_FINOPS_READ_PATH_ENABLED");
  assert(serverContent.includes("AI_IMPORT_FINOPS_WRITE_PATH_ENABLED"), "server.ts references AI_IMPORT_FINOPS_WRITE_PATH_ENABLED");

  // Read block content
  const idxReadStart = serverContent.indexOf("AI_FINOPS_SHADOW_READ_PATH_START", idxAiImportRoute);
  const idxReadEnd = serverContent.indexOf("AI_FINOPS_SHADOW_READ_PATH_END", idxAiImportRoute);
  assert(idxReadStart > 0 && idxReadEnd > idxReadStart, "Found shadow read path markers");
  const readBlock = serverContent.substring(idxReadStart, idxReadEnd);
  assert(readBlock.includes("AI_IMPORT_FINOPS_READ_PATH_ENABLED"), "Shadow read block references read path flag");
  assert(!readBlock.includes("AI_IMPORT_FINOPS_WRITE_PATH_ENABLED"), "Shadow read block DOES NOT reference write path flag");

  // Write block content
  const idxWriteStart = serverContent.indexOf("AI_FINOPS_SHADOW_WRITE_PATH_START", idxAiImportRoute);
  const idxWriteEnd = serverContent.indexOf("AI_FINOPS_SHADOW_WRITE_PATH_END", idxAiImportRoute);
  assert(idxWriteStart > 0 && idxWriteEnd > idxWriteStart, "Found shadow write path markers");
  const writeBlock = serverContent.substring(idxWriteStart, idxWriteEnd);
  assert(writeBlock.includes("AI_IMPORT_FINOPS_WRITE_PATH_ENABLED"), "Shadow write block references write path flag");
  assert(!writeBlock.includes("AI_IMPORT_FINOPS_READ_PATH_ENABLED"), "Shadow write block DOES NOT reference read path flag");

  // Scenario 4: Secret obrigatório sem quebra
  console.log("\nScenario 4: Secret obrigatório sem quebra (Tratamento de ausência de segredo)");
  assert(writeBlock.includes("process.env.AI_FINOPS_HMAC_SECRET"), "Shadow write block references AI_FINOPS_HMAC_SECRET");
  assert(writeBlock.includes("!secret"), "Shadow write block checks secret existence (e.g., !secret)");
  
  // Find secret missing block
  const idxSecretCheck = writeBlock.indexOf("!secret");
  const secretCheckSubBlock = writeBlock.substring(idxSecretCheck, idxSecretCheck + 250);
  assert(secretCheckSubBlock.includes("logWarn"), "Warns missing secret via safe logging");
  
  const forbiddenKeywordsInSecretCheck = ["return res.", "res.status", "res.json", "throw", "makeErrorResponse"];
  for (const kw of forbiddenKeywordsInSecretCheck) {
    assert(!secretCheckSubBlock.includes(kw), `Secret validation check does NOT contain user-blocking keyword: '${kw}'`);
  }

  // Scenario 5: Shadow-write não bloqueia usuário
  console.log("\nScenario 5: Shadow-write não bloqueia usuário (Sem vazamento de fluxos de erro ou retorno)");
  const forbiddenKeywordsInWriteBegin = ["return res.", "res.status", "res.json", "throw", "makeErrorResponse"];
  for (const kw of forbiddenKeywordsInWriteBegin) {
    assert(
      !writeBlock.includes(kw),
      `Shadow write begin block does NOT contain user-facing blocking keyword: '${kw}'`
    );
  }

  // Scenario 6: Nenhum short-circuit por cache/idempotência
  console.log("\nScenario 6: Nenhum short-circuit por cache/idempotência");
  // Check that the shadow-write path has no returns that short-circuit the outer route
  const writeLines = writeBlock.split("\n");
  let hasReturnKeyword = false;
  for (const line of writeLines) {
    // Only match standalone return statement, not part of callbacks or variable definitions (like returning something from an inner closure, which is okay)
    const trimmed = line.trim();
    if (trimmed === "return;" || trimmed === "return" || trimmed.startsWith("return ")) {
      // Is it inside an inner function?
      // beginAiImportFinOpsWritePath uses await, so returns would be top level if present
      // Let's verify if any return exists in this block
      if (!trimmed.includes("beginAiImportFinOpsWritePath") && !trimmed.includes("typeof") && !trimmed.includes("res")) {
        hasReturnKeyword = true;
      }
    }
  }
  assert(!hasReturnKeyword, "Shadow-write block does NOT contain outer short-circuit returns");

  // Scenario 7: Resposta pública inalterada
  console.log("\nScenario 7: Resposta pública inalterada (Sem vazamento de metadados FinOps)");
  const idxResJson = serverContent.indexOf("return res.json({", idxAiImportRoute);
  assert(idxResJson > 0, "Found the final public return res.json block");
  
  const resBlockEnd = serverContent.indexOf("});", idxResJson);
  const resBlock = serverContent.substring(idxResJson, resBlockEnd + 3);

  const forbiddenKeysInResponse = [
    "finOps", "aiFinOps", "cacheHit", "idempotencyHit", "quotaStatus", "quotaBlocked",
    "billing", "usage", "plan", "entitlement", "quotaDecision", "safeSummary"
  ];
  for (const key of forbiddenKeysInResponse) {
    assert(
      !resBlock.includes(`"${key}":`) && !resBlock.includes(`${key}:`),
      `Public response doesn't leak FinOps key: '${key}'`
    );
  }

  const expectedResponseKeys = [
    "ok", "song", "result", "processingTimeMs", "usedAi", "requestId", "metrics"
  ];
  for (const key of expectedResponseKeys) {
    assert(resBlock.includes(key), `Public response correctly preserves original key: '${key}'`);
  }

  // Scenario 8: Finalize success antes do response
  console.log("\nScenario 8: Finalize success antes do response (Segurança e escopo de cacheSummary)");
  const idxOutcomeSuccess = serverContent.indexOf('outcome: "SUCCESS"', idxAiImportRoute);
  assert(idxOutcomeSuccess > 0, "Outcome SUCCESS finalization exists");
  assert(idxOutcomeSuccess < idxResJson, "Outcome SUCCESS finalization occurs BEFORE the final public response is returned");

  // Check cacheSummary structure
  const idxCacheSummary = serverContent.indexOf("cacheSummary:", idxOutcomeSuccess - 200);
  assert(idxCacheSummary > 0, "cacheSummary is present in SUCCESS finalization");
  
  const cacheSummaryBlock = serverContent.substring(idxCacheSummary, idxCacheSummary + 300);
  assert(cacheSummaryBlock.includes("title"), "cacheSummary preserves title");
  assert(cacheSummaryBlock.includes("artist"), "cacheSummary preserves artist");
  assert(cacheSummaryBlock.includes("hasLyrics"), "cacheSummary preserves hasLyrics");
  assert(cacheSummaryBlock.includes("hasChords"), "cacheSummary preserves hasChords");

  const forbiddenCacheKeys = [
    "lyrics", "chords", "rawText", "url", "sourceUrl", "prompt", "headers", "cookies",
    "authorization", "token", "secret", "stack", "message", "result"
  ];
  for (const fk of forbiddenCacheKeys) {
    assert(
      !cacheSummaryBlock.includes(`"${fk}":`) && !cacheSummaryBlock.includes(`${fk}:`),
      `cacheSummary does NOT leak sensitive content: '${fk}'`
    );
  }

  // Scenario 9: Fallback contra PROCESSING preso
  console.log("\nScenario 9: Fallback contra PROCESSING preso");
  const idxFallbackStart = serverContent.indexOf("AI_FINOPS_SHADOW_WRITE_FINALIZE_FALLBACK_START", idxAiImportRoute);
  const idxFallbackEnd = serverContent.indexOf("AI_FINOPS_SHADOW_WRITE_FINALIZE_FALLBACK_END", idxAiImportRoute);
  assert(idxFallbackStart > 0 && idxFallbackEnd > idxFallbackStart, "Fallback markers exist in server.ts");

  const fallbackBlock = serverContent.substring(idxFallbackStart, idxFallbackEnd);
  assert(fallbackBlock.includes("aiImportFinOpsWriteContext"), "Fallback verifies context existence");
  assert(fallbackBlock.includes("!aiImportFinOpsWriteFinalized"), "Fallback checks if transaction has not yet been finalized");
  assert(fallbackBlock.includes("finalizeAiImportFinOpsShadowWriteOnce"), "Fallback invokes finalizeAiImportFinOpsShadowWriteOnce");
  assert(fallbackBlock.includes("AI_IMPORT_SHADOW_WRITE_UNFINALIZED_ROUTE_EXIT"), "Fallback specifies exit code");
  assert(fallbackBlock.includes("Date.now() - startTime"), "Fallback tracks elapsed time");

  const idxLimitRelease = serverContent.indexOf("aiImportRateLimitSlot.release()", idxAiImportRoute);
  assert(idxFallbackStart < idxLimitRelease, "Fallback occurs before rate limit release");

  const forbiddenKeywordsInFallback = ["return res.", "res.status", "res.json", "throw"];
  for (const kw of forbiddenKeywordsInFallback) {
    assert(!fallbackBlock.includes(kw), `Fallback block does NOT contain user-blocking keyword: '${kw}'`);
  }

  // Scenario 10: Logs seguros
  console.log("\nScenario 10: Logs seguros (Sem vazamento de PII ou dados brutos)");
  const finalizeDefStart = serverContent.indexOf("AI_FINOPS_SHADOW_WRITE_FINALIZE_START");
  const finalizeDefEnd = serverContent.indexOf("AI_FINOPS_SHADOW_WRITE_FINALIZE_END");
  assert(finalizeDefStart > 0 && finalizeDefEnd > finalizeDefStart, "Finalize helper markers exist");
  
  const finalizeDefBlock = serverContent.substring(finalizeDefStart, finalizeDefEnd);

  const combinedShadowSections = writeBlock + "\n" + finalizeDefBlock + "\n" + fallbackBlock;
  const logRegex = /(?:logInfo|logWarn|logError)\s*\(([^)]+)\)/g;
  let match;
  let leakDetected = false;

  const forbiddenTerms = [
    "rawText", "url", "normalizedUrlStr", "sourceUrl", "prompt", "lyrics", "chords", "cleanLyrics", "cleanChords",
    "headers", "cookies", "authorization", "token", "secret", "stack", "message", "html", "extractedRawText",
    "sanitizedText", "rawContentText", "parsedAiObj", "result"
  ];

  while ((match = logRegex.exec(combinedShadowSections)) !== null) {
    const logArgs = match[1];
    for (const term of forbiddenTerms) {
      if (logArgs.includes(term)) {
        // Confirm it's not a harmless string literal check or environment key string
        const isVariableWord = new RegExp(`\\b${term}\\b`).test(logArgs);
        if (isVariableWord && !logArgs.includes(`"AI_FINOPS_HMAC_SECRET"`)) {
          console.error(`  [FAIL] Leak detected in log statement: ${match[0]} (leaks '${term}')`);
          leakDetected = true;
        }
      }
    }
  }
  assert(!leakDetected, "No PII or raw variables leaked in shadow log arguments");

  // Scenario 11: Checklist operacional presente e completo no teste
  console.log("\nScenario 11: Checklist operacional embutido no teste");
  assert(
    Array.isArray(CONTROLLED_ENABLEMENT_CHECKLIST) && CONTROLLED_ENABLEMENT_CHECKLIST.length >= 12,
    "Embedded CONTROLLED_ENABLEMENT_CHECKLIST contains at least 12 items"
  );
  
  const requiredKeywords = [
    "Preview",
    "AI_FINOPS_HMAC_SECRET",
    "AI_IMPORT_FINOPS_WRITE_PATH_ENABLED",
    "AI_IMPORT_FINOPS_READ_PATH_ENABLED",
    "logs",
    "Firestore",
    "resposta pública",
    "QUOTA_BLOCKED",
    "Production"
  ];

  const checklistStr = JSON.stringify(CONTROLLED_ENABLEMENT_CHECKLIST);
  for (const kw of requiredKeywords) {
    assert(checklistStr.includes(kw), `Checklist references mandatory operational keyword: '${kw}'`);
  }

  // SUMMARY & FINAL COUNTERS
  console.log("\n=============================================");
  console.log("SMOKE SUITE SUMMARY:");
  console.log(`Registered Tests:  ${registeredTests}`);
  console.log(`Passed Tests:      ${passedTests}`);
  console.log(`Failed Tests:      ${failedTests}`);
  console.log("=============================================");

  if (failedTests > 0 || registeredTests !== passedTests) {
    console.error("\nSMOKE SUITE FAILED!");
    process.exit(1);
  } else {
    console.log("\nSMOKE SUITE PASSED successfully!");
  }
}

runOperationalSmokeTests().catch(err => {
  console.error(err);
  process.exit(1);
});
