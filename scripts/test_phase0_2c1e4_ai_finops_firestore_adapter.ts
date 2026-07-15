import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

import {
  AiFinOpsFirestoreLike,
  AiFinOpsFirestoreTransactionLike,
  AiFinOpsFirestoreDocumentReferenceLike,
  AiFinOpsFirestoreDocumentSnapshotLike,
  assertValidFirestorePath,
  assertPlainObjectData,
  createAiFinOpsFirestoreAdapter
} from '../services/server/aiFinOpsFirestoreAdapter';

import {
  beginAiFinOpsReservation,
  finalizeAiFinOpsReservation,
  AI_FINOPS_REPOSITORY_ERRORS
} from '../services/server/aiFinOpsRepository';

import { buildAiFirestorePaths } from '../services/server/aiFinOpsPolicy';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log("=== EXECUTANDO TESTES DO ADAPTER FIRESTORE ADMIN ISOLADO ===");

let passedTests = 0;
let failedTests = 0;
const registeredTests = 30;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  [OK] ${message}`);
    passedTests++;
  } else {
    console.error(`  [ERRO] ${message}`);
    failedTests++;
  }
}

// ---------------------------------------------------------
// FAKE FIRESTORE ADMIN STRUCTURAL
// ---------------------------------------------------------

class FakeDocumentReference implements AiFinOpsFirestoreDocumentReferenceLike {
  constructor(public id: string, public path: string) {}
}

class FakeDocumentSnapshot implements AiFinOpsFirestoreDocumentSnapshotLike {
  constructor(public exists: boolean, private _data: any) {}
  data() {
    return this._data;
  }
}

class FakeFirestore implements AiFinOpsFirestoreLike {
  public db: Map<string, any> = new Map();

  doc(pathStr: string): AiFinOpsFirestoreDocumentReferenceLike {
    const parts = pathStr.split('/');
    return new FakeDocumentReference(parts[parts.length - 1], pathStr);
  }

  async runTransaction<T>(updateFunction: (transaction: AiFinOpsFirestoreTransactionLike) => Promise<T>): Promise<T> {
    const txWrites: Array<() => void> = [];

    const tx: AiFinOpsFirestoreTransactionLike = {
      get: async (ref) => {
        const data = this.db.get(ref.path);
        return new FakeDocumentSnapshot(data !== undefined, data);
      },
      set: (ref, data, options) => {
        txWrites.push(() => {
          if (options?.merge) {
            const existing = this.db.get(ref.path) || {};
            this.db.set(ref.path, { ...existing, ...data });
          } else {
            this.db.set(ref.path, data);
          }
        });
        return tx;
      },
      create: (ref, data) => {
        if (this.db.has(ref.path)) {
          const err = new Error("ALREADY_EXISTS");
          (err as any).code = 6;
          throw err; // Simulate synchronous conflict
        }
        txWrites.push(() => {
          if (this.db.has(ref.path)) {
            const err = new Error("ALREADY_EXISTS");
            (err as any).code = 6;
            throw err;
          }
          this.db.set(ref.path, data);
        });
        return tx;
      },
      update: (ref, data) => {
        if (!this.db.has(ref.path)) {
          throw new Error("NOT_FOUND");
        }
        txWrites.push(() => {
          if (!this.db.has(ref.path)) throw new Error("NOT_FOUND");
          const existing = this.db.get(ref.path);
          this.db.set(ref.path, { ...existing, ...data });
        });
        return tx;
      }
    };

    try {
      const result = await updateFunction(tx);
      // commit
      txWrites.forEach(write => write());
      return result;
    } catch (e: any) {
      if (e.message?.includes("ALREADY_EXISTS")) {
        throw new Error(AI_FINOPS_REPOSITORY_ERRORS.IDEMPOTENCY_CONFLICT);
      }
      throw e;
    }
  }
}

// ---------------------------------------------------------
// TEST RUNNER
// ---------------------------------------------------------

async function runTests() {
  try {
    console.log("\\nRunning test: A. Escopo e higiene");
    const adapterPath = path.resolve(__dirname, '../services/server/aiFinOpsFirestoreAdapter.ts');
    assert(fs.existsSync(adapterPath), "Arquivo services/server/aiFinOpsFirestoreAdapter.ts existe");
    
    const adapterContent = fs.readFileSync(adapterPath, 'utf8');
    assert(!adapterContent.includes('firebase-admin'), "Não importa firebase-admin");
    assert(!adapterContent.includes('server.ts'), "Não importa server.ts");
    assert(!adapterContent.includes('express'), "Não importa express");
    assert(!adapterContent.includes('GoogleGenAI'), "Não importa GoogleGenAI");
    assert(!adapterContent.includes('fetch'), "Não usa fetch");
    assert(!adapterContent.includes('FieldValue.increment'), "Não usa FieldValue.increment");

    console.log("\\nRunning test: B. Path validation");
    assert(assertValidFirestorePath("organizations/org1/aiUsage/2026-07") === "organizations/org1/aiUsage/2026-07", "Aceita path válido");
    try { assertValidFirestorePath(""); assert(false, "Falhou em rejeitar string vazia"); } catch (e: any) { assert(e.message.includes("INVALID_PATH"), "Rejeita string vazia"); }
    try { assertValidFirestorePath("/test"); assert(false, "Falhou em rejeitar path começando com /"); } catch (e: any) { assert(e.message.includes("INVALID_PATH"), "Rejeita path começando com /"); }
    try { assertValidFirestorePath("test/"); assert(false, "Falhou em rejeitar path terminando com /"); } catch (e: any) { assert(e.message.includes("INVALID_PATH"), "Rejeita path terminando com /"); }
    try { assertValidFirestorePath("test//path"); assert(false, "Falhou em rejeitar path com //"); } catch (e: any) { assert(e.message.includes("INVALID_PATH"), "Rejeita path com //"); }

    console.log("\\nRunning test: C. Basic adapter operations");
    const fakeDb = new FakeFirestore();
    const adapter = createAiFinOpsFirestoreAdapter(fakeDb);

    await adapter.runTransaction(async (tx) => {
      const doc = await tx.get("missing/doc");
      assert(doc === null, "get em documento inexistente retorna null");
      
      tx.create("some/doc", { a: 1 });
    });
    
    await adapter.runTransaction(async (tx) => {
      const doc = await tx.get("some/doc");
      assert(doc !== null && doc.a === 1, "get depois de create retorna data");
      
      try {
        tx.create("some/doc", { b: 2 });
      } catch (e: any) {
        assert(e.message === AI_FINOPS_REPOSITORY_ERRORS.IDEMPOTENCY_CONFLICT, "create duplicado falha com erro controlado (sync)");
      }
    });

    try {
      await adapter.runTransaction(async (tx) => {
        tx.create("some/doc", { b: 2 }); // if it doesn't throw sync, it throws async
      });
    } catch (e: any) {
      assert(e.message === AI_FINOPS_REPOSITORY_ERRORS.IDEMPOTENCY_CONFLICT, "create duplicado falha com erro controlado (async/commit)");
    }

    await adapter.runTransaction(async (tx) => {
      tx.set("some/doc2", { a: 1 });
    });
    await adapter.runTransaction(async (tx) => {
      tx.set("some/doc2", { b: 2 }); // no merge
    });
    assert(fakeDb.db.get("some/doc2").a === undefined && fakeDb.db.get("some/doc2").b === 2, "set sem merge substitui documento");

    await adapter.runTransaction(async (tx) => {
      tx.set("some/doc2", { c: 3 }, { merge: true });
    });
    assert(fakeDb.db.get("some/doc2").b === 2 && fakeDb.db.get("some/doc2").c === 3, "set com merge preserva campos anteriores e altera os novos");

    await adapter.runTransaction(async (tx) => {
      tx.update("some/doc2", { b: 4 });
    });
    assert(fakeDb.db.get("some/doc2").b === 4, "update altera documento existente");

    try {
      await adapter.runTransaction(async (tx) => {
        await tx.update("missing/update", { a: 1 });
      });
      assert(false, "Update missing should fail");
    } catch (e) {
      assert(true, "update em inexistente falha");
    }

    assert(fakeDb.db.has("some/doc2"), "operações registram paths corretos no fake");

    console.log("\\nRunning test: D. Integração com aiFinOpsRepository");
    
    const paths = buildAiFirestorePaths({
      organizationId: "org-xyz",
      periodKeys: { monthKey: "2026-07", dayKey: "2026-07-06" },
      idempotencyKey: "idem-abc",
      cacheKey: "cache-def",
      rateLimitBucketKey: "rl-org-xyz"
    });

    const input = {
      adapter,
      paths,
      requestId: "req-123",
      organizationId: "org-xyz",
      uid: "user-123",
      idempotencyKey: "idem-abc",
      cacheKey: "cache-def",
      sourceType: "rawText" as const,
      model: "gemini-3.5-flash",
      plan: "pro" as const,
      inputChars: 400,
    };

    const beginResult = await beginAiFinOpsReservation(input);

    assert(beginResult.status === "RESERVED", "begin retorna RESERVED");
    assert(fakeDb.db.get(paths.idempotencyDocPath)?.status === "PROCESSING", "idempotency doc é criado como PROCESSING");

    await finalizeAiFinOpsReservation({
      ...input,
      outcome: "SUCCESS",
      estimatedInputTokens: 100,
      estimatedOutputTokens: 200,
      durationMs: 1500,
      cacheSummary: { result: "ok" }
    });

    const event = fakeDb.db.get(`${paths.monthlyEventsCollectionPath}/req-123`);
    assert(event?.requestId === "req-123", "evento contém requestId correto");
    assert(event?.organizationId === "org-xyz", "evento contém organizationId correto");
    assert(event?.uid === "user-123", "evento contém uid correto");
    assert(event?.outcome === "SUCCESS", "evento contém outcome SUCCESS");
    assert(event?.estimatedInputTokens === 100, "evento contém estimatedInputTokens correto");
    assert(event?.estimatedOutputTokens === 200, "evento contém estimatedOutputTokens correto");
    assert(event?.outputChars > 0, "evento contém outputChars > 0");

    const monthly = fakeDb.db.get(paths.monthlyUsageDocPath);
    assert(monthly?.requestCount === 1, "monthly counters são incrementados corretamente");
    const daily = fakeDb.db.get(paths.dailyUsageDocPath);
    assert(daily?.requestCount === 1, "daily counters são incrementados corretamente");

    assert(fakeDb.db.get(paths.idempotencyDocPath)?.status === "COMPLETED", "idempotency doc fica COMPLETED");
    assert(fakeDb.db.get(paths.cacheDocPath) !== undefined, "cache doc é criado quando cacheSummary seguro é fornecido");

    console.log("\\nRunning test: E. Privacidade");
    let privacyViolated = false;
    const forbiddenKeys = [
      "rawText", "prompt", "url", "sourceUrl", "cleanLyrics", "cleanChords", 
      "lyrics", "chords", "token", "authorization", "headers", "cookies", "stack", "message"
    ];

    function checkPrivacy(obj: any) {
      if (!obj || typeof obj !== 'object') return;
      for (const key of Object.keys(obj)) {
        if (forbiddenKeys.includes(key)) {
          privacyViolated = true;
          console.error(`  [ERRO] Privacidade violada! Chave proibida encontrada: ${key}`);
        }
        checkPrivacy(obj[key]);
      }
    }

    for (const data of fakeDb.db.values()) {
      checkPrivacy(data);
    }
    
    assert(!privacyViolated, "nenhum documento persistido pelo fluxo contém as chaves proibidas");

  } catch (e: any) {
    console.error("ERRO FATAL NA EXECUÇÃO DOS TESTES:", e.stack || e.message);
    failedTests++;
  }

  console.log("\\n=============================================");
  console.log("SUITE EXECUTION SUMMARY:");
  let zeroAsserts = 'NO';
  if (passedTests === 0) zeroAsserts = 'YES';

  console.log(`Registered Tests:  ${registeredTests}`);
  console.log(`Passed Tests:      ${passedTests}`);
  console.log(`Failed Tests:      ${failedTests}`);
  console.log(`Zero Assertions:   ${zeroAsserts}`);
  console.log("==========================================");

  if (failedTests > 0) {
    console.error("SUITE FAILED.");
    process.exit(1);
  } else {
    console.log("SUITE PASSED successfully!");
    process.exit(0);
  }
}

runTests();
