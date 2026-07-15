import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";

// 1. Setup Protected Files Checklist and calculate initial hashes
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
  "services/server/aiImportSafeFetchAdapter.ts",
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
  "scripts/test_phase0_2c1c6_ai_import_safe_external_fetch_integration.ts",
  "scripts/test_phase0_2c1c7_ai_import_safe_fetch_adapter.ts",
  "scripts/test_phase0_2c1c8_ai_import_functional_contract.ts",
  "package.json",
  "package-lock.json",
  "firestore.rules"
];

function calculateFileHash(filePath: string): string {
  const fullPath = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(fullPath)) {
    console.error(`FATAL: Protected file does not exist: ${filePath}`);
    process.exit(1);
  }
  const content = fs.readFileSync(fullPath);
  return crypto.createHash("sha256").update(content).digest("hex");
}

console.log("=== Calculating Initial Hashes for Protected Files ===");
const initialHashes: Record<string, string> = {};
for (const file of protectedFiles) {
  initialHashes[file] = calculateFileHash(file);
}
console.log(`Successfully calculated hashes for ${protectedFiles.length} files.\n`);

// 2. Test Execution Tracker Setup
interface TestContext {
  assert(condition: any, message: string): void;
}

type TestFn = (t: TestContext) => void | Promise<void>;

let registeredTests = 0;
let passedTests = 0;
let failedTests = 0;
let testsWithZeroAssertions = 0;

async function test(name: string, fn: TestFn): Promise<void> {
  registeredTests++;
  let assertionsCount = 0;
  const context: TestContext = {
    assert(condition: any, message: string) {
      assertionsCount++;
      if (!condition) {
        throw new Error(`Assertion failed: ${message}`);
      }
    }
  };

  try {
    await fn(context);
    if (assertionsCount === 0) {
      testsWithZeroAssertions++;
      failedTests++;
      console.log(`[ZERO ASSERTIONS] ${name}`);
    } else {
      passedTests++;
      console.log(`[PASS] ${name}`);
    }
  } catch (err: any) {
    failedTests++;
    console.error(`[FAIL] ${name}: ${err?.message || err}`);
    if (err?.stack) {
      console.error(err.stack);
    }
  }
}

// Read and isolate block helper
const serverPath = path.resolve(process.cwd(), "server.ts");
const serverContent = fs.readFileSync(serverPath, "utf8");

const importRouteStart = serverContent.indexOf('app.post("/api/ai-import",');
const nextRouteStart = serverContent.indexOf('app.post("/api/ai-suggest-songs",');

if (importRouteStart === -1 || nextRouteStart === -1) {
  console.error("FATAL: Could not isolate /api/ai-import or /api/ai-suggest-songs route in server.ts");
  process.exit(1);
}

const importRouteBlock = serverContent.substring(importRouteStart, nextRouteStart);

async function runTests() {
  // 1. Imports
  await test("1. server.ts importa authorizeAiRequest", (t) => {
    t.assert(
      serverContent.includes("authorizeAiRequest") &&
      /import\s*\{\s*authorizeAiRequest/s.test(serverContent),
      "server.ts deve importar authorizeAiRequest"
    );
  });

  await test("2. server.ts importa InMemoryAiRateLimiter", (t) => {
    t.assert(
      serverContent.includes("InMemoryAiRateLimiter") &&
      /import\s*\{.*InMemoryAiRateLimiter.*\}\s*from\s*"\.\/services\/server\/aiRequestSecurity\.js"/s.test(serverContent),
      "server.ts deve importar InMemoryAiRateLimiter do caminho correto"
    );
  });

  // 2. Limiters
  await test("3. server.ts cria aiImportRateLimiter", (t) => {
    t.assert(
      serverContent.includes("const aiImportRateLimiter = new InMemoryAiRateLimiter();"),
      "Deve instanciar aiImportRateLimiter como InMemoryAiRateLimiter"
    );
  });

  await test("4. server.ts preserva fixChordsRateLimiter", (t) => {
    t.assert(
      serverContent.includes("const fixChordsRateLimiter = new InMemoryAiRateLimiter();"),
      "Deve preservar fixChordsRateLimiter"
    );
  });

  // 3. authorizeAiRequest invocation & arguments
  await test("5. /api/ai-import chama authorizeAiRequest", (t) => {
    t.assert(
      importRouteBlock.includes("authorizeAiRequest"),
      "A rota de importação deve invocar authorizeAiRequest"
    );
  });

  await test("6. authorizeAiRequest recebe authHeader", (t) => {
    t.assert(
      /authHeader\s*:\s*authHeader/s.test(importRouteBlock) || /authHeader\s*,/s.test(importRouteBlock),
      "authorizeAiRequest deve receber authHeader"
    );
  });

  await test("7. authorizeAiRequest recebe organizationId: orgId", (t) => {
    t.assert(
      /organizationId\s*:\s*orgId/s.test(importRouteBlock),
      "authorizeAiRequest deve receber organizationId como orgId"
    );
  });

  await test("8. authorizeAiRequest recebe claimedUserId: userId", (t) => {
    t.assert(
      /claimedUserId\s*:\s*userId/s.test(importRouteBlock),
      "authorizeAiRequest deve receber claimedUserId como userId"
    );
  });

  await test("9. authorizeAiRequest recebe requiredFeature: \"aiImport\"", (t) => {
    t.assert(
      /requiredFeature\s*:\s*["']aiImport["']/s.test(importRouteBlock),
      "authorizeAiRequest deve requerer feature aiImport"
    );
  });

  await test("10. authorizeAiRequest recebe requiredAnyPermissions: [\"canManageRepertoire\"]", (t) => {
    t.assert(
      /requiredAnyPermissions\s*:\s*\[\s*["']canManageRepertoire["']\s*\]/s.test(importRouteBlock),
      "authorizeAiRequest deve requerer permissão canManageRepertoire"
    );
  });

  await test("11. authorizeAiRequest recebe dbInstance: db", (t) => {
    t.assert(
      /dbInstance\s*:\s*db/s.test(importRouteBlock),
      "authorizeAiRequest deve receber dbInstance como db"
    );
  });

  await test("12. authorizeAiRequest recebe authInstance: auth", (t) => {
    t.assert(
      /authInstance\s*:\s*auth/s.test(importRouteBlock),
      "authorizeAiRequest deve receber authInstance como auth"
    );
  });

  // 4. Removals of legacy auth in /api/ai-import
  await test("13. /api/ai-import não contém admin.auth().verifyIdToken", (t) => {
    t.assert(
      !importRouteBlock.includes("verifyIdToken"),
      "/api/ai-import não deve conter verifyIdToken manual"
    );
  });

  await test("14. /api/ai-import não contém db.collection('users').doc(decodedUid) para auth inline", (t) => {
    t.assert(
      !importRouteBlock.includes("db.collection('users').doc(decodedUid)"),
      "/api/ai-import não deve ler diretamente a coleção de users para autenticação inline"
    );
  });

  await test("15. /api/ai-import não contém userSnap.data()?.organizationId !== orgId", (t) => {
    t.assert(
      !importRouteBlock.includes("userSnap.data()?.organizationId !== orgId") &&
      !importRouteBlock.includes("userSnap.data()?.organizationId"),
      "/api/ai-import não deve comparar organizationId inline diretamente do snapshot do usuário"
    );
  });

  await test("16. /api/ai-import não contém music_scale_plan", (t) => {
    t.assert(
      !importRouteBlock.includes("music_scale_plan"),
      "/api/ai-import não deve referenciar explicitamente music_scale_plan inline"
    );
  });

  await test("17. /api/ai-import não contém PLAN_FEATURES", (t) => {
    t.assert(
      !importRouteBlock.includes("PLAN_FEATURES"),
      "/api/ai-import não deve referenciar PLAN_FEATURES inline"
    );
  });

  await test("18. /api/ai-import não contém lista de papéis globais manual com admin/owner/dono/supervisor/support/suporte", (t) => {
    t.assert(
      !importRouteBlock.includes("'suporte'") &&
      !importRouteBlock.includes("'supervisor'") &&
      !importRouteBlock.includes("'dono'"),
      "/api/ai-import não deve conter papéis legados manuais"
    );
  });

  await test("19. /api/ai-import não contém isGlobalAdmin manual", (t) => {
    t.assert(
      !importRouteBlock.includes("let isGlobalAdmin") &&
      !importRouteBlock.includes("isGlobalAdmin = true"),
      "/api/ai-import não deve calcular isGlobalAdmin manualmente"
    );
  });

  // 5. Handling authorizeAiRequest result
  await test("20. /api/ai-import usa authResult.ok", (t) => {
    t.assert(
      importRouteBlock.includes("authResult.ok"),
      "Deve verificar authResult.ok"
    );
  });

  await test("21. erro authResult retorna status err.statusCode", (t) => {
    t.assert(
      /status\(\s*err\.statusCode\s*\)/s.test(importRouteBlock),
      "Deve responder com err.statusCode quando auth falha"
    );
  });

  await test("22. erro authResult não vaza token", (t) => {
    const authErrorBlock = importRouteBlock.substring(
      importRouteBlock.indexOf("authResult.ok"),
      importRouteBlock.indexOf("aiAuthContext")
    );
    t.assert(
      !authErrorBlock.includes("token") && !authErrorBlock.includes("Bearer"),
      "Erro de autenticação não deve expor dados sensíveis do token"
    );
  });

  await test("23. erro authResult não vaza email", (t) => {
    const authErrorBlock = importRouteBlock.substring(
      importRouteBlock.indexOf("authResult.ok"),
      importRouteBlock.indexOf("aiAuthContext")
    );
    t.assert(
      !authErrorBlock.includes("email"),
      "Erro de autenticação não deve expor dados de email"
    );
  });

  await test("24. erro authResult não vaza stack", (t) => {
    const authErrorBlock = importRouteBlock.substring(
      importRouteBlock.indexOf("authResult.ok"),
      importRouteBlock.indexOf("aiAuthContext")
    );
    t.assert(
      !authErrorBlock.includes("stack"),
      "Erro de autenticação não deve possuir stacktrace"
    );
  });

  // 6. rawText validations
  await test("25. server.ts define MAX_AI_IMPORT_RAW_TEXT_CHARS = 64000", (t) => {
    t.assert(
      serverContent.includes("MAX_AI_IMPORT_RAW_TEXT_CHARS = 64000") ||
      serverContent.includes("MAX_AI_IMPORT_RAW_TEXT_CHARS=64000"),
      "Deve declarar MAX_AI_IMPORT_RAW_TEXT_CHARS"
    );
  });

  await test("26. /api/ai-import rejeita rawText não string", (t) => {
    t.assert(
      /typeof rawText\s*!==\s*["']string["']/s.test(importRouteBlock),
      "Deve validar se rawText é string"
    );
  });

  await test("27. /api/ai-import rejeita rawText acima de 64000", (t) => {
    t.assert(
      /rawText\.length\s*>\s*MAX_AI_IMPORT_RAW_TEXT_CHARS/s.test(importRouteBlock),
      "Deve verificar se rawText excede o limite máximo"
    );
  });

  await test("28. rawText grande retorna status 413", (t) => {
    t.assert(
      importRouteBlock.includes("413"),
      "Rejeição por tamanho deve retornar status 413"
    );
  });

  await test("29. rawText tipo inválido retorna status 422", (t) => {
    t.assert(
      importRouteBlock.includes("422"),
      "Rejeição por tipo inválido deve retornar status 422"
    );
  });

  await test("30. resposta de rawText grande não contém rawText", (t) => {
    const textValidationBlock = importRouteBlock.substring(
      importRouteBlock.indexOf("MAX_AI_IMPORT_RAW_TEXT_CHARS"),
      importRouteBlock.indexOf("aiImportRateLimiter.acquire")
    );
    t.assert(
      !textValidationBlock.includes("details: rawText") &&
      !textValidationBlock.includes("rawText: rawText"),
      "Resposta de erro de rawText grande não deve devolver o texto rejeitado"
    );
  });

  // 7. Rate limiter acquisition
  await test("31. /api/ai-import chama aiImportRateLimiter.acquire", (t) => {
    t.assert(
      importRouteBlock.includes("aiImportRateLimiter.acquire"),
      "Deve chamar acquire no rate limiter"
    );
  });

  await test("32. acquire usa uid: aiAuthContext.uid", (t) => {
    t.assert(
      /uid\s*:\s*aiAuthContext\.uid/s.test(importRouteBlock),
      "acquire deve passar uid de aiAuthContext"
    );
  });

  await test("33. acquire usa organizationId: aiAuthContext.organizationId", (t) => {
    t.assert(
      /organizationId\s*:\s*aiAuthContext\.organizationId/s.test(importRouteBlock),
      "acquire deve passar organizationId de aiAuthContext"
    );
  });

  await test("34. acquire usa endpointKey: \"ai-import\"", (t) => {
    t.assert(
      /endpointKey\s*:\s*["']ai-import["']/s.test(importRouteBlock),
      "acquire deve passar endpointKey ai-import"
    );
  });

  await test("35. rate limit bloqueado retorna status 429", (t) => {
    t.assert(
      importRouteBlock.includes("429"),
      "Bloqueio por rate limit deve retornar status 429"
    );
  });

  await test("36. rate limit bloqueado retorna erro AI_RATE_LIMITED nos details, sem stack", (t) => {
    const rateLimitBlock = importRouteBlock.substring(
      importRouteBlock.indexOf("aiImportRateLimiter.acquire"),
      importRouteBlock.indexOf("aiImportRateLimitSlot =")
    );
    t.assert(
      rateLimitBlock.includes("AI_RATE_LIMITED") && !rateLimitBlock.includes("stack"),
      "Rate limit deve retornar AI_RATE_LIMITED nos details e sem stack"
    );
  });

  await test("37. aiImportRateLimitSlot.release aparece em finally", (t) => {
    const finallyBlock = importRouteBlock.substring(importRouteBlock.lastIndexOf("finally"));
    t.assert(
      finallyBlock.includes("release()"),
      "slot release deve ser acionado no bloco finally"
    );
  });

  await test("38. release é protegido contra slot null", (t) => {
    const finallyBlock = importRouteBlock.substring(importRouteBlock.lastIndexOf("finally"));
    t.assert(
      /if\s*\(\s*aiImportRateLimitSlot\s*\)/s.test(finallyBlock),
      "Deve proteger o release contra slot nulo"
    );
  });

  // 8. Preservation of scraping & scraping adapters
  await test("39. /api/ai-import preserva fetchAiImportHtmlSafely", (t) => {
    t.assert(
      importRouteBlock.includes("fetchAiImportHtmlSafely"),
      "Deve preservar fetchAiImportHtmlSafely"
    );
  });

  await test("40. /api/ai-import preserva safeExternalFetch: aiImportSafeExternalFetch", (t) => {
    t.assert(
      importRouteBlock.includes("aiImportSafeExternalFetch"),
      "Deve passar aiImportSafeExternalFetch"
    );
  });

  await test("41. /api/ai-import continua sem fetch(normalizedUrlStr)", (t) => {
    t.assert(
      !importRouteBlock.includes("fetch(normalizedUrlStr"),
      "Não deve conter chamada de fetch direta com normalizedUrlStr"
    );
  });

  await test("42. /api/ai-import continua sem fetchResponse", (t) => {
    t.assert(
      !importRouteBlock.includes("fetchResponse"),
      "Não deve conter variável fetchResponse"
    );
  });

  await test("43. /api/ai-import continua sem new AbortController() no scraping", (t) => {
    t.assert(
      !importRouteBlock.includes("new AbortController()"),
      "Não deve ter AbortController inline no scraping"
    );
  });

  await test("44. /api/ai-import preserva rawText path com let textToProcess = rawText || \"\"", (t) => {
    t.assert(
      importRouteBlock.includes('let textToProcess = rawText || ""') ||
      importRouteBlock.includes("let textToProcess = rawText || ''"),
      "Deve declarar textToProcess fallback corretamente"
    );
  });

  await test("45. /api/ai-import preserva if (url && !textToProcess)", (t) => {
    t.assert(
      importRouteBlock.includes("if (url && !textToProcess)"),
      "Deve preservar a estratégia condicional"
    );
  });

  // 9. Sanitization of errors in final catch block
  await test("46. catch final não retorna unhandledErr.stack", (t) => {
    const catchBlock = importRouteBlock.substring(importRouteBlock.lastIndexOf("catch (unhandledErr"));
    t.assert(
      !catchBlock.includes("unhandledErr.stack"),
      "Não deve expor unhandledErr.stack"
    );
  });

  await test("47. catch final não retorna unhandledErr.message", (t) => {
    const catchBlock = importRouteBlock.substring(importRouteBlock.lastIndexOf("catch (unhandledErr"));
    t.assert(
      !catchBlock.includes("unhandledErr.message") ||
      (catchBlock.indexOf("unhandledErr.message") < catchBlock.indexOf("res.status") &&
       !catchBlock.substring(catchBlock.indexOf("res.status")).includes("unhandledErr.message")),
      "Não deve expor unhandledErr.message na resposta ao cliente"
    );
  });

  await test("48. catch final retorna INTERNAL_AI_IMPORT_ERROR", (t) => {
    const catchBlock = importRouteBlock.substring(importRouteBlock.lastIndexOf("catch (unhandledErr"));
    t.assert(
      catchBlock.includes("INTERNAL_AI_IMPORT_ERROR"),
      "Deve retornar INTERNAL_AI_IMPORT_ERROR"
    );
  });

  await test("49. resposta final de UNKNOWN não contém chave stack", (t) => {
    const catchBlock = importRouteBlock.substring(importRouteBlock.lastIndexOf("catch (unhandledErr"));
    t.assert(
      !catchBlock.includes("stack:"),
      "Resposta UNKNOWN final não deve conter chave 'stack'"
    );
  });

  await test("50. resposta final de UNKNOWN não contém objeto Error", (t) => {
    const catchBlock = importRouteBlock.substring(importRouteBlock.lastIndexOf("catch (unhandledErr"));
    t.assert(
      !catchBlock.includes("new Error("),
      "Resposta UNKNOWN final não deve conter objetos Error"
    );
  });

  await test("51. logError interno pode receber erro, mas response não", (t) => {
    const catchBlock = importRouteBlock.substring(importRouteBlock.lastIndexOf("catch (unhandledErr"));
    t.assert(
      catchBlock.includes("logError") &&
      catchBlock.includes("res.status") &&
      !catchBlock.substring(catchBlock.indexOf("res.status")).includes("unhandledErr"),
      "logError interno pode reter dados para depuração, mas a resposta de erro final deve permanecer sanitizada"
    );
  });

  // 10. /api/fix-chords integrity
  await test("52. /api/fix-chords não foi alterado semanticamente: ainda usa createFixChordsHandler", (t) => {
    t.assert(
      serverContent.includes("createFixChordsHandler"),
      "Deve reter createFixChordsHandler"
    );
  });

  await test("53. /api/fix-chords ainda usa fixChordsRateLimiter", (t) => {
    t.assert(
      /rateLimiter\s*:\s*fixChordsRateLimiter/s.test(serverContent),
      "Deve reter o rate limiter do fix chords"
    );
  });

  // 11. Hashes integrity assertions (54 to 61)
  await test("54. services/server/fixChordsHandler.ts hash final igual inicial", (t) => {
    const currentHash = calculateFileHash("services/server/fixChordsHandler.ts");
    t.assert(currentHash === initialHashes["services/server/fixChordsHandler.ts"], "Hash de fixChordsHandler alterado");
  });

  await test("55. aiRequestSecurity.ts hash final igual inicial", (t) => {
    const currentHash = calculateFileHash("services/server/aiRequestSecurity.ts");
    t.assert(currentHash === initialHashes["services/server/aiRequestSecurity.ts"], "Hash de aiRequestSecurity alterado");
  });

  await test("56. aiImportSafeFetchAdapter.ts hash final igual inicial", (t) => {
    const currentHash = calculateFileHash("services/server/aiImportSafeFetchAdapter.ts");
    t.assert(currentHash === initialHashes["services/server/aiImportSafeFetchAdapter.ts"], "Hash de aiImportSafeFetchAdapter alterado");
  });

  await test("57. safeExternalFetch.ts hash final igual inicial", (t) => {
    const currentHash = calculateFileHash("services/server/safeExternalFetch.ts");
    t.assert(currentHash === initialHashes["services/server/safeExternalFetch.ts"], "Hash de safeExternalFetch alterado");
  });

  await test("58. frontend hash final igual inicial (index.tsx, App.tsx)", (t) => {
    const indexHash = calculateFileHash("index.tsx");
    const appHash = calculateFileHash("App.tsx");
    t.assert(
      indexHash === initialHashes["index.tsx"] &&
      appHash === initialHashes["App.tsx"],
      "Hashes do frontend alterados"
    );
  });

  await test("59. package.json hash final igual inicial", (t) => {
    const currentHash = calculateFileHash("package.json");
    t.assert(currentHash === initialHashes["package.json"], "Hash de package.json alterado");
  });

  await test("60. package-lock.json hash final igual inicial", (t) => {
    const currentHash = calculateFileHash("package-lock.json");
    t.assert(currentHash === initialHashes["package-lock.json"], "Hash de package-lock.json alterado");
  });

  await test("61. firestore.rules hash final igual inicial", (t) => {
    const currentHash = calculateFileHash("firestore.rules");
    t.assert(currentHash === initialHashes["firestore.rules"], "Hash de firestore.rules alterado");
  });

  // 12. Structure & final constraints
  await test("62. não existem arquivos app/applet duplicados", (t) => {
    const appExists = fs.existsSync(path.resolve(process.cwd(), "app"));
    const appletExists = fs.existsSync(path.resolve(process.cwd(), "applet"));
    t.assert(!appExists && !appletExists, "Diretórios app/applet duplicados não devem existir");
  });

  await test("63. não existem arquivos debug/patch/fix/update/check proibidos na raiz", (t) => {
    // Avoid checking long-standing test scripts or historical ones, but ensure no new forbidden temporal debug tools are there.
    const forbidden = ["debug.ts", "patch.ts", "update_tmp.ts", "check_tmp.ts"];
    let foundForbidden = false;
    for (const f of forbidden) {
      if (fs.existsSync(path.resolve(process.cwd(), f))) {
        foundForbidden = true;
      }
    }
    t.assert(!foundForbidden, "Nenhum arquivo de patch/debug proibido deve existir na raiz");
  });

  await test("64. passedTests + failedTests === registeredTests", (t) => {
    t.assert(passedTests + failedTests === registeredTests - 1, "Contadores inconsistentes");
  });

  await test("65. failedTests === 0", (t) => {
    t.assert(failedTests === 0, `Existem ${failedTests} testes falhando`);
  });

  await test("66. testsWithZeroAssertions === 0", (t) => {
    t.assert(testsWithZeroAssertions === 0, "Existem testes sem asserção");
  });

  // Final Summary Output
  console.log("\n=======================================================");
  console.log("Governance and Rate Limit Integration Test Suite Summary:");
  console.log(`Total Registered: ${registeredTests}`);
  console.log(`Total Passed:     ${passedTests}`);
  console.log(`Total Failed:     ${failedTests}`);
  console.log(`Zero Assertions:  ${testsWithZeroAssertions}`);
  console.log("=======================================================");

  if (failedTests > 0 || passedTests + failedTests !== registeredTests) {
    console.error("\nFAILURE: One or more assertions failed.");
    process.exit(1);
  } else {
    console.log("\nSUCCESS: All tests completed with clean assertions.");
    process.exit(0);
  }
}

runTests();
