import fs from "fs";
import path from "path";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`[FAIL] ${message}`);
    process.exit(1);
  }
  console.log(`[OK] ${message}`);
}

async function runTests() {
  console.log("=== RUNNING TEST: 0.2C.1E.7 Shadow Read-Path FinOps ===");

  const serverTsPath = path.join(process.cwd(), "server.ts");
  const serverTsContent = fs.readFileSync(serverTsPath, "utf-8");

  // A. Escopo e Higiene
  assert(serverTsContent.includes("resolveAiImportFinOpsReadPath"), "Importa/usa resolveAiImportFinOpsReadPath");
  assert(serverTsContent.includes("createAiFinOpsFirestoreAdapter"), "Importa/usa createAiFinOpsFirestoreAdapter");
  assert(serverTsContent.includes("AI_IMPORT_FINOPS_READ_PATH_ENABLED"), "Contém flag AI_IMPORT_FINOPS_READ_PATH_ENABLED");
  assert(serverTsContent.includes("AI_FINOPS_HMAC_SECRET"), "Contém secret AI_FINOPS_HMAC_SECRET");
  assert(serverTsContent.includes("process.env.AI_IMPORT_FINOPS_READ_PATH_ENABLED === \"true\""), "Exige estritamente flag === true");
  
  assert(!serverTsContent.includes("beginAiFinOpsReservation"), "Não importa/chama beginAiFinOpsReservation");
  assert(!serverTsContent.includes("finalizeAiFinOpsReservation"), "Não importa/chama finalizeAiFinOpsReservation");

  // Check new public fields
  const aiImportRoute = serverTsContent.split('app.post("/api/ai-import"')[1];
  assert(!!aiImportRoute, "Encontrou rota /api/ai-import");
  
  // Basic search for res.json or res.status().json() returning these fields in the whole route
  // We can just ensure words like cacheHit, idempotencyHit don't appear anywhere inside makeErrorResponse or normal json sends
  // except maybe if they existed before? We only check if they are added as keys in object literals:
  assert(!aiImportRoute.includes("finOps:"), "Não adiciona campo finOps no response");
  assert(!aiImportRoute.includes("aiFinOps:"), "Não adiciona campo aiFinOps no response");
  assert(!aiImportRoute.includes("cacheHit:"), "Não adiciona campo cacheHit no response");
  assert(!aiImportRoute.includes("idempotencyHit:"), "Não adiciona campo idempotencyHit no response");

  // B. Shadow-only guarantee
  const shadowBlockMatch = serverTsContent.match(/\/\/ AI_FINOPS_SHADOW_READ_PATH_START([\s\S]*?)\/\/ AI_FINOPS_SHADOW_READ_PATH_END/);
  assert(!!shadowBlockMatch, "Encontrou bloco delimitado AI_FINOPS_SHADOW_READ_PATH_START/END");
  const shadowBlock = shadowBlockMatch ? shadowBlockMatch[1] : "";

  assert(!shadowBlock.includes("return res."), "Shadow block não usa return res.");
  assert(!shadowBlock.includes("res.json"), "Shadow block não usa res.json");
  assert(!shadowBlock.includes("res.status"), "Shadow block não usa res.status");
  assert(!shadowBlock.includes("throw "), "Shadow block não usa throw");
  assert(!shadowBlock.includes("tx.set"), "Shadow block não usa tx.set");
  assert(!shadowBlock.includes("tx.create"), "Shadow block não usa tx.create");
  assert(!shadowBlock.includes("tx.update"), "Shadow block não usa tx.update");

  // C. Safe logging
  // We must ensure the arguments to logInfo / logWarn don't contain raw variables directly,
  // except safeFinOpsShadowSummary and requestId.
  // We can just regex logInfo and logWarn inside the block
  const logCalls = shadowBlock.match(/log(?:Info|Warn|Error)\([^)]+\)/g) || [];
  for (const call of logCalls) {
    assert(!call.match(/\brawText\b/) || call.includes("typeof rawText"), `Log call safe from rawText: ${call}`);
    assert(!call.match(/\blyrics\b/), `Log call safe from lyrics: ${call}`);
    assert(!call.match(/\bchords\b/), `Log call safe from chords: ${call}`);
    assert(!call.match(/\bcleanLyrics\b/), `Log call safe from cleanLyrics: ${call}`);
    assert(!call.match(/\bcleanChords\b/), `Log call safe from cleanChords: ${call}`);
    assert(!call.match(/\bauthorization\b/), `Log call safe from authorization: ${call}`);
    assert(!call.match(/\btoken\b/) || call.includes("Tokens"), `Log call safe from token: ${call}`); // exclude estimatedInputTokens
    assert(!call.match(/\bcookie\b/), `Log call safe from cookie: ${call}`);
    assert(!call.match(/\bheaders\b/), `Log call safe from headers: ${call}`);
    assert(!call.match(/\bprompt\b/), `Log call safe from prompt: ${call}`);
    // secret is used in const secret, but shouldn't be passed to log
    assert(!call.match(/(?<!["'`])secret(?!["'`])/), `Log call safe from secret variable: ${call}`);
  }

  // Also manually verify some fields in safeFinOpsShadowSummary
  assert(shadowBlock.includes("safeFinOpsShadowSummary = {"), "Cria o objeto safeFinOpsShadowSummary");
  assert(shadowBlock.includes("logInfo(\"FINOPS_SHADOW\", \"Shadow read-path executed\", safeFinOpsShadowSummary)"), "Loga safeFinOpsShadowSummary perfeitamente");
  
  console.log("=== PASSED: 0.2C.1E.7 Shadow Read-Path FinOps ===");
}

runTests().catch(err => {
  console.error("Test failed", err);
  process.exit(1);
});
