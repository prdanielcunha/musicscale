import fs from 'fs';
import path from 'path';
import {
  resolveAiImportFinOpsReadPath,
  sanitizeFinOpsReadPathDoc
} from '../services/server/aiImportFinOpsReadPath';
import { AiFinOpsStorageAdapter, AiFinOpsTransactionAdapter, AiFinOpsStoredDocument } from '../services/server/aiFinOpsRepository';

let registeredTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, message: string) {
  registeredTests++;
  if (condition) {
    console.log(`  [OK] ${message}`);
    passedTests++;
  } else {
    console.error(`  [ERRO] ${message}`);
    failedTests++;
  }
}

class FakeAiFinOpsStorageAdapter implements AiFinOpsStorageAdapter {
  public docs: Record<string, AiFinOpsStoredDocument> = {};
  public getCalls = 0;
  public setCalls = 0;
  public createCalls = 0;
  public updateCalls = 0;

  async runTransaction<T>(fn: (tx: AiFinOpsTransactionAdapter) => Promise<T>): Promise<T> {
    const tx: AiFinOpsTransactionAdapter = {
      get: async (path: string) => {
        this.getCalls++;
        return this.docs[path] || null;
      },
      create: async (path: string, data: Record<string, unknown>) => {
        this.createCalls++;
        throw new Error("create not allowed in read-only adapter");
      },
      set: async (path: string, data: Record<string, unknown>, options?: { merge?: boolean }) => {
        this.setCalls++;
        throw new Error("set not allowed in read-only adapter");
      },
      update: async (path: string, data: Record<string, unknown>) => {
        this.updateCalls++;
        throw new Error("update not allowed in read-only adapter");
      }
    };
    return fn(tx);
  }
}

async function runTests() {
  console.log("=== EXECUTANDO TESTES DO READ PATH DO FINOPS DO AI IMPORT ===\\n");

  console.log("Running test: A. Escopo e higiene");
  const readPathModule = path.resolve(process.cwd(), 'services/server/aiImportFinOpsReadPath.ts');
  assert(fs.existsSync(readPathModule), "arquivo services/server/aiImportFinOpsReadPath.ts existe");

  if (fs.existsSync(readPathModule)) {
    const content = fs.readFileSync(readPathModule, 'utf8');
    assert(!content.includes('firebase-admin'), "não importa firebase-admin");
    assert(!content.includes('express'), "não importa express");
    assert(!content.includes('server.ts'), "não importa server.ts");
    assert(!content.includes('GoogleGenAI'), "não importa GoogleGenAI");
    assert(!content.includes(' fetch('), "não usa fetch");
    assert(!content.includes('process.env'), "não usa process.env");
    assert(!content.includes('Date.now'), "não usa Date.now");
    assert(!content.includes('require("crypto")') && !content.includes('import * as crypto'), "não usa crypto direto");
    assert(!content.includes('fs.') && !content.includes('path.'), "não usa fs/path no helper");
    assert(!content.includes('aiFinOpsFirestoreAdapter'), "não importa aiFinOpsFirestoreAdapter");
    assert(!content.includes('beginAiFinOpsReservation'), "não importa beginAiFinOpsReservation");
    assert(!content.includes('finalizeAiFinOpsReservation'), "não importa finalizeAiFinOpsReservation");
  } else {
    assert(false, "não importa firebase-admin");
    assert(false, "não importa express");
    assert(false, "não importa server.ts");
    assert(false, "não importa GoogleGenAI");
    assert(false, "não usa fetch");
    assert(false, "não usa process.env");
    assert(false, "não usa Date.now");
    assert(false, "não usa crypto direto");
    assert(false, "não usa fs/path no helper");
    assert(false, "não importa aiFinOpsFirestoreAdapter");
    assert(false, "não importa beginAiFinOpsReservation");
    assert(false, "não importa finalizeAiFinOpsReservation");
  }

  // Pre-instantiate a fake adapter for tests
  const adapter = new FakeAiFinOpsStorageAdapter();
  const baseInput = {
    adapter,
    organizationId: "org123",
    uid: "uid123",
    model: "gemini-1.5-pro",
    plan: "starter" as any,
    secret: "sec123",
    now: 1000
  };

  console.log("\\nRunning test: B. Key/path generation");
  adapter.getCalls = 0; adapter.setCalls = 0; adapter.createCalls = 0; adapter.updateCalls = 0;
  adapter.docs = {};
  const tB1 = await resolveAiImportFinOpsReadPath({
    ...baseInput,
    rawText: "some random text"
  });
  
  assert(tB1.status === "MISS", "status MISS quando não há docs");
  assert(tB1.sourceType === "rawText", "sourceType rawText");
  assert(tB1.sourceHost === null, "sourceHost null");
  assert(tB1.idempotencyKey?.startsWith("aiimp_") === true, "idempotencyKey começa com aiimp_");
  assert(tB1.cacheKey?.startsWith("aicache_") === true, "cacheKey começa com aicache_");
  assert(tB1.rateLimitBucketKey?.startsWith("airl_") === true, "rateLimitBucketKey começa com airl_");
  assert(tB1.paths?.idempotencyDocPath.includes("org123") === true, "paths contém organizationId no namespace");
  assert(tB1.estimatedInputTokens > 0, "estimatedInputTokens > 0");

  const tB2 = await resolveAiImportFinOpsReadPath({
    ...baseInput,
    url: "https://www.example.com/some/path"
  });
  assert(tB2.sourceType === "url", "sourceType url");
  assert(tB2.sourceHost === "www.example.com" || tB2.sourceHost === "example.com", "sourceHost é hostname seguro em lowercase");
  assert(!!tB2.idempotencyKey, "idempotency/cache keys são geradas");
  assert(tB2.cacheKey !== tB2.idempotencyKey, "chaves diferentes");

  console.log("\\nRunning test: C. Read-only guarantee");
  assert(adapter.getCalls === 4, "tx.get é chamado para cacheDocPath e idempotencyDocPath (duas vezes, 4 gets no total)");
  assert(adapter.setCalls === 0, "tx.set nunca é chamado");
  assert(adapter.createCalls === 0, "tx.create nunca é chamado");
  assert(adapter.updateCalls === 0, "tx.update nunca é chamado");

  console.log("\\nRunning test: D. Cache hit");
  adapter.docs = {
    [tB1.paths!.cacheDocPath]: {
      id: "doc",
      data: { status: "HIT", someData: "safe" }
    }
  };
  const tD1 = await resolveAiImportFinOpsReadPath({
    ...baseInput,
    rawText: "some random text"
  });
  assert(tD1.status === "CACHE_HIT", "status CACHE_HIT");
  assert(tD1.outcome === "CACHE_HIT", "outcome CACHE_HIT");
  assert(tD1.shouldConsumeQuota === false, "shouldConsumeQuota false");
  assert(!!tD1.cacheDoc && tD1.cacheDoc.someData === "safe", "cacheDoc retornado");

  console.log("\\nRunning test: E. Idempotency completed");
  adapter.docs = {
    [tB1.paths!.idempotencyDocPath]: {
      id: "doc",
      data: { status: "COMPLETED" }
    }
  };
  const tE1 = await resolveAiImportFinOpsReadPath({
    ...baseInput,
    rawText: "some random text"
  });
  assert(tE1.status === "IDEMPOTENCY_COMPLETED", "status IDEMPOTENCY_COMPLETED");
  assert(tE1.outcome === "IDEMPOTENCY_HIT", "outcome IDEMPOTENCY_HIT");
  assert(tE1.shouldConsumeQuota === false, "shouldConsumeQuota false");

  console.log("\\nRunning test: F. Idempotency processing");
  adapter.docs = {
    [tB1.paths!.idempotencyDocPath]: {
      id: "doc",
      data: { status: "PROCESSING" }
    }
  };
  const tF1 = await resolveAiImportFinOpsReadPath({
    ...baseInput,
    rawText: "some random text"
  });
  assert(tF1.status === "IDEMPOTENCY_PROCESSING", "status IDEMPOTENCY_PROCESSING");
  assert(tF1.outcome === "IDEMPOTENCY_HIT", "outcome IDEMPOTENCY_HIT");
  assert(tF1.shouldConsumeQuota === false, "shouldConsumeQuota false");

  console.log("\\nRunning test: G. Validação controlada");
  const tG1 = await resolveAiImportFinOpsReadPath({ ...baseInput, organizationId: "" });
  assert(tG1.status === "DISABLED_OR_INVALID", "organizationId vazio -> DISABLED_OR_INVALID");
  assert(tG1.shouldConsumeQuota === false, "shouldConsumeQuota false");
  assert(tG1.safeErrorCode === "INVALID_PARAMETERS", "safeErrorCode seguro");

  const tG2 = await resolveAiImportFinOpsReadPath({ ...baseInput, uid: "" });
  assert(tG2.status === "DISABLED_OR_INVALID", "uid vazio -> DISABLED_OR_INVALID");

  const tG3 = await resolveAiImportFinOpsReadPath({ ...baseInput, model: "" });
  assert(tG3.status === "DISABLED_OR_INVALID", "model vazio -> DISABLED_OR_INVALID");

  const tG4 = await resolveAiImportFinOpsReadPath({ ...baseInput, secret: "" });
  assert(tG4.status === "DISABLED_OR_INVALID", "secret vazio -> DISABLED_OR_INVALID");

  const tG5 = await resolveAiImportFinOpsReadPath({ ...baseInput, organizationId: "a/b" });
  assert(tG5.status === "DISABLED_OR_INVALID", "organizationId com / -> DISABLED_OR_INVALID");

  console.log("\\nRunning test: H. Privacidade");
  const dirtyDoc = {
    status: "COMPLETED",
    rawText: "secret",
    prompt: "secret",
    url: "secret",
    sourceUrl: "secret",
    lyrics: "secret",
    chords: "secret",
    cleanLyrics: "secret",
    cleanChords: "secret",
    headers: "secret",
    cookies: "secret",
    authorization: "secret",
    token: "secret",
    stack: "secret",
    message: "secret",
    nested: {
      rawText: "secret nested",
      safe: "data"
    }
  };
  
  const sanitized = sanitizeFinOpsReadPathDoc(dirtyDoc);
  assert(!!sanitized, "sanitized is not null");
  if (sanitized) {
    assert(sanitized.rawText === undefined, "rawText removido");
    assert(sanitized.prompt === undefined, "prompt removido");
    assert(sanitized.url === undefined, "url removido");
    assert(sanitized.sourceUrl === undefined, "sourceUrl removido");
    assert(sanitized.lyrics === undefined, "lyrics removido");
    assert(sanitized.chords === undefined, "chords removido");
    assert(sanitized.cleanLyrics === undefined, "cleanLyrics removido");
    assert(sanitized.cleanChords === undefined, "cleanChords removido");
    assert(sanitized.headers === undefined, "headers removido");
    assert(sanitized.cookies === undefined, "cookies removido");
    assert(sanitized.authorization === undefined, "authorization removido");
    assert(sanitized.token === undefined, "token removido");
    assert(sanitized.stack === undefined, "stack removido");
    assert(sanitized.message === undefined, "message removido");
    assert((sanitized.nested as any)?.rawText === undefined, "nested rawText removido");
    assert((sanitized.nested as any)?.safe === "data", "nested safe field preservado");
  } else {
    assert(false, "rawText removido");
    assert(false, "prompt removido");
    assert(false, "url removido");
    assert(false, "sourceUrl removido");
    assert(false, "lyrics removido");
    assert(false, "chords removido");
    assert(false, "cleanLyrics removido");
    assert(false, "cleanChords removido");
    assert(false, "headers removido");
    assert(false, "cookies removido");
    assert(false, "authorization removido");
    assert(false, "token removido");
    assert(false, "stack removido");
    assert(false, "message removido");
    assert(false, "nested rawText removido");
    assert(false, "nested safe field preservado");
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

  if (failedTests > 0 || passedTests !== registeredTests || passedTests === 0) {
    console.error("SUITE FAILED.");
    process.exit(1);
  } else {
    console.log("SUITE PASSED successfully!");
    process.exit(0);
  }
}

runTests().catch(e => {
  console.error("Unhandled exception:", e);
  process.exit(1);
});
