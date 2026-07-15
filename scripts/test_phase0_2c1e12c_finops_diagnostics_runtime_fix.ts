import fs from "fs";
import path from "path";

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

async function runTests() {
  console.log("=== RUNNING TEST: 0.2C.1E.12C FinOps Diagnostics Final Hardening and Verification ===");

  // A & B: File Checks
  console.log("\n--- Checking File Presence & Absence ---");
  assert(fs.existsSync("server.ts"), "server.ts exists");
  assert(fs.existsSync("pages/FinOpsDiagnosticsPage.tsx"), "pages/FinOpsDiagnosticsPage.tsx exists");
  assert(fs.existsSync("components/layout/Sidebar.tsx"), "components/layout/Sidebar.tsx exists");

  const forbiddenFiles = [
    "run_test.js",
    "run_test2.js",
    "scripts/test_gate_check.ts",
    ".env.local",
    ".env.production",
    ".env.preview"
  ];
  forbiddenFiles.forEach(file => {
    assert(!fs.existsSync(file), `Forbidden file ${file} does not exist`);
  });

  const serverContent = fs.readFileSync("server.ts", "utf8");
  const sidebarContent = fs.readFileSync("components/layout/Sidebar.tsx", "utf8");

  // C: Environment hardening
  console.log("\n--- Checking Environment Hardening in server.ts ---");
  assert(serverContent.includes("AI_FINOPS_DIAGNOSTICS_ENV"), "server.ts contains AI_FINOPS_DIAGNOSTICS_ENV references");
  assert(serverContent.includes("environmentSource"), "server.ts resolves and returns environmentSource");
  assert(
    serverContent.includes('environment: "unknown"') || serverContent.includes("environment === \"unknown\""),
    "server.ts properly handles the unknown environment case"
  );
  assert(
    serverContent.includes("isProduction || !isSafeNonProduction || environment === \"unknown\""),
    "server.ts prevents execution when environment is production or not safe or unknown"
  );

  // D: Payload único
  console.log("\n--- Checking Payload Uniqueness in server.ts ---");
  assert(serverContent.includes("requestId = \"diag_finops_\" + crypto.randomUUID()"), "server.ts dynamically generates unique requestId");
  assert(serverContent.includes("rawText = `FinOps diagnostic smoke test ${requestId}`"), "server.ts dynamic payload incorporates requestId");
  assert(!serverContent.includes('rawText: "FinOps diagnostic smoke test",'), "server.ts does not use hardcoded rawText payload without requestId");
  assert(!serverContent.includes("req.body.rawText"), "server.ts does not accept arbitrary body rawText payload in diagnostics endpoint");

  // E & F: Finalize seguro & Relatório copiável
  console.log("\n--- Checking Finalize Security & Safe Error Reporting ---");
  assert(serverContent.includes("finalizeResult = await finalizeAiImportFinOpsWritePath"), "server.ts executes finalizeAiImportFinOpsWritePath");
  assert(serverContent.includes("safeErrorCode: \"FINALIZE_EXCEPTION\""), "server.ts uses static/safe error code and hides raw exception details");
  assert(!serverContent.includes("finalizeErr.message"), "server.ts hides finalize exception message from response checks");
  
  // Extract diagnostics sub-content to check for leaks locally
  const preflightIdx = serverContent.indexOf('app.get("/api/admin/finops-diagnostics/preflight"');
  const runEndIdx = serverContent.indexOf('message: "O diagnóstico falhou sem expor detalhes internos."');
  let diagnosticsSub = "";
  if (preflightIdx > 0 && runEndIdx > preflightIdx) {
    diagnosticsSub = serverContent.substring(preflightIdx, runEndIdx + 300);
  }
  
  assert(preflightIdx > 0, "Found start of diagnostics endpoints");
  assert(runEndIdx > preflightIdx, "Found end of diagnostics endpoints");
  assert(diagnosticsSub.length > 0, "Extracted diagnostics sub-content block");
  assert(!diagnosticsSub.includes("e.message") && !diagnosticsSub.includes("err.message") && !diagnosticsSub.includes("finalizeErr.message"), "No raw exception messages (e.message, err.message, finalizeErr.message) leaked in diagnostics endpoints sub-content");
  assert(!diagnosticsSub.includes(".stack"), "No exception stacks leaked in diagnostics endpoints sub-content");
  
  assert(serverContent.includes("isFinalizeOk = !!(finalizeResult && finalizeResult.ok === true && finalizeResult.safeSummary?.finalized === true && finalizeResult.skipped !== true)"), "server.ts strictly validates finalize status");

  console.log("\n--- Checking Report Versioning and Conditional Observations ---");
  assert(serverContent.includes("RELATÓRIO DIAGNÓSTICO FINOPS — 0.2C.1E.12C"), "server.ts copyable report has version header updated to 0.2C.1E.12C");
  assert(!serverContent.includes("RELATÓRIO DIAGNÓSTICO FINOPS — 0.2C.1E.12A"), "server.ts does not contain old version 12A");
  assert(!serverContent.includes("RELATÓRIO DIAGNÓSTICO FINOPS — 0.2C.1E.12B"), "server.ts does not contain old version 12B");
  assert(!serverContent.includes("Backward compatibility comment"), "server.ts does not contain Backward compatibility comments");
  
  assert(serverContent.includes("observationsText = \"Diagnóstico aprovado em ambiente seguro de Preview/Staging.\""), "server.ts contains observation text for overall status APROVADO");
  assert(serverContent.includes("observationsText = \"Diagnóstico com atenção. Revise as pendências antes de avançar.\""), "server.ts contains observation text for overall status ATENÇÃO");
  assert(serverContent.includes("observationsText = \"Diagnóstico reprovado. Não avance para Production. Envie este relatório ao ChatGPT para auditoria.\""), "server.ts contains observation text for overall status REPROVADO");
  assert(!serverContent.includes("Observações: Diagnóstico executado em conformidade"), "server.ts no longer uses unconditional positive observations for failed diagnostics");

  // G: Menu checks in Sidebar.tsx
  console.log("\n--- Checking Sidebar Menu Integration ---");
  assert(sidebarContent.includes("Diagnóstico FinOps"), "Sidebar contains the text 'Diagnóstico FinOps'");
  assert(sidebarContent.includes("/admin/finops-diagnostics"), "Sidebar points to /admin/finops-diagnostics");
  assert(sidebarContent.includes("userProfile?.systemRole"), "Sidebar menu uses userProfile.systemRole canonical field");
  assert(!sidebarContent.includes("userProfile?.role || \"unknown\"") && !sidebarContent.includes("userProfile?.role || 'unknown'"), "Sidebar does not use loose fallback role check for diagnostics menu item");
  assert(!sidebarContent.includes('email === "pastordanielpcunha@gmail.com"') && !sidebarContent.includes('email === "danielcunhapastor@gmail.com"'), "Sidebar does not have hardcoded email bypass rules");

  // H: Proteção backend
  console.log("\n--- Checking Backend Role Protections ---");
  assert(serverContent.includes('app.get("/api/admin/finops-diagnostics/preflight", requireEcosystemRole'), "Preflight route is protected with requireEcosystemRole");
  assert(serverContent.includes('app.post("/api/admin/finops-diagnostics/run", requireEcosystemRole'), "Run route is protected with requireEcosystemRole");
  
  const allowedRolesLines = serverContent.match(/allowedRoles\s*=\s*\[\s*[^\]]+\]/g);
  assert(
    !!allowedRolesLines && allowedRolesLines.some(line => line.includes("ceo") && line.includes("global_admin") && line.includes("ecosystem_owner") && line.includes("founder")),
    "server.ts ensures that only canonical global roles (ceo, global_admin, ecosystem_owner, founder) are allowed in the backend check"
  );

  // Print results
  console.log("\n=== TEST RESULTS SUMMARY ===");
  console.log(`Registered Tests: ${registeredTests}`);
  console.log(`Passed Tests: ${passedTests}`);
  console.log(`Failed Tests: ${failedTests}`);

  if (failedTests > 0) {
    console.error("\n[STATUS] Some tests FAILED.");
    process.exit(1);
  } else {
    console.log("\n[STATUS] All tests PASSED successfully!");
    process.exit(0);
  }
}

runTests().catch(err => {
  console.error("Test suite crashed:", err);
  process.exit(1);
});
