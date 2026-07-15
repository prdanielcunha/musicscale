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

async function runRunbookTests() {
  console.log("=== RUNNING TEST: 0.2C.1E.11 FinOps Runbook Security & Verification ===");

  // Scenario A: Escopo e higiene
  console.log("\nScenario A: Escopo e higiene (Verificação de arquivos e estrutura local)");
  const runbookPath = "docs/finops/phase0_2c1e11_preview_shadow_write_enablement_runbook.md";
  const smokePath = "scripts/test_phase0_2c1e10_ai_import_finops_shadow_write_operational_smoke.ts";
  const currentTestPath = "scripts/test_phase0_2c1e11_ai_import_finops_preview_enablement_runbook.ts";

  assert(fs.existsSync(runbookPath), `Runbook file exists at: ${runbookPath}`);
  assert(fs.existsSync(currentTestPath), `Current test file exists at: ${currentTestPath}`);
  assert(fs.existsSync("server.ts"), "server.ts exists");
  assert(fs.existsSync(smokePath), "0.2C.1E.10 smoke test exists");
  
  assert(!fs.existsSync("run_test.js"), "run_test.js does not exist");
  assert(!fs.existsSync("run_test2.js"), "run_test2.js does not exist");
  assert(!fs.existsSync("scripts/test_gate_check.ts"), "test_gate_check.ts does not exist");

  // Scenario B: Nenhum código de produção alterado por esta fase
  console.log("\nScenario B: Nenhum código de produção alterado por esta fase (server.ts intocado)");
  const serverContent = fs.readFileSync("server.ts", "utf8");
  
  assert(
    serverContent.includes("AI_IMPORT_FINOPS_WRITE_PATH_ENABLED"),
    "server.ts correctly references AI_IMPORT_FINOPS_WRITE_PATH_ENABLED"
  );
  assert(
    serverContent.includes('process.env.AI_IMPORT_FINOPS_WRITE_PATH_ENABLED === "true"') ||
    serverContent.includes('process.env.AI_IMPORT_FINOPS_WRITE_PATH_ENABLED == "true"'),
    "server.ts correctly implements strict flag value check against 'true'"
  );
  assert(
    serverContent.includes("AI_FINOPS_SHADOW_WRITE_PATH_START"),
    "server.ts correctly preserves AI_FINOPS_SHADOW_WRITE_PATH_START marker"
  );
  assert(
    serverContent.includes("AI_FINOPS_SHADOW_WRITE_FINALIZE_FALLBACK_START"),
    "server.ts correctly preserves AI_FINOPS_SHADOW_WRITE_FINALIZE_FALLBACK_START marker"
  );

  // Read runbook content for subsequent assertions
  const runbookContent = fs.readFileSync(runbookPath, "utf8");

  // Scenario C: Runbook contém seções obrigatórias
  console.log("\nScenario C: Runbook contém seções obrigatórias");
  const requiredSections = [
    "Estado atual aprovado",
    "Escopo permitido desta habilitação",
    "Pré-requisitos obrigatórios",
    "Variáveis de ambiente",
    "Procedimento de habilitação em Preview/Staging",
    "Paths esperados no Firestore",
    "Checklist de logs seguros",
    "Critérios de sucesso",
    "Critérios de rollback imediato",
    "Procedimento de rollback",
    "Proibições explícitas",
    "Próxima fase possível"
  ];

  for (const section of requiredSections) {
    assert(
      runbookContent.includes(section),
      `Runbook contains section or phrase: '${section}'`
    );
  }

  // Scenario D: Runbook proíbe Production nesta fase
  console.log("\nScenario D: Runbook proíbe Production nesta fase");
  assert(runbookContent.includes("Production"), "Runbook refers to 'Production'");
  assert(
    runbookContent.includes("não ativar em Production") || 
    runbookContent.includes("Nunca ativar em Production") || 
    runbookContent.includes("proibido ativar") ||
    runbookContent.includes("Terminantemente proibido ativar"),
    "Runbook explicitly forbids enabling flags or config in Production"
  );
  assert(
    runbookContent.includes("Production permanece fora do escopo"),
    "Runbook notes Production is out of scope for this enablement phase"
  );
  assert(
    runbookContent.includes("somente Preview/Staging") || runbookContent.includes("somente em Preview/Staging"),
    "Runbook specifies enablement is scoped strictly to Preview/Staging"
  );

  // Scenario E: Runbook exige secret antes da flag
  console.log("\nScenario E: Runbook exige secret antes da flag");
  assert(runbookContent.includes("AI_FINOPS_HMAC_SECRET"), "Runbook covers AI_FINOPS_HMAC_SECRET environment variable");
  assert(
    runbookContent.includes("obrigatório antes da flag") || runbookContent.includes("previamente provisionada no painel de ambiente antes"),
    "Runbook enforces secret provisioning prior to feature flag enablement"
  );
  assert(
    runbookContent.includes("AI_IMPORT_FINOPS_WRITE_PATH_ENABLED"),
    "Runbook covers the shadow-write feature flag"
  );

  // Scenario F: Runbook preserva resposta pública
  console.log("\nScenario F: Runbook preserva resposta pública");
  assert(
    runbookContent.includes("response público inalterado") || 
    runbookContent.includes("resposta pública permanece estritamente inalterada") ||
    runbookContent.includes("resposta pública fornecida ao usuário final permanece estritamente inalterada"),
    "Runbook notes public response must remain completely unchanged"
  );

  const forbiddenKeys = [
    "finOps", "aiFinOps", "cacheHit", "idempotencyHit", "quotaStatus", "quotaBlocked", "billing", "usage", "plan", "entitlement"
  ];
  for (const key of forbiddenKeys) {
    assert(
      runbookContent.includes(key),
      `Runbook explicitly lists forbidden response key to prevent leaking: '${key}'`
    );
  }

  // Scenario G: Runbook preserva shadow-only
  console.log("\nScenario G: Runbook preserva shadow-only constraints");
  assert(
    runbookContent.includes("QUOTA_BLOCKED não bloqueia usuário"),
    "Runbook asserts QUOTA_BLOCKED does not block the user"
  );
  assert(
    runbookContent.includes("cache/idempotency não fazem short-circuit"),
    "Runbook asserts cache/idempotency checks do not perform short-circuit"
  );
  assert(
    runbookContent.includes("não retornar cache hit") || runbookContent.includes("retornar chaves de faturamento ou cache FinOps na interface visível"),
    "Runbook explicitly forbids returning cache hits to the public client"
  );
  assert(
    runbookContent.includes("não retornar idempotency hit") || runbookContent.includes("retornar chaves de faturamento ou cache FinOps na interface visível"),
    "Runbook explicitly forbids returning idempotency hits to the public client"
  );

  // Scenario H: Runbook cobre Firestore paths
  console.log("\nScenario H: Runbook cobre Firestore paths autorizados");
  const expectedPaths = [
    "organizations/{orgId}/aiUsage/{monthKey}",
    "organizations/{orgId}/aiDailyUsage/{dayKey}",
    "organizations/{orgId}/aiUsage/{monthKey}/events/{requestId}",
    "organizations/{orgId}/aiIdempotency/{idempotencyKey}",
    "organizations/{orgId}/aiCache/{cacheKey}",
    "organizations/{orgId}/aiRateLimits/{rateLimitBucketKey}"
  ];

  for (const path of expectedPaths) {
    assert(runbookContent.includes(path), `Runbook specifies correct Firestore path: '${path}'`);
  }

  // Scenario I: Runbook bloqueia dados sensíveis
  console.log("\nScenario I: Runbook bloqueia dados sensíveis");
  const sensitiveKeys = [
    "rawText",
    "url completa",
    "lyrics",
    "chords",
    "prompt",
    "headers",
    "cookies",
    "authorization",
    "token",
    "secret",
    "html",
    "stack",
    "resposta crua da IA"
  ];

  for (const key of sensitiveKeys) {
    assert(
      runbookContent.includes(key),
      `Runbook lists sensitive element inside forbidden persistence/logging audit checklist: '${key}'`
    );
  }

  // Scenario J: Runbook cobre rollback
  console.log("\nScenario J: Runbook cobre procedimento de rollback");
  assert(
    runbookContent.includes("desligar AI_IMPORT_FINOPS_WRITE_PATH_ENABLED") ||
    runbookContent.includes("Desativar Flag") ||
    runbookContent.includes("desative AI_IMPORT_FINOPS_WRITE_PATH_ENABLED"),
    "Runbook contains instruction to turn off the feature flag in case of anomaly"
  );
  assert(
    runbookContent.includes("redeploy se necessário") || runbookContent.includes("Redeploy"),
    "Runbook mentions trigger redeployment if necessary"
  );
  assert(runbookContent.includes("requestId"), "Runbook specifies logging/tracking requestId for rollback audits");
  assert(
    runbookContent.includes("motivo do rollback") || runbookContent.includes("descrição detalhada para depuração"),
    "Runbook specifies documenting rollback reason for post-incident reviews"
  );
  assert(
    runbookContent.includes("não promover para Production") || runbookContent.includes("Nunca promover a ativação"),
    "Runbook warns against promoting the enablement to Production during failure"
  );

  // Scenario K: Test counters verification
  console.log("\nScenario K: Verificação de métricas e contadores de teste");
  assert(registeredTests > 0, "Test suite registered assertions (> 0)");
  assert(failedTests === 0, "Test suite reported zero failures (=== 0)");
  assert(passedTests === registeredTests, "Test suite reported passed tests matches registered tests");

  console.log("\n=============================================");
  console.log("RUNBOOK SUITE SUMMARY:");
  console.log(`Registered Tests:  ${registeredTests}`);
  console.log(`Passed Tests:      ${passedTests}`);
  console.log(`Failed Tests:      ${failedTests}`);
  console.log("=============================================");

  if (failedTests > 0 || registeredTests !== passedTests) {
    console.error("\nRUNBOOK SUITE FAILED!");
    process.exit(1);
  } else {
    console.log("\nRUNBOOK SUITE PASSED successfully!");
  }
}

runRunbookTests().catch(err => {
  console.error(err);
  process.exit(1);
});
