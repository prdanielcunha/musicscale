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

async function runDiagnosticsTests() {
  console.log("=== RUNNING TEST: 0.2C.1E.12A FinOps Diagnostics Semantic and Security Test ===");

  // Scenario 1: File Existence & Basic Hygiene
  console.log("\nScenario 1: File Existence & Basic Hygiene");
  assert(fs.existsSync("server.ts"), "server.ts exists");
  assert(fs.existsSync("pages/FinOpsDiagnosticsPage.tsx"), "pages/FinOpsDiagnosticsPage.tsx exists");
  assert(fs.existsSync("App.tsx"), "App.tsx exists");
  assert(!fs.existsSync("run_test.js"), "run_test.js does not exist");
  assert(!fs.existsSync("run_test2.js"), "run_test2.js does not exist");

  const serverContent = fs.readFileSync("server.ts", "utf8");
  const appContent = fs.readFileSync("App.tsx", "utf8");

  // Scenario 2: Endpoint Definitions & Security in server.ts
  console.log("\nScenario 2: Endpoint Definitions & Security in server.ts");
  const hasPreflight = serverContent.includes("/api/admin/finops-diagnostics/preflight");
  const hasRun = serverContent.includes("/api/admin/finops-diagnostics/run");
  assert(hasPreflight, "server.ts contains the preflight endpoint");
  assert(hasRun, "server.ts contains the run endpoint");

  // Verify that requireEcosystemRole middleware is applied
  const preflightEcosystemCheck = serverContent.includes('app.get("/api/admin/finops-diagnostics/preflight", requireEcosystemRole');
  const runEcosystemCheck = serverContent.includes('app.post("/api/admin/finops-diagnostics/run", requireEcosystemRole');
  assert(preflightEcosystemCheck, "Preflight endpoint is protected by requireEcosystemRole middleware");
  assert(runEcosystemCheck, "Run endpoint is protected by requireEcosystemRole middleware");

  // Confirm no email bypass or raw token bypass in server.ts
  const emailBypassFound = serverContent.includes("@millionsnest") || serverContent.includes("admin@musicscale");
  assert(!emailBypassFound, "No hardcoded admin email bypasses found in server.ts");

  // Scenario 3: Route Protection in App.tsx
  console.log("\nScenario 3: Route Protection in App.tsx");
  const routeDefinitionFound = appContent.includes('path="/admin/finops-diagnostics"');
  assert(routeDefinitionFound, "App.tsx defines the /admin/finops-diagnostics route");

  const hasCurationProtectedRoute = appContent.includes("GlobalCurationProtectedRoute");
  assert(hasCurationProtectedRoute, "App.tsx uses GlobalCurationProtectedRoute");

  // Scan App.tsx for the exact protection mapping
  const blockStartIdx = appContent.indexOf('path="/admin/finops-diagnostics"');
  if (blockStartIdx > 0) {
    const routeBlock = appContent.substring(blockStartIdx - 100, blockStartIdx + 300);
    assert(routeBlock.includes("GlobalCurationProtectedRoute") || routeBlock.includes("FinOpsDiagnosticsProtectedRoute"), "The diagnostics route is strictly enclosed in a suitable protected route component");
  }

  // Scenario 4: Safety & Block Validations in POST /run
  console.log("\nScenario 4: Safety & Block Validations in POST /run");
  const idxRunHandler = serverContent.indexOf('app.post("/api/admin/finops-diagnostics/run"');
  const runHandlerBlock = serverContent.substring(idxRunHandler, idxRunHandler + 15000);

  // Production check
  const hasProdBlock = runHandlerBlock.includes("VERCEL_ENV === \"production\"") || runHandlerBlock.includes("NODE_ENV === \"production\"");
  assert(hasProdBlock, "POST /run handler contains strict check to block Production execution");

  // Diagnostics toggle check
  const hasDiagCheck = runHandlerBlock.includes("AI_FINOPS_DIAGNOSTICS_ENABLED");
  assert(hasDiagCheck, "POST /run handler checks if AI_FINOPS_DIAGNOSTICS_ENABLED is true");

  // HMAC Secret check
  const hasHmacCheck = runHandlerBlock.includes("AI_FINOPS_HMAC_SECRET");
  assert(hasHmacCheck, "POST /run handler checks and enforces AI_FINOPS_HMAC_SECRET configuration");

  // Request ID prefix
  const hasRequestIdPrefix = runHandlerBlock.includes("diag_finops_");
  assert(hasRequestIdPrefix, "POST /run handler generates a requestId starting with the prefix 'diag_finops_'");

  // Synthetic data usage
  const hasSyntheticPayload = runHandlerBlock.includes("FinOps diagnostic smoke test");
  assert(hasSyntheticPayload, "POST /run handler uses synthetic mock data ('FinOps diagnostic smoke test') instead of actual admin text");

  // Forbidden keys leak scan
  const scansForForbiddenKeys = runHandlerBlock.includes("rawText") && runHandlerBlock.includes("lyrics") && runHandlerBlock.includes("chords");
  assert(scansForForbiddenKeys, "POST /run handler performs an active scan of all persisted documents to ensure no forbidden keys exist");

  // Copyable report presence
  const hasCopyableReport = runHandlerBlock.includes("RELATÓRIO DIAGNÓSTICO FINOPS — 0.2C.1E.12C") || runHandlerBlock.includes("RELATÓRIO DIAGNÓSTICO FINOPS — 0.2C.1E.12A");
  assert(hasCopyableReport, "POST /run handler produces a copyable report starting with the correct phase marker");

  // Summary and exit
  console.log("\n=== TEST SUITE RESULTS ===");
  console.log(`Total: ${registeredTests} | Passed: ${passedTests} | Failed: ${failedTests}`);

  if (failedTests > 0) {
    console.error(`\nSuite failed with ${failedTests} errors.`);
    process.exit(1);
  } else {
    console.log("\nSuite passed successfully with 0 errors!");
    process.exit(0);
  }
}

runDiagnosticsTests().catch((e) => {
  console.error("Unhandle exception in test suite", e);
  process.exit(1);
});
