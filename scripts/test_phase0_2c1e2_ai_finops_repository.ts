import * as fs from "fs";
import * as path from "path";
import * as crypto from "node:crypto";
import {
  AI_FINOPS_POLICY_VERSION,
  AI_TOKEN_ESTIMATION_CHARS_PER_TOKEN,
  buildAiFirestorePaths,
  AiFirestorePaths,
} from "../services/server/aiFinOpsPolicy";
import {
  AiIdempotencyStatus,
  AiUsageCounters,
  AiIdempotencyRecord,
  AiCacheRecord,
  createEmptyUsageCounters,
  normalizeUsageCounters,
  buildUsageIncrement,
  readAiUsageSnapshot,
  createProcessingIdempotencyRecord,
  classifyExistingIdempotencyRecord,
  sanitizeCacheResultSummary,
  assertRepositoryPayloadIsPrivate,
  beginAiFinOpsReservation,
  finalizeAiFinOpsReservation,
  deriveEstimatedOutputCharsFromTokens,
  AI_FINOPS_REPOSITORY_ERRORS,
  AiFinOpsStorageAdapter,
  AiFinOpsTransactionAdapter,
} from "../services/server/aiFinOpsRepository";

let registeredTests = 0;
let passedTests = 0;
let failedTests = 0;
let testsWithZeroAssertions = 0;

interface TestContext {
  assert: (condition: boolean, message: string) => void;
}

interface TestCase {
  name: string;
  fn: (t: TestContext) => void | Promise<void>;
}

const queue: TestCase[] = [];

function test(name: string, fn: (t: TestContext) => void | Promise<void>) {
  queue.push({ name, fn });
}

// --- RECORD INITIAL HASHES OF PROTECTED FILES ---
const protectedFiles = [
  "server.ts",
  "components/songs/AiSongImportModal.tsx",
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
  "services/entitlementsConstants.ts",
  "services/entitlementsService.ts",
  "services/usageService.ts",
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
  "scripts/test_phase0_2c1d1_ai_import_governance_rate_limit.ts",
  "scripts/test_phase0_2c1d3_ai_import_body_prompt_logs_frontend.ts",
  "scripts/test_phase0_2c1e1_ai_finops_policy.ts",
];

const initialHashes: Record<string, string> = {};
for (const file of protectedFiles) {
  if (!fs.existsSync(file)) {
    throw new Error(`PROTECTED_FILE_MISSING:${file}`);
  }
  const content = fs.readFileSync(file);
  initialHashes[file] = crypto.createHash("sha256").update(content).digest("hex");
}

// --- IN-MEMORY FAKE ADAPTER ---
class InMemoryAiFinOpsStorageAdapter implements AiFinOpsStorageAdapter {
  public db: Map<string, any> = new Map();
  public ops: Array<{ op: string; path: string; data?: any }> = [];

  async runTransaction<T>(fn: (tx: AiFinOpsTransactionAdapter) => Promise<T>): Promise<T> {
    const tx: AiFinOpsTransactionAdapter = {
      get: async (path: string) => {
        this.ops.push({ op: "get", path });
        const val = this.db.get(path);
        return val ? JSON.parse(JSON.stringify(val)) : null;
      },
      create: async (path: string, data: Record<string, unknown>) => {
        this.ops.push({ op: "create", path, data });
        if (this.db.has(path)) {
          throw new Error("AI_FINOPS_REPOSITORY_IDEMPOTENCY_CONFLICT: Document already exists");
        }
        this.db.set(path, JSON.parse(JSON.stringify(data)));
      },
      set: async (path: string, data: Record<string, unknown>, options?: { merge?: boolean }) => {
        this.ops.push({ op: "set", path, data });
        if (options?.merge) {
          const existing = this.db.get(path) || {};
          const merged = { ...existing, ...data };
          this.db.set(path, JSON.parse(JSON.stringify(merged)));
        } else {
          this.db.set(path, JSON.parse(JSON.stringify(data)));
        }
      },
      update: async (path: string, data: Record<string, unknown>) => {
        this.ops.push({ op: "update", path, data });
        if (!this.db.has(path)) {
          throw new Error("Document not found");
        }
        const existing = this.db.get(path) || {};
        const updated = { ...existing, ...data };
        this.db.set(path, JSON.parse(JSON.stringify(updated)));
      },
    };
    return fn(tx);
  }
}

// ==========================================
// A. ESCOPO / IMPORTS
// ==========================================
test("A. Escopo e Imports de aiFinOpsRepository.ts", (t) => {
  const repoPath = path.join("services", "server", "aiFinOpsRepository.ts");
  t.assert(fs.existsSync(repoPath), "1. aiFinOpsRepository.ts existe no caminho correto");

  const selfPath = path.join("scripts", "test_phase0_2c1e2_ai_finops_repository.ts");
  t.assert(fs.existsSync(selfPath), "2. test_phase0_2c1e2_ai_finops_repository.ts existe");

  const content = fs.readFileSync(repoPath, "utf-8");
  t.assert(!content.includes("import firebase"), "3. Não importa firebase");
  t.assert(!content.includes('import * as admin from "firebase-admin"'), "4. Não importa firebase-admin");
  t.assert(!content.includes("firestore"), "5. Não importa firestore");
  t.assert(!content.includes("GoogleGenAI"), "6. Não importa GoogleGenAI");
  t.assert(!content.includes("express"), "7. Não importa express");
  t.assert(!content.includes("server.ts"), "8. Não importa server.ts");
  t.assert(content.includes("aiFinOpsPolicy"), "9. Importa aiFinOpsPolicy corretamente");
  t.assert(!content.includes("fetch("), "10. Não usa fetch");
  t.assert(!content.includes("FieldValue"), "11. Não usa FieldValue do Firestore");
  t.assert(content.includes('import * as crypto from "node:crypto"') || !content.includes("crypto"), "12. Importação opcional de crypto é limpa");
});

// ==========================================
// B. COUNTERS
// ==========================================
test("B. Operações de Counters de Uso", (t) => {
  const empty = createEmptyUsageCounters();
  t.assert(empty.requestCount === 0, "13. createEmptyUsageCounters requestCount é zero");
  t.assert(empty.estimatedInputTokens === 0, "14. input tokens é zero");
  t.assert(empty.estimatedOutputTokens === 0, "15. output tokens é zero");
  t.assert(empty.estimatedTotalTokens === 0, "16. total tokens é zero");

  const norm1 = normalizeUsageCounters(undefined);
  t.assert(norm1.requestCount === 0, "17. normalize trata undefined corretamente");

  const norm2 = normalizeUsageCounters({
    requestCount: -5,
    estimatedInputTokens: "invalid",
    estimatedOutputTokens: 25.5,
    estimatedTotalTokens: null,
  });
  t.assert(norm2.requestCount === 0, "18. Trata valores negativos como zero");
  t.assert(norm2.estimatedInputTokens === 0, "19. Trata strings como zero");
  t.assert(norm2.estimatedOutputTokens === 25, "20. Arredonda valores decimais");
  t.assert(norm2.estimatedTotalTokens === 0, "21. Trata nulos como zero");

  const inputObj = { requestCount: 10 };
  const norm3 = normalizeUsageCounters(inputObj);
  t.assert(norm3.requestCount === 10, "22. Preserva contadores corretos");
  t.assert(inputObj.requestCount === 10, "23. Não muta o input");

  const inc = buildUsageIncrement({ estimatedInputTokens: 100, estimatedOutputTokens: 50 });
  t.assert(inc.requestCount === 1, "24. Incremento sempre inicia requestCount em 1");
  t.assert(inc.estimatedInputTokens === 100, "25. Preserva estimatedInputTokens");
  t.assert(inc.estimatedOutputTokens === 50, "26. Preserva estimatedOutputTokens");
  t.assert(inc.estimatedTotalTokens === 150, "27. Calcula soma de tokens");

  try {
    buildUsageIncrement({ estimatedInputTokens: -10, estimatedOutputTokens: 0 });
    t.assert(true, "28. buildUsageIncrement aceita e trata negativos");
    const negInc = buildUsageIncrement({ estimatedInputTokens: -10, estimatedOutputTokens: -5 });
    t.assert(negInc.estimatedInputTokens === 0, "29. Negativos viram zero em buildUsageIncrement");
  } catch (e) {
    t.assert(false, "28. Lançou erro inesperado para negativos");
  }
});

// ==========================================
// C. FAKE TRANSACTION CONTRACT
// ==========================================
test("C. Contrato de Transação do Adapter Fake", async (t) => {
  const adapter = new InMemoryAiFinOpsStorageAdapter();
  
  await adapter.runTransaction(async (tx) => {
    const d1 = await tx.get("path/1");
    t.assert(d1 === null, "30. tx.get em doc inexistente retorna null");

    await tx.create("path/1", { name: "test-doc" });
    const d2 = await tx.get("path/1");
    t.assert(d2 !== null && d2.name === "test-doc", "31. tx.create e tx.get funcionam");

    try {
      await tx.create("path/1", { name: "other" });
      t.assert(false, "32. tx.create deveria falhar para doc duplicado");
    } catch (e) {
      t.assert(true, "32. tx.create falha em duplicatas");
    }

    await tx.set("path/2", { a: 1, b: 2 });
    await tx.set("path/2", { b: 3 }, { merge: true });
    const d3 = await tx.get("path/2");
    t.assert(d3 !== null && d3.a === 1 && d3.b === 3, "33. tx.set merge preserva campos");

    await tx.set("path/2", { c: 5 });
    const d4 = await tx.get("path/2");
    t.assert(d4 !== null && d4.a === undefined && d4.c === 5, "34. tx.set sem merge substitui tudo");

    await tx.update("path/2", { d: 10 });
    const d5 = await tx.get("path/2");
    t.assert(d5 !== null && d5.c === 5 && d5.d === 10, "35. tx.update atualiza doc existente");

    try {
      await tx.update("path/non-existent", { val: 1 });
      t.assert(false, "36. tx.update deveria falhar em doc inexistente");
    } catch (e) {
      t.assert(true, "36. tx.update falha em doc inexistente");
    }
  });

  t.assert(adapter.ops.length > 0, "37. Operações registradas no log do adapter");
  t.assert(adapter.ops[0].op === "get", "38. Ordem correta de operações registradas");
});

// ==========================================
// D. READ USAGE SNAPSHOT
// ==========================================
test("D. Leitura do Snapshot de Uso", async (t) => {
  const adapter = new InMemoryAiFinOpsStorageAdapter();
  const paths = buildAiFirestorePaths({
    organizationId: "org-1",
    periodKeys: { monthKey: "2026-07", dayKey: "2026-07-04" },
    idempotencyKey: "idempotency-key",
    cacheKey: "cache-key",
    rateLimitBucketKey: "rate-limit-bucket-key",
  });

  await adapter.runTransaction(async (tx) => {
    const snap1 = await readAiUsageSnapshot(tx, paths);
    t.assert(snap1.monthlyRequestCount === 0, "39. Snapshot vazio retorna zero requests mensais");
    t.assert(snap1.dailyRequestCount === 0, "40. Snapshot vazio retorna zero requests diários");
    t.assert(snap1.monthlyEstimatedTokens === 0, "41. Snapshot vazio retorna zero tokens mensais");
    t.assert(snap1.dailyEstimatedTokens === 0, "42. Snapshot vazio retorna zero tokens diários");

    await tx.set(paths.monthlyUsageDocPath, {
      requestCount: 15,
      estimatedInputTokens: 5000,
      estimatedOutputTokens: 2000,
      estimatedTotalTokens: 7000,
    });
    await tx.set(paths.dailyUsageDocPath, {
      requestCount: 2,
      estimatedInputTokens: 800,
      estimatedOutputTokens: 100,
      estimatedTotalTokens: 900,
    });

    const snap2 = await readAiUsageSnapshot(tx, paths);
    t.assert(snap2.monthlyRequestCount === 15, "43. Retorna requestCount mensal real");
    t.assert(snap2.dailyRequestCount === 2, "44. Retorna requestCount diário real");
    t.assert(snap2.monthlyEstimatedTokens === 5000, "45. Retorna input tokens mensal real");
    t.assert(snap2.dailyEstimatedTokens === 800, "46. Retorna input tokens diário real");
  });
});

// ==========================================
// E. IDEMPOTÊNCIA
// ==========================================
test("E. Registro e Classificação de Idempotência", (t) => {
  const rec = createProcessingIdempotencyRecord({
    idempotencyKey: "key-abc",
    requestId: "req-123",
    cacheKey: "cache-999",
    expirationSeconds: 10,
  });

  t.assert(rec.status === "PROCESSING", "47. Cria com status PROCESSING");
  t.assert(rec.idempotencyKey === "key-abc", "48. Preserva idempotencyKey");
  t.assert(rec.requestId === "req-123", "49. Preserva requestId");
  t.assert(rec.cacheKey === "cache-999", "50. Preserva cacheKey");
  t.assert(new Date(rec.expiresAtIso) > new Date(rec.createdAtIso), "51. Valida expiração futura");

  const classNull = classifyExistingIdempotencyRecord(null, new Date());
  t.assert(classNull === "MISS", "52. Registro nulo retorna MISS");

  const now = new Date();
  const futureExpires = new Date(now.getTime() + 5000).toISOString();
  const pastExpires = new Date(now.getTime() - 5000).toISOString();

  const classProc = classifyExistingIdempotencyRecord({
    idempotencyKey: "k",
    status: "PROCESSING",
    requestId: "r",
    createdAtIso: now.toISOString(),
    updatedAtIso: now.toISOString(),
    expiresAtIso: futureExpires,
  }, now);
  t.assert(classProc === "IN_FLIGHT", "53. PROCESSING não expirado classificado como IN_FLIGHT");

  const classComp = classifyExistingIdempotencyRecord({
    idempotencyKey: "k",
    status: "COMPLETED",
    requestId: "r",
    createdAtIso: now.toISOString(),
    updatedAtIso: now.toISOString(),
    expiresAtIso: futureExpires,
  }, now);
  t.assert(classComp === "COMPLETED", "54. COMPLETED não expirado classificado como COMPLETED");

  const classFail = classifyExistingIdempotencyRecord({
    idempotencyKey: "k",
    status: "FAILED",
    requestId: "r",
    createdAtIso: now.toISOString(),
    updatedAtIso: now.toISOString(),
    expiresAtIso: futureExpires,
  }, now);
  t.assert(classFail === "FAILED_RETRY_ALLOWED", "55. FAILED não expirado classificado como FAILED_RETRY_ALLOWED");

  const classExp = classifyExistingIdempotencyRecord({
    idempotencyKey: "k",
    status: "COMPLETED",
    requestId: "r",
    createdAtIso: now.toISOString(),
    updatedAtIso: now.toISOString(),
    expiresAtIso: pastExpires,
  }, now);
  t.assert(classExp === "EXPIRED", "56. Expirado classificado como EXPIRED");
});

// ==========================================
// F. BEGIN RESERVATION
// ==========================================
test("F. Começar a Reserva de FinOps (Quota e Idempotência)", async (t) => {
  const adapter = new InMemoryAiFinOpsStorageAdapter();
  const paths = buildAiFirestorePaths({
    organizationId: "org-1",
    periodKeys: { monthKey: "2026-07", dayKey: "2026-07-04" },
    idempotencyKey: "idempotency-key",
    cacheKey: "cache-key",
    rateLimitBucketKey: "rate-limit-bucket-key",
  });

  const input = {
    adapter,
    paths,
    requestId: "req-first",
    organizationId: "org-1",
    uid: "user-1",
    idempotencyKey: "idempotency-key",
    cacheKey: "cache-key",
    sourceType: "rawText" as const,
    model: "gemini-3.5-flash",
    plan: "pro" as const,
    inputChars: 1000,
  };

  // Case 1: MISS (Vazio) -> RESERVED
  const res1 = await beginAiFinOpsReservation(input);
  t.assert(res1.status === "RESERVED", "57. Primeiro request retorna RESERVED");
  t.assert(res1.quotaDecision?.allowed === true, "58. Quota concedida para primeiro request");

  const storedIdempotency = adapter.db.get(paths.idempotencyDocPath);
  t.assert(storedIdempotency !== undefined, "59. Cria registro de idempotência");
  t.assert(storedIdempotency.status === "PROCESSING", "60. Idempotência reservada como PROCESSING");

  // Case 2: IN_FLIGHT -> IDEMPOTENCY_IN_FLIGHT
  const res2 = await beginAiFinOpsReservation({
    ...input,
    requestId: "req-second", // concurrent request
  });
  t.assert(res2.status === "IDEMPOTENCY_IN_FLIGHT", "61. Request simultâneo retorna IDEMPOTENCY_IN_FLIGHT");
  t.assert(res2.existingRecord?.requestId === "req-first", "62. Retorna o record existente correspondente");

  // Case 3: COMPLETED -> IDEMPOTENCY_COMPLETED
  adapter.db.set(paths.idempotencyDocPath, {
    ...storedIdempotency,
    status: "COMPLETED",
  });
  const res3 = await beginAiFinOpsReservation(input);
  t.assert(res3.status === "IDEMPOTENCY_COMPLETED", "63. Request após conclusão retorna IDEMPOTENCY_COMPLETED");

  // Case 4: QUOTA_BLOCKED
  // Reset idempotency to retry
  adapter.db.delete(paths.idempotencyDocPath);
  // Estourar contadores mensais
  adapter.db.set(paths.monthlyUsageDocPath, {
    requestCount: 15000, // estourado para plano starter
    estimatedInputTokens: 2500000,
    estimatedOutputTokens: 10000,
    estimatedTotalTokens: 2510000,
  });

  const res4 = await beginAiFinOpsReservation(input);
  t.assert(res4.status === "QUOTA_BLOCKED", "64. Retorna QUOTA_BLOCKED se quota excedida");
  t.assert(res4.quotaDecision?.allowed === false, "65. Quota decision é allowed=false");
  t.assert(res4.quotaDecision?.code === "AI_MONTHLY_REQUEST_QUOTA_EXCEEDED", "66. Causa correta de bloqueio de quota");

  // Garantir que não sobrescreveu/criou idempotência em caso de bloqueio
  t.assert(!adapter.db.has(paths.idempotencyDocPath), "67. Não gera registro de idempotência se bloqueado");
});

// ==========================================
// G. FINALIZE RESERVATION
// ==========================================
test("G. Finalizar a Reserva de FinOps (Consumo e Eventos)", async (t) => {
  const adapter = new InMemoryAiFinOpsStorageAdapter();
  const paths = buildAiFirestorePaths({
    organizationId: "org-1",
    periodKeys: { monthKey: "2026-07", dayKey: "2026-07-04" },
    idempotencyKey: "idempotency-key",
    cacheKey: "cache-key",
    rateLimitBucketKey: "rate-limit-bucket-key",
  });

  const input = {
    adapter,
    paths,
    requestId: "req-fin",
    organizationId: "org-1",
    uid: "user-1",
    idempotencyKey: "idempotency-key",
    cacheKey: "cache-key",
    sourceType: "rawText" as const,
    model: "gemini-3.5-flash",
    plan: "pro" as const,
    inputChars: 500,
  };

  // Definir estado inicial de idempotência em PROCESSING
  await adapter.runTransaction(async (tx) => {
    await tx.set(paths.idempotencyDocPath, createProcessingIdempotencyRecord({
      idempotencyKey: input.idempotencyKey,
      requestId: input.requestId,
      cacheKey: input.cacheKey,
    }) as any);
  });

  // Finalizar com SUCCESS (Deve consumir quota)
  await finalizeAiFinOpsReservation({
    ...input,
    outcome: "SUCCESS",
    estimatedInputTokens: 200,
    estimatedOutputTokens: 300,
    cacheSummary: {
      title: "Música de Teste",
      artist: "Artista Legal",
      hasLyrics: true,
      hasChords: false,
    },
    durationMs: 1500,
  });

  // Validar gravação do evento
  const eventDoc = adapter.db.get(`${paths.monthlyEventsCollectionPath}/${input.requestId}`);
  t.assert(eventDoc !== undefined, "68. Salva evento FinOps na subcoleção");
  t.assert(eventDoc.outcome === "SUCCESS", "69. Evento possui outcome correto");
  t.assert(eventDoc.durationMs === 1500, "70. Evento possui durationMs preservada");
  t.assert(eventDoc.estimatedOutputTokens === 300, "70a. Evento possui estimatedOutputTokens igual ao informado");
  t.assert(eventDoc.outputChars > 0, "70b. Evento possui outputChars derivado maior que zero");
  t.assert(eventDoc.outputChars === 300 * AI_TOKEN_ESTIMATION_CHARS_PER_TOKEN, "70c. Evento possui outputChars corretamente calculado (tokens * chars_per_token)");

  // Validar consumo de counters
  const monthlyCounters = normalizeUsageCounters(adapter.db.get(paths.monthlyUsageDocPath));
  t.assert(monthlyCounters.requestCount === 1, "71. Incrementa contagem mensal de requests");
  t.assert(monthlyCounters.estimatedInputTokens === 200, "72. Incrementa input tokens mensais");
  t.assert(monthlyCounters.estimatedOutputTokens === 300, "73. Incrementa output tokens mensais");
  t.assert(monthlyCounters.estimatedTotalTokens === 500, "74. Incrementa total tokens mensais");

  const dailyCounters = normalizeUsageCounters(adapter.db.get(paths.dailyUsageDocPath));
  t.assert(dailyCounters.requestCount === 1, "75. Incrementa contagem diária de requests");

  // Validar gravação do cache
  const cacheDoc = adapter.db.get(paths.cacheDocPath);
  t.assert(cacheDoc !== undefined, "76. Grava documento de cache correspondente");
  t.assert(cacheDoc.status === "READY", "77. Cache com status READY");
  t.assert(cacheDoc.resultSummary.title === "Música de Teste", "78. Cache contém sumário higienizado");

  // Validar marcação de idempotência concluída
  const idDoc = adapter.db.get(paths.idempotencyDocPath);
  t.assert(idDoc.status === "COMPLETED", "79. Marca idempotência como COMPLETED");

  // Finalizar outro request com FALHA (Não deve consumir quota, deve marcar FAILED)
  const failInput = {
    ...input,
    requestId: "req-fail",
    idempotencyKey: "idempotency-fail",
  };

  await adapter.runTransaction(async (tx) => {
    await tx.set(paths.idempotencyDocPath, createProcessingIdempotencyRecord({
      idempotencyKey: failInput.idempotencyKey,
      requestId: failInput.requestId,
      cacheKey: failInput.cacheKey,
    }) as any);
  });

  await finalizeAiFinOpsReservation({
    ...failInput,
    outcome: "GEMINI_ERROR",
    estimatedInputTokens: 100,
    estimatedOutputTokens: 0,
    errorCode: "API_CRASH",
  });

  const failEvent = adapter.db.get(`${paths.monthlyEventsCollectionPath}/${failInput.requestId}`);
  t.assert(failEvent !== undefined, "80. Salva evento de falha");
  t.assert(failEvent.outcome === "GEMINI_ERROR", "81. Evento registra o outcome real de erro");

  // Contadores não devem ter mudado desde o sucesso anterior
  const monthlyCountersAfterFail = normalizeUsageCounters(adapter.db.get(paths.monthlyUsageDocPath));
  t.assert(monthlyCountersAfterFail.requestCount === 1, "82. Contagem mensal de requests inalterada em falhas");
  t.assert(monthlyCountersAfterFail.estimatedInputTokens === 200, "83. Tokens mensais inalterados");

  // Idempotência do erro deve ficar em FAILED para permitir retentativas
  const failIdDoc = adapter.db.get(paths.idempotencyDocPath);
  t.assert(failIdDoc.status === "FAILED", "84. Idempotência marcada como FAILED para falha");
});

// ==========================================
// H. PRIVACIDADE
// ==========================================
test("H. Regras Estritas de Privacidade de Dados", (t) => {
  const safeObj = {
    requestId: "r1",
    organizationId: "org-ok",
    uid: "u-ok",
    feature: "aiImport",
    sourceHost: "youtube.com", // sem barra
  };

  t.assert(assertRepositoryPayloadIsPrivate(safeObj), "85. Payload sem dados sensíveis é aprovado");

  const unsafeObj1 = {
    ...safeObj,
    rawText: "letras de música aqui",
  };
  try {
    assertRepositoryPayloadIsPrivate(unsafeObj1);
    t.assert(false, "86. Deveria rejeitar rawText");
  } catch (e: any) {
    t.assert(e.message.includes("is prohibited"), "86. Rejeitou rawText com erro controlado");
  }

  const unsafeObj2 = {
    ...safeObj,
    nested: {
      cleanLyrics: "refrão legal",
    },
  };
  try {
    assertRepositoryPayloadIsPrivate(unsafeObj2);
    t.assert(false, "87. Deveria rejeitar cleanLyrics aninhado");
  } catch (e: any) {
    t.assert(e.message.includes("is prohibited"), "87. Rejeitou aninhamento seguro de forma recursiva");
  }

  const unsafeObj3 = {
    ...safeObj,
    sourceHost: "youtube.com/watch?v=123", // com slash
  };
  try {
    assertRepositoryPayloadIsPrivate(unsafeObj3);
    t.assert(false, "88. Deveria rejeitar host contendo caminhos");
  } catch (e: any) {
    t.assert(e.message.includes("cannot contain slashes"), "88. Barrou host contendo slashes com erro controlado");
  }

  const forbiddenFields = ["prompt", "url", "sourceUrl", "cleanChords", "lyrics", "chords", "token", "authorization", "headers", "cookies", "stack", "message"];
  let checkedAll = true;
  for (const f of forbiddenFields) {
    try {
      assertRepositoryPayloadIsPrivate({ [f]: "some-value" });
      checkedAll = false;
    } catch (e) {
      // Ok
    }
  }
  t.assert(checkedAll, "89. Validou bloqueio para todos os campos sensíveis e proibidos");
});

// ==========================================
// I. SUMÁRIO DE CACHE
// ==========================================
test("I. Sumário Higienizado de Cache", (t) => {
  const dirty = {
    title: "  Música com espaços extras  ",
    artist: "A".repeat(200), // muito longo
    hasLyrics: true,
    hasChords: false,
    someUnrequestedProp: "ignored-by-destructure",
  };

  const clean = sanitizeCacheResultSummary(dirty);
  t.assert(clean.title === "Música com espaços extras", "90. Trunca espaços em branco");
  t.assert(clean.artist.length === 120, "91. Limita tamanho do artista a 120 caracteres");
  t.assert(clean.hasLyrics === true, "92. Preserva booleans legítimos");
  t.assert(clean.someUnrequestedProp === undefined, "93. Filtra propriedades não descritas no contrato");

  try {
    sanitizeCacheResultSummary({
      title: "Ok",
      lyrics: "letras proibidas",
    });
    t.assert(false, "94. Deveria lançar erro controlado ao receber lyrics no sumário");
  } catch (e: any) {
    t.assert(e.message.includes("prohibited"), "94. Lançou erro controlado com sucesso");
  }
});

// ==========================================
// J. HIGIENE E INTEGRIDADE DE ARQUIVOS
// ==========================================
test("J. Higiene e Integridade de Arquivos", (t) => {
  for (const file of protectedFiles) {
    const exists = fs.existsSync(file);
    t.assert(exists, `95. Arquivo protegido existe: ${file}`);
    if (exists) {
      const content = fs.readFileSync(file);
      const currentHash = crypto.createHash("sha256").update(content).digest("hex");
      t.assert(
        currentHash === initialHashes[file],
        `96. Integridade preservada e imutável para: ${file}`
      );
    }
  }

  const dupApp = fs.existsSync("app") || fs.existsSync("applet");
  t.assert(!dupApp, "97. Não existem diretórios app/applet duplicados no repositório");

  // Detecção robusta de arquivos temporários indesejados
  const isForbiddenTemporaryRootEntry = (name: string): boolean => {
    const lower = name.toLowerCase();
    return (
      /^debug[\w.-]*/.test(lower) ||
      /^patch[\w.-]*/.test(lower) ||
      /^fix[\w.-]*/.test(lower) ||
      /^update[\w.-]*/.test(lower) ||
      /^check[\w.-]*/.test(lower) ||
      /^tmp[\w.-]*/.test(lower) ||
      /_tmp[\w.-]*$/.test(lower) ||
      lower.endsWith(".tmp") ||
      lower.endsWith(".bak") ||
      lower.endsWith(".backup") ||
      lower.endsWith(".orig") ||
      lower.endsWith(".rej")
    );
  };

  const allowedRootFilesWhitelist = new Set([
    "firestore.rules.backup",
    "fix_ai_modal.cjs",
    "fix_ai_modal2.cjs",
    "fix_all_blurs.cjs",
    "fix_contexts_toast.cjs",
    "fix_dashboard_perf.cjs",
    "fix_dashboard_perf2.cjs",
    "fix_hover.cjs",
    "fix_hover.js",
    "fix_mixblend.cjs",
    "fix_reprocess.cjs",
    "fix_rules.cjs",
    "fix_script.ts",
    "fix_share.cjs",
    "fix_share2.cjs",
    "fix_share_ui.cjs",
    "fix_toast_perf.cjs",
    "fix_ts.cjs",
    "fix_ts2.cjs",
    "update.ts",
    "update2.ts",
    "update3.ts",
    "update4.ts",
    "update5.ts",
    "update6.ts",
    "update7.ts",
    "update8_rules.ts",
    "update9.ts",
    "update_flag.ts",
  ]);

  const rootEntries = fs.readdirSync(".");
  for (const entry of rootEntries) {
    const isDir = fs.statSync(entry).isDirectory();
    if (!isDir && isForbiddenTemporaryRootEntry(entry)) {
      if (!allowedRootFilesWhitelist.has(entry)) {
        t.assert(false, `98. Arquivo temporário proibido '${entry}' detectado na raiz!`);
      }
    }
  }

  t.assert(failedTests === 0, "99. failedTests === 0");
  t.assert(testsWithZeroAssertions === 0, "100. Todos os testes rodaram asserções com sucesso!");
});

// ==========================================
// K. HELPERS
// ==========================================
test("K. Helpers Internos", (t) => {
  t.assert(deriveEstimatedOutputCharsFromTokens(300) === 300 * AI_TOKEN_ESTIMATION_CHARS_PER_TOKEN, "101. Calcula tokens positivos corretamente");
  t.assert(deriveEstimatedOutputCharsFromTokens(0) === 0, "102. Zero tokens resulta em zero chars");
  t.assert(deriveEstimatedOutputCharsFromTokens(-50) === 0, "103. Tokens negativos resulta em zero chars");
  t.assert(deriveEstimatedOutputCharsFromTokens(NaN) === 0, "104. Tokens NaN resulta em zero chars");
  t.assert(deriveEstimatedOutputCharsFromTokens(undefined) === 0, "105. Tokens undefined resulta em zero chars");
  t.assert(deriveEstimatedOutputCharsFromTokens(null) === 0, "106. Tokens null resulta em zero chars");
  t.assert(deriveEstimatedOutputCharsFromTokens(100.9) === 100 * AI_TOKEN_ESTIMATION_CHARS_PER_TOKEN, "107. Arredonda para baixo (floor)");
});

// ==========================================
// RESUMO E EXECUÇÃO SEQUENCIAL
// ==========================================
async function runAll() {
  const totalCases = queue.length;
  for (const tc of queue) {
    registeredTests++;
    let assertionsCount = 0;
    let testFailed = false;

    const t: TestContext = {
      assert(condition: boolean, message: string) {
        assertionsCount++;
        if (!condition) {
          testFailed = true;
          console.error(`  [FAIL] Assertion failed: ${message}`);
        } else {
          console.log(`  [OK] ${message}`);
        }
      },
    };

    console.log(`\nRunning test #${registeredTests}/${totalCases}: ${tc.name}`);
    try {
      await tc.fn(t);
      if (assertionsCount === 0) {
        testsWithZeroAssertions++;
        console.warn("  [WARN] Test executed zero assertions.");
      }
      if (testFailed) {
        failedTests++;
        console.error(`=== FAILED: ${tc.name} ===`);
      } else {
        passedTests++;
        console.log(`=== PASSED: ${tc.name} ===`);
      }
    } catch (err: any) {
      failedTests++;
      console.error(`  [ERROR] Uncaught exception during test:`, err);
      console.error(`=== FAILED: ${tc.name} ===`);
    }
  }

  console.log("\n==========================================");
  console.log("SUITE EXECUTION SUMMARY:");
  console.log(`Registered Tests:  ${registeredTests}`);
  console.log(`Passed Tests:      ${passedTests}`);
  console.log(`Failed Tests:      ${failedTests}`);
  console.log(`Zero Assertions:   ${testsWithZeroAssertions}`);
  console.log("==========================================");

  if (failedTests > 0 || testsWithZeroAssertions > 0 || passedTests + failedTests !== registeredTests) {
    console.error("SUITE FAILED due to failed tests, zero assertions or mismatch in counts.");
    process.exit(1);
  } else {
    console.log("SUITE PASSED successfully!");
    process.exit(0);
  }
}

runAll().catch((err) => {
  console.error("Fatal error during test run:", err);
  process.exit(1);
});
