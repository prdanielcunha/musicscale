import fs from "fs";
import { 
  beginAiImportFinOpsWritePath, 
  finalizeAiImportFinOpsWritePath, 
  estimateAiImportOutputTokens 
} from "../services/server/aiImportFinOpsWritePath";

let registeredTests = 0;
let passedTests = 0;
let failedTests = 0;
let zeroAssertions = 0;

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`  [FAIL] ${message}`);
    failedTests++;
  } else {
    console.log(`  [OK] ${message}`);
  }
}

const forbiddenKeys = [
  "rawText",
  "url",
  "sourceUrl",
  "lyrics",
  "chords",
  "cleanLyrics",
  "cleanChords",
  "prompt",
  "headers",
  "cookies",
  "authorization",
  "token",
  "secret",
  "stack",
  "message"
];

function assertNoForbiddenKeys(value: any, keys: string[] = forbiddenKeys, path: string = "") {
  if (value === null || value === undefined) return;
  if (typeof value === "object") {
    for (const key of Object.keys(value)) {
      if (keys.includes(key)) {
        assert(false, `Forbidden key found at: ${path}${key}`);
      }
      assertNoForbiddenKeys(value[key], keys, `${path}${key}.`);
    }
  }
}

class FakeFirestoreAdapter {
  db: Record<string, any> = {};

  async runTransaction<T>(fn: (tx: any) => Promise<T>): Promise<T> {
    const tx = {
      get: async (path: string) => {
        if (!this.db[path]) return null;
        const val = JSON.parse(JSON.stringify(this.db[path]));
        const dataCopy = JSON.parse(JSON.stringify(val));
        val.data = dataCopy;
        return val;
      },
      create: async (path: string, data: any) => {
        if (this.db[path]) {
          throw new Error(`Document already exists at ${path}`);
        }
        this.db[path] = JSON.parse(JSON.stringify(data));
      },
      set: async (path: string, data: any, options?: { merge?: boolean }) => {
        if (options?.merge && this.db[path]) {
          this.db[path] = { ...this.db[path], ...JSON.parse(JSON.stringify(data)) };
        } else {
          this.db[path] = JSON.parse(JSON.stringify(data));
        }
      },
      update: async (path: string, data: any) => {
        if (!this.db[path]) {
          throw new Error(`Document does not exist at ${path}`);
        }
        this.db[path] = { ...this.db[path], ...JSON.parse(JSON.stringify(data)) };
      }
    };
    return fn(tx);
  }
}

async function runTests() {
  console.log("=== RUNNING TEST: 0.2C.1E.8 FinOps Write-Path ===");

  // Scenario 0: Gate check and local hygiene
  console.log("\nScenario 0: Gate check and local hygiene");
  registeredTests++;
  let s0Assertions = 0;
  const runS0Assert = (cond: boolean, msg: string) => {
    s0Assertions++;
    assert(cond, msg);
  };

  const file1 = fs.existsSync("run_test.js");
  const file2 = fs.existsSync("run_test2.js");
  const file3 = fs.existsSync("scripts/test_gate_check.ts");

  runS0Assert(!file1, "run_test.js does not exist");
  runS0Assert(!file2, "run_test2.js does not exist");
  runS0Assert(!file3, "scripts/test_gate_check.ts does not exist");

  const helperContentCheck = fs.readFileSync("services/server/aiImportFinOpsWritePath.ts", "utf8");
  runS0Assert(!helperContentCheck.includes("firebase-admin"), "Does not import firebase-admin");
  runS0Assert(!helperContentCheck.includes("express"), "Does not import express");
  runS0Assert(!helperContentCheck.includes("import * as server"), "Does not import server.ts");

  if (s0Assertions > 0) passedTests++;

  // Scenario 1: Begin invalid
  console.log("\nScenario 1: Begin invalid");
  registeredTests++;
  let s1Assertions = 0;
  const runS1Assert = (cond: boolean, msg: string) => {
    s1Assertions++;
    assert(cond, msg);
  };

  const adapter = new FakeFirestoreAdapter();

  const r1 = await beginAiImportFinOpsWritePath({
    adapter: null as any,
    requestId: "req1",
    organizationId: "org1",
    uid: "uid1",
    model: "model",
    plan: "pro",
    secret: "secret"
  });
  runS1Assert(r1.status === "DISABLED_OR_INVALID" || r1.status === "ERROR", "adapter null returns disabled/error");
  runS1Assert(r1.context === null, "adapter null context is null");
  assertNoForbiddenKeys(r1, forbiddenKeys, "r1.");

  const r2 = await beginAiImportFinOpsWritePath({
    adapter,
    requestId: "",
    organizationId: "org1",
    uid: "uid1",
    model: "model",
    plan: "pro",
    secret: "secret"
  });
  runS1Assert(r2.status === "DISABLED_OR_INVALID", "empty requestId returns DISABLED_OR_INVALID");
  runS1Assert(r2.context === null, "empty requestId context is null");
  assertNoForbiddenKeys(r2, forbiddenKeys, "r2.");

  const r3 = await beginAiImportFinOpsWritePath({
    adapter,
    requestId: "req1",
    organizationId: "",
    uid: "uid1",
    model: "model",
    plan: "pro",
    secret: "secret"
  });
  runS1Assert(r3.status === "DISABLED_OR_INVALID", "empty organizationId returns DISABLED_OR_INVALID");
  runS1Assert(r3.context === null, "empty organizationId context is null");
  assertNoForbiddenKeys(r3, forbiddenKeys, "r3.");

  const r4 = await beginAiImportFinOpsWritePath({
    adapter,
    requestId: "req1",
    organizationId: "org/invalid",
    uid: "uid1",
    model: "model",
    plan: "pro",
    secret: "secret"
  });
  runS1Assert(r4.status === "DISABLED_OR_INVALID", "organizationId with '/' returns DISABLED_OR_INVALID");
  runS1Assert(r4.context === null, "organizationId with '/' context is null");
  assertNoForbiddenKeys(r4, forbiddenKeys, "r4.");

  const r5 = await beginAiImportFinOpsWritePath({
    adapter,
    requestId: "req1",
    organizationId: "org1",
    uid: "",
    model: "model",
    plan: "pro",
    secret: "secret"
  });
  runS1Assert(r5.status === "DISABLED_OR_INVALID", "empty uid returns DISABLED_OR_INVALID");
  runS1Assert(r5.context === null, "empty uid context is null");
  assertNoForbiddenKeys(r5, forbiddenKeys, "r5.");

  const r6 = await beginAiImportFinOpsWritePath({
    adapter,
    requestId: "req1",
    organizationId: "org1",
    uid: "uid1",
    model: "",
    plan: "pro",
    secret: "secret"
  });
  runS1Assert(r6.status === "DISABLED_OR_INVALID", "empty model returns DISABLED_OR_INVALID");
  runS1Assert(r6.context === null, "empty model context is null");
  assertNoForbiddenKeys(r6, forbiddenKeys, "r6.");

  const r7 = await beginAiImportFinOpsWritePath({
    adapter,
    requestId: "req1",
    organizationId: "org1",
    uid: "uid1",
    model: "model",
    plan: "pro",
    secret: ""
  });
  runS1Assert(r7.status === "DISABLED_OR_INVALID", "empty secret returns DISABLED_OR_INVALID");
  runS1Assert(r7.context === null, "empty secret context is null");
  assertNoForbiddenKeys(r7, forbiddenKeys, "r7.");

  if (s1Assertions > 0) passedTests++;

  // Scenario 2: Begin MISS -> RESERVED
  console.log("\nScenario 2: Begin MISS -> RESERVED");
  registeredTests++;
  let s2Assertions = 0;
  const runS2Assert = (cond: boolean, msg: string) => {
    s2Assertions++;
    assert(cond, msg);
  };

  const s2Adapter = new FakeFirestoreAdapter();
  const s2Res = await beginAiImportFinOpsWritePath({
    adapter: s2Adapter,
    requestId: "req2",
    organizationId: "org2",
    uid: "uid2",
    model: "model",
    plan: "pro",
    secret: "secret-key",
    rawText: "some test music text"
  });

  runS2Assert(s2Res.status === "RESERVED", "Begin MISS returns RESERVED");
  runS2Assert(s2Res.context !== null, "context is not null");
  runS2Assert(s2Res.safeSummary.hasPaths === true, "safeSummary.hasPaths === true");
  runS2Assert(s2Res.safeSummary.hasIdempotencyKey === true, "safeSummary.hasIdempotencyKey === true");
  runS2Assert(s2Res.safeSummary.hasCacheKey === true, "safeSummary.hasCacheKey === true");

  const dbKeys2 = Object.keys(s2Adapter.db);
  const idemKey2 = dbKeys2.find(k => k.toLowerCase().includes("idempotency"));
  runS2Assert(!!idemKey2, "idempotency doc created");
  if (idemKey2) {
    runS2Assert(s2Adapter.db[idemKey2].status === "PROCESSING", "idempotency doc is in PROCESSING status");
  }

  const monthlyUsageKeys2 = dbKeys2.filter(k => k.match(/aiUsage\/\d{4}-\d{2}$/));
  const dailyUsageKeys2 = dbKeys2.filter(k => k.match(/aiDailyUsage\/\d{4}-\d{2}-\d{2}$/));
  const eventKeys2 = dbKeys2.filter(k => k.toLowerCase().includes("events/"));

  runS2Assert(monthlyUsageKeys2.length === 0, "No monthly usage incremented yet");
  runS2Assert(dailyUsageKeys2.length === 0, "No daily usage incremented yet");
  runS2Assert(eventKeys2.length === 0, "No event created yet");

  assertNoForbiddenKeys(s2Res, forbiddenKeys, "s2Res.");

  if (s2Assertions > 0) passedTests++;

  // Scenario 3: Begin with existing idempotency PROCESSING
  console.log("\nScenario 3: Begin with existing idempotency PROCESSING");
  registeredTests++;
  let s3Assertions = 0;
  const runS3Assert = (cond: boolean, msg: string) => {
    s3Assertions++;
    assert(cond, msg);
  };

  const s3Adapter = new FakeFirestoreAdapter();
  await beginAiImportFinOpsWritePath({
    adapter: s3Adapter,
    requestId: "req3_first",
    organizationId: "org3",
    uid: "uid3",
    model: "model",
    plan: "pro",
    secret: "secret-key",
    rawText: "some test music text"
  });

  const dbKeys3 = Object.keys(s3Adapter.db);
  const idemKey3 = dbKeys3.find(k => k.toLowerCase().includes("idempotency"))!;
  runS3Assert(!!idemKey3, "retrieved idempotency path correctly");

  const secondRes = await beginAiImportFinOpsWritePath({
    adapter: s3Adapter,
    requestId: "req3_second",
    organizationId: "org3",
    uid: "uid3",
    model: "model",
    plan: "pro",
    secret: "secret-key",
    rawText: "some test music text"
  });

  runS3Assert(secondRes.status === "IDEMPOTENCY_IN_FLIGHT", "returns IDEMPOTENCY_IN_FLIGHT");
  runS3Assert(secondRes.context === null, "context is null");
  runS3Assert(s3Adapter.db[idemKey3].status === "PROCESSING", "Original idempotency status remained PROCESSING");
  
  assertNoForbiddenKeys(secondRes, forbiddenKeys, "secondRes.");

  if (s3Assertions > 0) passedTests++;

  // Scenario 4: Begin with existing idempotency COMPLETED
  console.log("\nScenario 4: Begin with existing idempotency COMPLETED");
  registeredTests++;
  let s4Assertions = 0;
  const runS4Assert = (cond: boolean, msg: string) => {
    s4Assertions++;
    assert(cond, msg);
  };

  const s4Adapter = new FakeFirestoreAdapter();
  await beginAiImportFinOpsWritePath({
    adapter: s4Adapter,
    requestId: "req4_first",
    organizationId: "org4",
    uid: "uid4",
    model: "model",
    plan: "pro",
    secret: "secret-key",
    rawText: "some test music text"
  });

  const dbKeys4 = Object.keys(s4Adapter.db);
  const idemKey4 = dbKeys4.find(k => k.toLowerCase().includes("idempotency"))!;
  
  s4Adapter.db[idemKey4] = {
    ...s4Adapter.db[idemKey4],
    status: "COMPLETED",
    outcome: "SUCCESS"
  };

  const secondRes4 = await beginAiImportFinOpsWritePath({
    adapter: s4Adapter,
    requestId: "req4_second",
    organizationId: "org4",
    uid: "uid4",
    model: "model",
    plan: "pro",
    secret: "secret-key",
    rawText: "some test music text"
  });

  runS4Assert(secondRes4.status === "IDEMPOTENCY_COMPLETED", "returns IDEMPOTENCY_COMPLETED");
  runS4Assert(secondRes4.context === null, "context is null");
  runS4Assert(s4Adapter.db[idemKey4].status === "COMPLETED", "Original idempotency status remained COMPLETED");

  assertNoForbiddenKeys(secondRes4, forbiddenKeys, "secondRes4.");

  if (s4Assertions > 0) passedTests++;

  // Scenario 5: Finalize null context
  console.log("\nScenario 5: Finalize null context");
  registeredTests++;
  let s5Assertions = 0;
  const runS5Assert = (cond: boolean, msg: string) => {
    s5Assertions++;
    assert(cond, msg);
  };

  const fRes = await finalizeAiImportFinOpsWritePath({
    context: null,
    outcome: "SUCCESS"
  });

  runS5Assert(fRes.ok === true, "ok is true");
  runS5Assert(fRes.skipped === true, "skipped is true");
  runS5Assert(fRes.safeSummary.attempted === false, "attempted is false");
  runS5Assert(fRes.safeSummary.finalized === false, "finalized is false");

  assertNoForbiddenKeys(fRes, forbiddenKeys, "fRes.");

  if (s5Assertions > 0) passedTests++;

  // Scenario 6: Finalize SUCCESS
  console.log("\nScenario 6: Finalize SUCCESS");
  registeredTests++;
  let s6Assertions = 0;
  const runS6Assert = (cond: boolean, msg: string) => {
    s6Assertions++;
    assert(cond, msg);
  };

  const s6Adapter = new FakeFirestoreAdapter();
  const bRes6 = await beginAiImportFinOpsWritePath({
    adapter: s6Adapter,
    requestId: "req6",
    organizationId: "org6",
    uid: "uid6",
    model: "model",
    plan: "pro",
    secret: "secret-key",
    rawText: "some test music text"
  });

  const finalizeRes = await finalizeAiImportFinOpsWritePath({
    context: bRes6.context,
    outcome: "SUCCESS",
    estimatedOutputChars: 500,
    cacheSummary: {
      title: "Clean Title",
      artist: "Clean Artist",
      hasLyrics: true,
      hasChords: false
    }
  });

  runS6Assert(finalizeRes.ok === true, "finalize ok === true");
  runS6Assert(finalizeRes.skipped === false, "skipped === false");
  runS6Assert(finalizeRes.safeSummary.estimatedOutputTokens > 0, "estimatedOutputTokens > 0");

  const dbKeys6 = Object.keys(s6Adapter.db);
  const eventDocKey = dbKeys6.find(k => k.includes("events/"));
  runS6Assert(!!eventDocKey, "event doc created");

  const monthlyDocKey = dbKeys6.find(k => k.match(/aiUsage\/\d{4}-\d{2}$/))!;
  runS6Assert(!!monthlyDocKey && s6Adapter.db[monthlyDocKey].requestCount === 1, "monthly counters incremented");

  const dailyDocKey = dbKeys6.find(k => k.match(/aiDailyUsage\/\d{4}-\d{2}-\d{2}$/))!;
  runS6Assert(!!dailyDocKey && s6Adapter.db[dailyDocKey].requestCount === 1, "daily counters incremented");

  const idemKey6 = dbKeys6.find(k => k.toLowerCase().includes("idempotency"))!;
  runS6Assert(s6Adapter.db[idemKey6].status === "COMPLETED", "idempotency is COMPLETED");

  const cacheKey6 = dbKeys6.find(k => k.toLowerCase().includes("cache"))!;
  runS6Assert(!!cacheKey6 && s6Adapter.db[cacheKey6].status === "READY", "cache READY created");

  for (const docKey of dbKeys6) {
    assertNoForbiddenKeys(s6Adapter.db[docKey], forbiddenKeys, `s6Adapter.db[${docKey}].`);
  }

  assertNoForbiddenKeys(finalizeRes, forbiddenKeys, "finalizeRes.");

  if (s6Assertions > 0) passedTests++;

  // Scenario 7: Finalize failure outcome
  console.log("\nScenario 7: Finalize failure outcome");
  registeredTests++;
  let s7Assertions = 0;
  const runS7Assert = (cond: boolean, msg: string) => {
    s7Assertions++;
    assert(cond, msg);
  };

  const s7Adapter = new FakeFirestoreAdapter();
  const bRes7 = await beginAiImportFinOpsWritePath({
    adapter: s7Adapter,
    requestId: "req7",
    organizationId: "org7",
    uid: "uid7",
    model: "model",
    plan: "pro",
    secret: "secret-key",
    rawText: "some test music text"
  });

  const finalizeRes7 = await finalizeAiImportFinOpsWritePath({
    context: bRes7.context,
    outcome: "GEMINI_ERROR",
    errorCode: "Gemini.Invalid.Json"
  });

  runS7Assert(finalizeRes7.ok === true, "finalize is successful for failure scenario");
  runS7Assert(finalizeRes7.safeSummary.safeErrorCode === "GEMINI_INVALID_JSON", "safeErrorCode is correctly mapped/sanitized");

  const dbKeys7 = Object.keys(s7Adapter.db);
  const eventDocKey7 = dbKeys7.find(k => k.includes("events/"));
  runS7Assert(!!eventDocKey7, "event doc created for failure");

  const monthlyDocKey7 = dbKeys7.find(k => k.match(/aiUsage\/\d{4}-\d{2}$/));
  if (monthlyDocKey7) {
    runS7Assert(s7Adapter.db[monthlyDocKey7].requestCount === 0, "monthly counters not incremented on failure");
  }

  const idemKey7 = dbKeys7.find(k => k.toLowerCase().includes("idempotency"))!;
  runS7Assert(s7Adapter.db[idemKey7].status === "FAILED", "idempotency is FAILED");

  const cacheKey7 = dbKeys7.find(k => k.toLowerCase().includes("cache"));
  runS7Assert(!cacheKey7, "cache READY is NOT created on failure");

  for (const docKey of dbKeys7) {
    assertNoForbiddenKeys(s7Adapter.db[docKey], forbiddenKeys, `s7Adapter.db[${docKey}].`);
  }

  assertNoForbiddenKeys(finalizeRes7, forbiddenKeys, "finalizeRes7.");

  if (s7Assertions > 0) passedTests++;

  // Scenario 8: Cache summary privacy
  console.log("\nScenario 8: Cache summary privacy");
  registeredTests++;
  let s8Assertions = 0;
  const runS8Assert = (cond: boolean, msg: string) => {
    s8Assertions++;
    assert(cond, msg);
  };

  const s8Adapter = new FakeFirestoreAdapter();
  const bRes8 = await beginAiImportFinOpsWritePath({
    adapter: s8Adapter,
    requestId: "req8",
    organizationId: "org8",
    uid: "uid8",
    model: "model",
    plan: "pro",
    secret: "secret-key",
    rawText: "some test text"
  });

  await finalizeAiImportFinOpsWritePath({
    context: bRes8.context,
    outcome: "SUCCESS",
    cacheSummary: {
      title: "My Title",
      artist: "My Artist",
      hasLyrics: true,
      hasChords: false,
      rawText: "malicious secret rawText",
      url: "malicious url",
      lyrics: "leak lyrics",
      chords: "leak chords"
    } as any
  });

  const dbKeys8 = Object.keys(s8Adapter.db);
  const cacheKey8 = dbKeys8.find(k => k.toLowerCase().includes("cache"))!;
  const cacheData8 = s8Adapter.db[cacheKey8];

  runS8Assert(cacheData8.resultSummary.title === "My Title", "title preserved");
  runS8Assert(cacheData8.resultSummary.artist === "My Artist", "artist preserved");
  runS8Assert(cacheData8.resultSummary.hasLyrics === true, "hasLyrics preserved");
  runS8Assert(cacheData8.resultSummary.hasChords === false, "hasChords preserved");

  runS8Assert(cacheData8.resultSummary.rawText === undefined, "forbidden rawText is removed");
  runS8Assert(cacheData8.resultSummary.url === undefined, "forbidden url is removed");
  runS8Assert(cacheData8.resultSummary.lyrics === undefined, "forbidden lyrics is removed");
  runS8Assert(cacheData8.resultSummary.chords === undefined, "forbidden chords is removed");

  for (const docKey of dbKeys8) {
    assertNoForbiddenKeys(s8Adapter.db[docKey], forbiddenKeys, `s8Adapter.db[${docKey}].`);
  }

  if (s8Assertions > 0) passedTests++;

  // Scenario 9: Output token estimation
  console.log("\nScenario 9: Output token estimation");
  registeredTests++;
  let s9Assertions = 0;
  const runS9Assert = (cond: boolean, msg: string) => {
    s9Assertions++;
    assert(cond, msg);
  };

  const t1 = estimateAiImportOutputTokens({ estimatedOutputTokens: 100.5 });
  runS9Assert(t1 === 100, "estimatedOutputTokens wins and is floored");

  const t2 = estimateAiImportOutputTokens({ estimatedOutputChars: 400 });
  runS9Assert(t2 === 100, "estimatedOutputChars uses estimateTokensFromChars (400 chars is ~100 tokens)");

  const t3 = estimateAiImportOutputTokens({ estimatedOutputTokens: -5 });
  runS9Assert(t3 === 0, "negative output tokens returns 0");

  const t4 = estimateAiImportOutputTokens({ estimatedOutputChars: -100 });
  runS9Assert(t4 === 0, "negative output chars returns 0");

  const t5 = estimateAiImportOutputTokens({});
  runS9Assert(t5 === 0, "empty object returns 0");

  if (s9Assertions > 0) passedTests++;

  // Scenario 10: inputChars por rawText
  console.log("\nScenario 10: inputChars por rawText");
  registeredTests++;
  let s10Assertions = 0;
  const runS10Assert = (cond: boolean, msg: string) => {
    s10Assertions++;
    assert(cond, msg);
  };

  const s10Adapter = new FakeFirestoreAdapter();
  const rawTextTest = "texto de teste com tamanho conhecido";
  const s10Res = await beginAiImportFinOpsWritePath({
    adapter: s10Adapter,
    requestId: "req10",
    organizationId: "org10",
    uid: "uid10",
    model: "model",
    plan: "pro",
    secret: "secret-key",
    rawText: rawTextTest
  });

  runS10Assert(s10Res.status === "RESERVED", "Begin status is RESERVED");
  runS10Assert(s10Res.context !== null, "context is not null");
  if (s10Res.context) {
    runS10Assert(s10Res.context.repositoryInput.inputChars === rawTextTest.length, "inputChars matches rawText length");
    runS10Assert(s10Res.context.repositoryInput.inputChars > 0, "inputChars is greater than 0");
  }
  assertNoForbiddenKeys(s10Res.safeSummary, forbiddenKeys, "safeSummary.");

  if (s10Assertions > 0) passedTests++;

  // Scenario 11: inputChars por url
  console.log("\nScenario 11: inputChars por url");
  registeredTests++;
  let s11Assertions = 0;
  const runS11Assert = (cond: boolean, msg: string) => {
    s11Assertions++;
    assert(cond, msg);
  };

  const s11Adapter = new FakeFirestoreAdapter();
  const testUrl = "https://example.com/cifra/teste";
  const s11Res = await beginAiImportFinOpsWritePath({
    adapter: s11Adapter,
    requestId: "req11",
    organizationId: "org11",
    uid: "uid11",
    model: "model",
    plan: "pro",
    secret: "secret-key",
    url: testUrl
  });

  runS11Assert(s11Res.status === "RESERVED", "status is RESERVED");
  runS11Assert(s11Res.context !== null, "context is not null");
  if (s11Res.context) {
    runS11Assert(s11Res.context.repositoryInput.inputChars === testUrl.length, "inputChars matches url length");
    runS11Assert(s11Res.context.sourceType === "url", "sourceType is url");
    runS11Assert(s11Res.context.sourceHost === "example.com", "sourceHost is example.com");
  }
  assertNoForbiddenKeys(s11Res.safeSummary, forbiddenKeys, "safeSummary.");

  if (s11Assertions > 0) passedTests++;

  // Scenario 12: estimatedInputChars vence rawText/url
  console.log("\nScenario 12: estimatedInputChars vence rawText/url");
  registeredTests++;
  let s12Assertions = 0;
  const runS12Assert = (cond: boolean, msg: string) => {
    s12Assertions++;
    assert(cond, msg);
  };

  const s12Adapter = new FakeFirestoreAdapter();
  const s12Res = await beginAiImportFinOpsWritePath({
    adapter: s12Adapter,
    requestId: "req12",
    organizationId: "org12",
    uid: "uid12",
    model: "model",
    plan: "pro",
    secret: "secret-key",
    rawText: "texto qualquer",
    url: "https://example.com/cifra/teste",
    estimatedInputChars: 123.9
  });

  runS12Assert(s12Res.status === "RESERVED", "status is RESERVED");
  if (s12Res.context) {
    runS12Assert(s12Res.context.repositoryInput.inputChars === 123, "inputChars matches floored estimatedInputChars (123)");
  }

  if (s12Assertions > 0) passedTests++;

  // Scenario 13: QUOTA_BLOCKED usando quotaDecision
  console.log("\nScenario 13: QUOTA_BLOCKED usando quotaDecision");
  registeredTests++;
  let s13Assertions = 0;
  const runS13Assert = (cond: boolean, msg: string) => {
    s13Assertions++;
    assert(cond, msg);
  };

  const s13Adapter = new FakeFirestoreAdapter();
  const currentMonth = new Date().toISOString().substring(0, 7);
  s13Adapter.db[`organizations/org13/aiUsage/${currentMonth}`] = {
    requestCount: 9999999,
    estimatedInputTokens: 0,
    estimatedOutputTokens: 0,
    estimatedTotalTokens: 0
  };

  const s13Res = await beginAiImportFinOpsWritePath({
    adapter: s13Adapter,
    requestId: "req13",
    organizationId: "org13",
    uid: "uid13",
    model: "model",
    plan: "pro",
    secret: "secret-key",
    rawText: "some input text"
  });

  runS13Assert(s13Res.status === "QUOTA_BLOCKED", "status is QUOTA_BLOCKED");
  runS13Assert(s13Res.context === null, "context is null");
  runS13Assert(s13Res.safeSummary.quotaStatusCode === 402 || s13Res.safeSummary.quotaStatusCode === 429, "quotaStatusCode is 402 or 429");
  runS13Assert(s13Res.safeSummary.safeErrorCode !== null, "safeErrorCode is not null");
  runS13Assert(
    s13Res.safeSummary.safeErrorCode === "AI_MONTHLY_REQUEST_QUOTA_EXCEEDED" ||
    s13Res.safeSummary.safeErrorCode === "QUOTA_BLOCKED" ||
    s13Res.safeSummary.safeErrorCode === "AI_FEATURE_DISABLED",
    "safeErrorCode matches the quota blocked code"
  );
  assertNoForbiddenKeys(s13Res.safeSummary, forbiddenKeys, "safeSummary.");

  if (s13Assertions > 0) passedTests++;

  // Scenario 14: Privacidade recursiva ampliada
  console.log("\nScenario 14: Privacidade recursiva ampliada");
  registeredTests++;
  let s14Assertions = 0;
  const runS14Assert = (cond: boolean, msg: string) => {
    s14Assertions++;
    assert(cond, msg);
  };

  const s14Adapter = new FakeFirestoreAdapter();
  const bRes14 = await beginAiImportFinOpsWritePath({
    adapter: s14Adapter,
    requestId: "req14",
    organizationId: "org14",
    uid: "uid14",
    model: "model",
    plan: "pro",
    secret: "secret-key",
    rawText: "secret-text-raw"
  });

  assertNoForbiddenKeys(bRes14, forbiddenKeys, "bRes14.");

  if (bRes14.context) {
    const fRes14 = await finalizeAiImportFinOpsWritePath({
      context: bRes14.context,
      outcome: "SUCCESS",
      estimatedOutputChars: 500,
      cacheSummary: {
        title: "Clean Title",
        artist: "Clean Artist",
        hasLyrics: true,
        hasChords: false
      }
    });
    assertNoForbiddenKeys(fRes14, forbiddenKeys, "fRes14.");
  }

  const dbKeys14 = Object.keys(s14Adapter.db);
  for (const docKey of dbKeys14) {
    assertNoForbiddenKeys(s14Adapter.db[docKey], forbiddenKeys, `s14Adapter.db[${docKey}].`);
  }

  runS14Assert(dbKeys14.length > 0, "Database holds written records safely and privately");

  if (s14Assertions > 0) passedTests++;

  // Scenario 15: Garantia de código de produção intocado
  console.log("\nScenario 15: Garantia de código de produção intocado");
  registeredTests++;
  let s15Assertions = 0;
  const runS15Assert = (cond: boolean, msg: string) => {
    s15Assertions++;
    assert(cond, msg);
  };

  const helperContent = fs.readFileSync("services/server/aiImportFinOpsWritePath.ts", "utf8");
  runS15Assert(helperContent.includes("normalizedInputChars"), "services/server/aiImportFinOpsWritePath.ts contains normalizedInputChars");
  runS15Assert(helperContent.includes("repoResult.quotaDecision?.statusCode"), "services/server/aiImportFinOpsWritePath.ts contains repoResult.quotaDecision?.statusCode");
  runS15Assert(helperContent.includes("repoResult.quotaDecision?.code"), "services/server/aiImportFinOpsWritePath.ts contains repoResult.quotaDecision?.code");

  const serverContent = fs.readFileSync("server.ts", "utf8");
  runS15Assert(serverContent.includes("AI_FINOPS_SHADOW_READ_PATH_START"), "server.ts contains AI_FINOPS_SHADOW_READ_PATH_START");
  runS15Assert(serverContent.includes("AI_FINOPS_SHADOW_READ_PATH_END"), "server.ts contains AI_FINOPS_SHADOW_READ_PATH_END");
  runS15Assert(serverContent.includes("beginAiImportFinOpsWritePath"), "server.ts contains beginAiImportFinOpsWritePath");
  runS15Assert(serverContent.includes("finalizeAiImportFinOpsWritePath"), "server.ts contains finalizeAiImportFinOpsWritePath");
  runS15Assert(serverContent.includes("AI_IMPORT_FINOPS_WRITE_PATH_ENABLED"), "server.ts contains AI_IMPORT_FINOPS_WRITE_PATH_ENABLED");
  runS15Assert(serverContent.includes("AI_FINOPS_SHADOW_WRITE_PATH_START"), "server.ts contains AI_FINOPS_SHADOW_WRITE_PATH_START");
  runS15Assert(serverContent.includes("AI_FINOPS_SHADOW_WRITE_PATH_END"), "server.ts contains AI_FINOPS_SHADOW_WRITE_PATH_END");
  runS15Assert(serverContent.includes("AI_FINOPS_SHADOW_WRITE_FINALIZE_START"), "server.ts contains AI_FINOPS_SHADOW_WRITE_FINALIZE_START");
  runS15Assert(serverContent.includes("AI_FINOPS_SHADOW_WRITE_FINALIZE_END"), "server.ts contains AI_FINOPS_SHADOW_WRITE_FINALIZE_END");
  runS15Assert(serverContent.includes("AI_FINOPS_SHADOW_WRITE_FINALIZE_FALLBACK_START"), "server.ts contains AI_FINOPS_SHADOW_WRITE_FINALIZE_FALLBACK_START");
  runS15Assert(serverContent.includes("AI_FINOPS_SHADOW_WRITE_FINALIZE_FALLBACK_END"), "server.ts contains AI_FINOPS_SHADOW_WRITE_FINALIZE_FALLBACK_END");
  runS15Assert(!serverContent.includes("beginAiFinOpsReservation"), "server.ts does not contain beginAiFinOpsReservation");
  runS15Assert(!serverContent.includes("finalizeAiFinOpsReservation"), "server.ts does not contain finalizeAiFinOpsReservation");

  if (s15Assertions > 0) passedTests++;

  console.log("\n=============================================");
  console.log("SUITE EXECUTION SUMMARY:");
  console.log(`Registered Tests:  ${registeredTests}`);
  console.log(`Passed Tests:      ${passedTests}`);
  console.log(`Failed Tests:      ${failedTests}`);
  console.log(`Zero Assertions:   ${zeroAssertions}`);
  console.log("=============================================");

  if (failedTests > 0 || zeroAssertions > 0 || registeredTests !== passedTests + failedTests) {
    console.error("\nSUITE FAILED!");
    process.exit(1);
  } else {
    console.log("\nSUITE PASSED successfully!");
  }
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
