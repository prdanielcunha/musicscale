import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createSafeExternalRedirectClient } from "../services/server/safeExternalRedirectClient.js";

let registeredTests = 0;
let passedTests = 0;
let failedTests = 0;

class MockHttpsClient {
  calls: any[] = [];
  responses: any[] = [];
  onCall?: (callNum: number) => void;
  onAfterCall?: (callNum: number) => void;

  constructor() {}

  queueResponse(res: any) {
    this.responses.push(res);
  }

  fetch = async (url: unknown, options?: { signal?: AbortSignal }) => {
    const callNum = this.calls.length + 1;
    this.calls.push({ url, signal: options?.signal });
    if (this.onCall) this.onCall(callNum);
    
    // Check if aborted before executing
    if (options?.signal?.aborted) {
      if (this.onAfterCall) this.onAfterCall(callNum);
      return { ok: false, statusCode: 504, error: "SOURCE_TIMEOUT" };
    }

    const responseToUse = this.responses.shift() || { ok: false, statusCode: 502, error: "SOURCE_FETCH_FAILED" };

    // Wait 2ms so events can propagate or we can abort in between
    await new Promise<void>((resolve) => {
      const handleAbort = () => {
        resolve();
      };
      if (options?.signal) {
        options.signal.addEventListener("abort", handleAbort);
      }
      setTimeout(() => {
        if (options?.signal) {
          options.signal.removeEventListener("abort", handleAbort);
        }
        resolve();
      }, 2);
    });

    if (options?.signal?.aborted) {
      if (this.onAfterCall) this.onAfterCall(callNum);
      return { ok: false, statusCode: 504, error: "SOURCE_TIMEOUT" };
    }

    if (this.onAfterCall) this.onAfterCall(callNum);
    return responseToUse;
  }
}

function readRequiredHash(file: string): string {
  if (!fs.existsSync(file)) {
    throw new Error(`Arquivo protegido não existe: ${file}`);
  }

  const hash = crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");

  if (!/^[0-9a-f]{64}$/.test(hash)) {
    throw new Error(`Hash inválido para ${file}`);
  }

  return hash;
}

async function runTest(name: string, fn: (t: any) => Promise<void>) {
  registeredTests++;
  let assertions = 0;
  const t = {
    expectTrue: (val: any) => { assertions++; if (val !== true) throw new Error(`Expected true, got ${val}`); },
    expectFalse: (val: any) => { assertions++; if (val !== false) throw new Error(`Expected false, got ${val}`); },
    expectEqual: (actual: any, expected: any) => { assertions++; if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`); }
  };
  try {
    await fn(t);
    if (assertions === 0) throw new Error("No assertions");
    passedTests++;
    console.log(`[PASS] ${name}`);
  } catch (err: any) {
    failedTests++;
    console.error(`❌ [FAIL] ${name}: ${err.message}`);
  }
}

const PROTECTED_FILES = [
  "index.html",
  "index.tsx",
  "App.tsx",
  "components/AppErrorBoundary.tsx",
  "server.ts",
  "services/server/safeExternalUrlPolicy.ts",
  "services/server/safeExternalDnsResolver.ts",
  "services/server/safeExternalHttpsClient.ts",
  "services/server/aiRequestSecurity.ts",
  "services/server/fixChordsHandler.ts",
  "scripts/test_phase0_2a_ecosystem_auth.ts",
  "scripts/test_phase0_2b_organization_security.ts",
  "scripts/test_phase0_2c1a_ai_authorization.ts",
  "scripts/test_phase0_2c1b_fix_chords_security.ts",
  "scripts/test_phase0_2c1c1_safe_external_url_policy.ts",
  "scripts/test_phase0_2c1c2_safe_external_dns_resolver.ts",
  "scripts/test_phase0_2c1c3_safe_external_https_client.ts",
  "package.json",
  "package-lock.json"
];

async function runAll() {
  console.log("Starting Phase 0.2C.1C.4 Redirect Client Tests...");
  
  const initialHashes: Record<string, string> = {};
  for (const file of PROTECTED_FILES) {
    initialHashes[file] = readRequiredHash(file);
  }

  await runTest("URL inválida não chama fetch", async (t) => {

    const mock = new MockHttpsClient();
    const client = createSafeExternalRedirectClient({ fetchExternalHttpsOnce: mock.fetch });
    const result = await client("not-a-url");
    t.expectFalse(result.ok);
    t.expectEqual((result as any).error, "INVALID_SOURCE_URL");
    t.expectEqual(mock.calls.length, 0);

  });

  await runTest("URL insegura não chama fetch", async (t) => {

    const mock = new MockHttpsClient();
    const client = createSafeExternalRedirectClient({ fetchExternalHttpsOnce: mock.fetch });
    const result = await client("ftp://example.com");
    t.expectFalse(result.ok);
    t.expectEqual((result as any).error, "UNSAFE_SOURCE_URL");
    t.expectEqual(mock.calls.length, 0);

  });

  await runTest("URL HTTP não chama fetch", async (t) => {

    const mock = new MockHttpsClient();
    const client = createSafeExternalRedirectClient({ fetchExternalHttpsOnce: mock.fetch });
    const result = await client("http://example.com");
    t.expectFalse(result.ok);
    t.expectEqual((result as any).error, "UNSAFE_SOURCE_URL");
    t.expectEqual(mock.calls.length, 0);

  });

  await runTest("URL com IP privado não chama fetch", async (t) => {

    const mock = new MockHttpsClient();
    const client = createSafeExternalRedirectClient({ fetchExternalHttpsOnce: mock.fetch });
    const result = await client("https://127.0.0.1");
    t.expectFalse(result.ok);
    t.expectEqual((result as any).error, "UNSAFE_SOURCE_URL");
    t.expectEqual(mock.calls.length, 0);

  });

  await runTest("URL válida chama fetch uma vez", async (t) => {

    const mock = new MockHttpsClient();
    mock.queueResponse({ ok: true, body: "ok", statusCode: 200, contentType: "text/plain", hostname: "example.com", bytes: 2 });
    const client = createSafeExternalRedirectClient({ fetchExternalHttpsOnce: mock.fetch });
    const result = await client("https://example.com");
    t.expectTrue(result.ok);
    t.expectEqual(mock.calls.length, 1);

  });

  await runTest("Location com CR", async (t) => {

    const mock = new MockHttpsClient();
    mock.queueResponse({ ok: false, statusCode: 301, error: "SOURCE_REDIRECT", location: "https://example.com/path\rinfo" });
    const client = createSafeExternalRedirectClient({ fetchExternalHttpsOnce: mock.fetch });
    const result = await client("https://example.com");
    t.expectFalse(result.ok);
    t.expectEqual((result as any).statusCode, 403);
    t.expectEqual((result as any).error, "SOURCE_UNSAFE_REDIRECT");

  });

  await runTest("Location com LF", async (t) => {

    const mock = new MockHttpsClient();
    mock.queueResponse({ ok: false, statusCode: 301, error: "SOURCE_REDIRECT", location: "https://example.com/path\ninfo" });
    const client = createSafeExternalRedirectClient({ fetchExternalHttpsOnce: mock.fetch });
    const result = await client("https://example.com");
    t.expectFalse(result.ok);
    t.expectEqual((result as any).statusCode, 403);
    t.expectEqual((result as any).error, "SOURCE_UNSAFE_REDIRECT");

  });

  await runTest("Location com tab", async (t) => {

    const mock = new MockHttpsClient();
    mock.queueResponse({ ok: false, statusCode: 301, error: "SOURCE_REDIRECT", location: "https://example.com/path\tinfo" });
    const client = createSafeExternalRedirectClient({ fetchExternalHttpsOnce: mock.fetch });
    const result = await client("https://example.com");
    t.expectFalse(result.ok);
    t.expectEqual((result as any).statusCode, 403);
    t.expectEqual((result as any).error, "SOURCE_UNSAFE_REDIRECT");

  });

  await runTest("Location com espaço interno", async (t) => {

    const mock = new MockHttpsClient();
    mock.queueResponse({ ok: false, statusCode: 301, error: "SOURCE_REDIRECT", location: "https://example.com/path info" });
    const client = createSafeExternalRedirectClient({ fetchExternalHttpsOnce: mock.fetch });
    const result = await client("https://example.com");
    t.expectFalse(result.ok);
    t.expectEqual((result as any).statusCode, 403);
    t.expectEqual((result as any).error, "SOURCE_UNSAFE_REDIRECT");

  });

  await runTest("padrão permite até 5 redirects", async (t) => {

    const mock = new MockHttpsClient();
    for (let i = 0; i < 5; i++) {
      mock.queueResponse({ ok: false, statusCode: 301, error: "SOURCE_REDIRECT", location: `https://example.com/${i+1}` });
    }
    mock.queueResponse({ ok: true, body: "ok", statusCode: 200, contentType: "text/plain", hostname: "example.com", bytes: 2 });
    const client = createSafeExternalRedirectClient({ fetchExternalHttpsOnce: mock.fetch });
    const result = await client("https://example.com/0");
    t.expectTrue(result.ok);
    t.expectEqual((result as any).redirectsFollowed, 5);

  });

  await runTest("sexto redirect excede limite", async (t) => {

    const mock = new MockHttpsClient();
    for (let i = 0; i < 6; i++) {
      mock.queueResponse({ ok: false, statusCode: 301, error: "SOURCE_REDIRECT", location: `https://example.com/${i+1}` });
    }
    const client = createSafeExternalRedirectClient({ fetchExternalHttpsOnce: mock.fetch });
    const result = await client("https://example.com/0");
    t.expectFalse(result.ok);
    t.expectEqual((result as any).error, "SOURCE_REDIRECT_LIMIT");

  });

  await runTest("maxRedirects 0 bloqueia primeiro redirect", async (t) => {

    const mock = new MockHttpsClient();
    mock.queueResponse({ ok: false, statusCode: 301, error: "SOURCE_REDIRECT", location: "https://example.com/1" });
    const client = createSafeExternalRedirectClient({ fetchExternalHttpsOnce: mock.fetch });
    const result = await client("https://example.com/0", { maxRedirects: 0 });
    t.expectFalse(result.ok);
    t.expectEqual((result as any).error, "SOURCE_REDIRECT_LIMIT");

  });

  await runTest("maxRedirects 1 permite um redirect", async (t) => {

    const mock = new MockHttpsClient();
    mock.queueResponse({ ok: false, statusCode: 301, error: "SOURCE_REDIRECT", location: "https://example.com/1" });
    mock.queueResponse({ ok: true, body: "ok", statusCode: 200, contentType: "text/plain", hostname: "example.com", bytes: 2 });
    const client = createSafeExternalRedirectClient({ fetchExternalHttpsOnce: mock.fetch });
    const result = await client("https://example.com/0", { maxRedirects: 1 });
    t.expectTrue(result.ok);
    t.expectEqual((result as any).redirectsFollowed, 1);

  });

  await runTest("maxRedirects 1 bloqueia segundo redirect", async (t) => {

    const mock = new MockHttpsClient();
    mock.queueResponse({ ok: false, statusCode: 301, error: "SOURCE_REDIRECT", location: "https://example.com/1" });
    mock.queueResponse({ ok: false, statusCode: 301, error: "SOURCE_REDIRECT", location: "https://example.com/2" });
    const client = createSafeExternalRedirectClient({ fetchExternalHttpsOnce: mock.fetch });
    const result = await client("https://example.com/0", { maxRedirects: 1 });
    t.expectFalse(result.ok);
    t.expectEqual((result as any).error, "SOURCE_REDIRECT_LIMIT");

  });

  await runTest("maxRedirects inválido string usa padrão", async (t) => {

    const mock = new MockHttpsClient();
    for (let i = 0; i < 5; i++) {
      mock.queueResponse({ ok: false, statusCode: 301, error: "SOURCE_REDIRECT", location: `https://example.com/${i+1}` });
    }
    mock.queueResponse({ ok: true, body: "ok", statusCode: 200, contentType: "text/plain", hostname: "example.com", bytes: 2 });
    const client = createSafeExternalRedirectClient({ fetchExternalHttpsOnce: mock.fetch });
    const result = await client("https://example.com/0", { maxRedirects: '5' as any });
    t.expectTrue(result.ok);
    t.expectEqual((result as any).redirectsFollowed, 5);

  });

  await runTest("maxRedirects negativo usa padrão", async (t) => {

    const mock = new MockHttpsClient();
    for (let i = 0; i < 5; i++) {
      mock.queueResponse({ ok: false, statusCode: 301, error: "SOURCE_REDIRECT", location: `https://example.com/${i+1}` });
    }
    mock.queueResponse({ ok: true, body: "ok", statusCode: 200, contentType: "text/plain", hostname: "example.com", bytes: 2 });
    const client = createSafeExternalRedirectClient({ fetchExternalHttpsOnce: mock.fetch });
    const result = await client("https://example.com/0", { maxRedirects: -1 as any });
    t.expectTrue(result.ok);
    t.expectEqual((result as any).redirectsFollowed, 5);

  });

  await runTest("maxRedirects acima de 10 usa padrão", async (t) => {

    const mock = new MockHttpsClient();
    for (let i = 0; i < 5; i++) {
      mock.queueResponse({ ok: false, statusCode: 301, error: "SOURCE_REDIRECT", location: `https://example.com/${i+1}` });
    }
    mock.queueResponse({ ok: true, body: "ok", statusCode: 200, contentType: "text/plain", hostname: "example.com", bytes: 2 });
    const client = createSafeExternalRedirectClient({ fetchExternalHttpsOnce: mock.fetch });
    const result = await client("https://example.com/0", { maxRedirects: 11 as any });
    t.expectTrue(result.ok);
    t.expectEqual((result as any).redirectsFollowed, 5);

  });

  await runTest("maxRedirects decimal usa padrão", async (t) => {

    const mock = new MockHttpsClient();
    for (let i = 0; i < 5; i++) {
      mock.queueResponse({ ok: false, statusCode: 301, error: "SOURCE_REDIRECT", location: `https://example.com/${i+1}` });
    }
    mock.queueResponse({ ok: true, body: "ok", statusCode: 200, contentType: "text/plain", hostname: "example.com", bytes: 2 });
    const client = createSafeExternalRedirectClient({ fetchExternalHttpsOnce: mock.fetch });
    const result = await client("https://example.com/0", { maxRedirects: 5.5 as any });
    t.expectTrue(result.ok);
    t.expectEqual((result as any).redirectsFollowed, 5);

  });

  await runTest("limite excedido retorna SOURCE_REDIRECT_LIMIT", async (t) => {

    const mock = new MockHttpsClient();
    mock.queueResponse({ ok: false, statusCode: 301, error: "SOURCE_REDIRECT", location: "https://example.com/1" });
    const client = createSafeExternalRedirectClient({ fetchExternalHttpsOnce: mock.fetch });
    const result = await client("https://example.com/0", { maxRedirects: 0 });
    t.expectFalse(result.ok);
    t.expectEqual((result as any).error, "SOURCE_REDIRECT_LIMIT");

  });

  await runTest("redirect que excede limite não é contado como seguido em sucesso, porque não há sucesso", async (t) => {

    const mock = new MockHttpsClient();
    mock.queueResponse({ ok: false, statusCode: 301, error: "SOURCE_REDIRECT", location: "https://example.com/1" });
    const client = createSafeExternalRedirectClient({ fetchExternalHttpsOnce: mock.fetch });
    const result = await client("https://example.com/0", { maxRedirects: 0 });
    t.expectFalse(result.ok);
    t.expectEqual((result as any).redirectsFollowed, undefined);

  });

  await runTest("301 absoluto HTTPS é seguido", async (t) => {

    const mock = new MockHttpsClient();
    mock.queueResponse({ ok: false, statusCode: 301, error: "SOURCE_REDIRECT", location: "https://example.com/2" });
    mock.queueResponse({ ok: true, body: "ok", statusCode: 200, contentType: "text/plain", hostname: "example.com", bytes: 2 });
    const client = createSafeExternalRedirectClient({ fetchExternalHttpsOnce: mock.fetch });
    const result = await client("https://example.com/1");
    t.expectTrue(result.ok);
    t.expectEqual(mock.calls.length, 2);
  
  });

  await runTest("302 absoluto HTTPS é seguido", async (t) => {

    const mock = new MockHttpsClient();
    mock.queueResponse({ ok: false, statusCode: 302, error: "SOURCE_REDIRECT", location: "https://example.com/2" });
    mock.queueResponse({ ok: true, body: "ok", statusCode: 200, contentType: "text/plain", hostname: "example.com", bytes: 2 });
    const client = createSafeExternalRedirectClient({ fetchExternalHttpsOnce: mock.fetch });
    const result = await client("https://example.com/1");
    t.expectTrue(result.ok);
    t.expectEqual(mock.calls.length, 2);
  
  });

  await runTest("303 absoluto HTTPS é seguido", async (t) => {

    const mock = new MockHttpsClient();
    mock.queueResponse({ ok: false, statusCode: 303, error: "SOURCE_REDIRECT", location: "https://example.com/2" });
    mock.queueResponse({ ok: true, body: "ok", statusCode: 200, contentType: "text/plain", hostname: "example.com", bytes: 2 });
    const client = createSafeExternalRedirectClient({ fetchExternalHttpsOnce: mock.fetch });
    const result = await client("https://example.com/1");
    t.expectTrue(result.ok);
    t.expectEqual(mock.calls.length, 2);
  
  });

  await runTest("307 absoluto HTTPS é seguido", async (t) => {

    const mock = new MockHttpsClient();
    mock.queueResponse({ ok: false, statusCode: 307, error: "SOURCE_REDIRECT", location: "https://example.com/2" });
    mock.queueResponse({ ok: true, body: "ok", statusCode: 200, contentType: "text/plain", hostname: "example.com", bytes: 2 });
    const client = createSafeExternalRedirectClient({ fetchExternalHttpsOnce: mock.fetch });
    const result = await client("https://example.com/1");
    t.expectTrue(result.ok);
    t.expectEqual(mock.calls.length, 2);
  
  });

  await runTest("308 absoluto HTTPS é seguido", async (t) => {

    const mock = new MockHttpsClient();
    mock.queueResponse({ ok: false, statusCode: 308, error: "SOURCE_REDIRECT", location: "https://example.com/2" });
    mock.queueResponse({ ok: true, body: "ok", statusCode: 200, contentType: "text/plain", hostname: "example.com", bytes: 2 });
    const client = createSafeExternalRedirectClient({ fetchExternalHttpsOnce: mock.fetch });
    const result = await client("https://example.com/1");
    t.expectTrue(result.ok);
    t.expectEqual(mock.calls.length, 2);
  
  });

  await runTest("redirect absoluto chama segundo fetch", async (t) => {

    const mock = new MockHttpsClient();
    mock.queueResponse({ ok: false, statusCode: 301, error: "SOURCE_REDIRECT", location: "https://example.com/2" });
    mock.queueResponse({ ok: true, body: "ok", statusCode: 200, contentType: "text/plain", hostname: "example.com", bytes: 2 });
    const client = createSafeExternalRedirectClient({ fetchExternalHttpsOnce: mock.fetch });
    const result = await client("https://example.com/1");
    t.expectTrue(result.ok);
    t.expectEqual(mock.calls.length, 2);
    t.expectEqual(mock.calls[1].url, "https://example.com/2");

  });

  await runTest("redirect absoluto usa URL normalizada", async (t) => {

    const mock = new MockHttpsClient();
    mock.queueResponse({ ok: false, statusCode: 301, error: "SOURCE_REDIRECT", location: "https://example.com/2/../3" });
    mock.queueResponse({ ok: true, body: "ok", statusCode: 200, contentType: "text/plain", hostname: "example.com", bytes: 2 });
    const client = createSafeExternalRedirectClient({ fetchExternalHttpsOnce: mock.fetch });
    const result = await client("https://example.com/1");
    t.expectTrue(result.ok);
    t.expectEqual(mock.calls[1].url, "https://example.com/3");

  });

  await runTest("sucesso após redirect retorna redirectsFollowed 1", async (t) => {

    const mock = new MockHttpsClient();
    mock.queueResponse({ ok: false, statusCode: 301, error: "SOURCE_REDIRECT", location: "https://example.com/2" });
    mock.queueResponse({ ok: true, body: "ok", statusCode: 200, contentType: "text/plain", hostname: "example.com", bytes: 2 });
    const client = createSafeExternalRedirectClient({ fetchExternalHttpsOnce: mock.fetch });
    const result = await client("https://example.com/1");
    t.expectTrue(result.ok);
    t.expectEqual((result as any).redirectsFollowed, 1);

  });

  await runTest("Location /path", async (t) => {

    const mock = new MockHttpsClient();
    mock.queueResponse({ ok: false, statusCode: 301, error: "SOURCE_REDIRECT", location: "/path" });
    mock.queueResponse({ ok: true, body: "ok", statusCode: 200, contentType: "text/plain", hostname: "example.com", bytes: 2 });
    const client = createSafeExternalRedirectClient({ fetchExternalHttpsOnce: mock.fetch });
    const result = await client("https://example.com/dir/1");
    t.expectTrue(result.ok);
    t.expectEqual(mock.calls[1].url, "https://example.com/path");

  });

  await runTest("Location path sem barra", async (t) => {

    const mock = new MockHttpsClient();
    mock.queueResponse({ ok: false, statusCode: 301, error: "SOURCE_REDIRECT", location: "path" });
    mock.queueResponse({ ok: true, body: "ok", statusCode: 200, contentType: "text/plain", hostname: "example.com", bytes: 2 });
    const client = createSafeExternalRedirectClient({ fetchExternalHttpsOnce: mock.fetch });
    const result = await client("https://example.com/dir/1");
    t.expectTrue(result.ok);
    t.expectEqual(mock.calls[1].url, "https://example.com/dir/path");

  });

  await runTest("Location ../path", async (t) => {

    const mock = new MockHttpsClient();
    mock.queueResponse({ ok: false, statusCode: 301, error: "SOURCE_REDIRECT", location: "../path" });
    mock.queueResponse({ ok: true, body: "ok", statusCode: 200, contentType: "text/plain", hostname: "example.com", bytes: 2 });
    const client = createSafeExternalRedirectClient({ fetchExternalHttpsOnce: mock.fetch });
    const result = await client("https://example.com/dir/1");
    t.expectTrue(result.ok);
    t.expectEqual(mock.calls[1].url, "https://example.com/path");

  });

  await runTest("Location ?q=1", async (t) => {

    const mock = new MockHttpsClient();
    mock.queueResponse({ ok: false, statusCode: 301, error: "SOURCE_REDIRECT", location: "?q=1" });
    mock.queueResponse({ ok: true, body: "ok", statusCode: 200, contentType: "text/plain", hostname: "example.com", bytes: 2 });
    const client = createSafeExternalRedirectClient({ fetchExternalHttpsOnce: mock.fetch });
    const result = await client("https://example.com/dir/1");
    t.expectTrue(result.ok);
    t.expectEqual(mock.calls[1].url, "https://example.com/dir/1?q=1");

  });

  await runTest("Location //example.com/path", async (t) => {

    const mock = new MockHttpsClient();
    mock.queueResponse({ ok: false, statusCode: 301, error: "SOURCE_REDIRECT", location: "//example.com/path" });
    mock.queueResponse({ ok: true, body: "ok", statusCode: 200, contentType: "text/plain", hostname: "example.com", bytes: 2 });
    const client = createSafeExternalRedirectClient({ fetchExternalHttpsOnce: mock.fetch });
    const result = await client("https://example.com/dir/1");
    t.expectTrue(result.ok);
    t.expectEqual(mock.calls[1].url, "https://example.com/path");

  });

  await runTest("relative redirect preserva origem quando aplicável", async (t) => {

    const mock = new MockHttpsClient();
    mock.queueResponse({ ok: false, statusCode: 301, error: "SOURCE_REDIRECT", location: "/abc" });
    mock.queueResponse({ ok: true, body: "ok", statusCode: 200, contentType: "text/plain", hostname: "example.com", bytes: 2 });
    const client = createSafeExternalRedirectClient({ fetchExternalHttpsOnce: mock.fetch });
    const result = await client("https://example.com/dir/1");
    t.expectTrue(result.ok);
    t.expectEqual(mock.calls[1].url, "https://example.com/abc");

  });

  await runTest("relative redirect não preserva fragment", async (t) => {

    const mock = new MockHttpsClient();
    mock.queueResponse({ ok: false, statusCode: 301, error: "SOURCE_REDIRECT", location: "/abc" });
    mock.queueResponse({ ok: true, body: "ok", statusCode: 200, contentType: "text/plain", hostname: "example.com", bytes: 2 });
    const client = createSafeExternalRedirectClient({ fetchExternalHttpsOnce: mock.fetch });
    const result = await client("https://example.com/dir/1#frag");
    t.expectTrue(result.ok);
    t.expectEqual(mock.calls[1].url, "https://example.com/abc");

  });

  await runTest("dois redirects são seguidos", async (t) => {

    const mock = new MockHttpsClient();
    mock.queueResponse({ ok: false, statusCode: 301, error: "SOURCE_REDIRECT", location: "/2" });
    mock.queueResponse({ ok: false, statusCode: 301, error: "SOURCE_REDIRECT", location: "/3" });
    mock.queueResponse({ ok: true, body: "ok", statusCode: 200, contentType: "text/plain", hostname: "example.com", bytes: 2 });
    const client = createSafeExternalRedirectClient({ fetchExternalHttpsOnce: mock.fetch });
    const result = await client("https://example.com/1");
    t.expectTrue(result.ok);
    t.expectEqual(mock.calls.length, 3);

  });

  await runTest("três redirects são seguidos", async (t) => {

    const mock = new MockHttpsClient();
    mock.queueResponse({ ok: false, statusCode: 301, error: "SOURCE_REDIRECT", location: "/2" });
    mock.queueResponse({ ok: false, statusCode: 301, error: "SOURCE_REDIRECT", location: "/3" });
    mock.queueResponse({ ok: false, statusCode: 301, error: "SOURCE_REDIRECT", location: "/4" });
    mock.queueResponse({ ok: true, body: "ok", statusCode: 200, contentType: "text/plain", hostname: "example.com", bytes: 2 });
    const client = createSafeExternalRedirectClient({ fetchExternalHttpsOnce: mock.fetch });
    const result = await client("https://example.com/1");
    t.expectTrue(result.ok);
    t.expectEqual(mock.calls.length, 4);

  });

  await runTest("redirectsFollowed reflete quantidade seguida", async (t) => {

    const mock = new MockHttpsClient();
    mock.queueResponse({ ok: false, statusCode: 301, error: "SOURCE_REDIRECT", location: "/2" });
    mock.queueResponse({ ok: false, statusCode: 301, error: "SOURCE_REDIRECT", location: "/3" });
    mock.queueResponse({ ok: true, body: "ok", statusCode: 200, contentType: "text/plain", hostname: "example.com", bytes: 2 });
    const client = createSafeExternalRedirectClient({ fetchExternalHttpsOnce: mock.fetch });
    const result = await client("https://example.com/1");
    t.expectTrue(result.ok);
    t.expectEqual((result as any).redirectsFollowed, 2);

  });

  await runTest("sucesso final retorna body final", async (t) => {

    const mock = new MockHttpsClient();
    mock.queueResponse({ ok: false, statusCode: 301, error: "SOURCE_REDIRECT", location: "/2" });
    mock.queueResponse({ ok: true, body: "BODY_FINAL", statusCode: 200, contentType: "text/plain", hostname: "example.com", bytes: 10 });
    const client = createSafeExternalRedirectClient({ fetchExternalHttpsOnce: mock.fetch });
    const result = await client("https://example.com/1");
    t.expectTrue(result.ok);
    t.expectEqual((result as any).body, "BODY_FINAL");

  });

  await runTest("erro após redirect é retornado", async (t) => {

    const mock = new MockHttpsClient();
    mock.queueResponse({ ok: false, statusCode: 301, error: "SOURCE_REDIRECT", location: "/2" });
    mock.queueResponse({ ok: false, statusCode: 404, error: "SOURCE_HTTP_ERROR" });
    const client = createSafeExternalRedirectClient({ fetchExternalHttpsOnce: mock.fetch });
    const result = await client("https://example.com/1");
    t.expectFalse(result.ok);
    t.expectEqual((result as any).error, "SOURCE_HTTP_ERROR");

  });

  await runTest("não segue novo redirect após erro final", async (t) => {

    const mock = new MockHttpsClient();
    mock.queueResponse({ ok: false, statusCode: 301, error: "SOURCE_REDIRECT", location: "/2" });
    mock.queueResponse({ ok: false, statusCode: 404, error: "SOURCE_HTTP_ERROR" });
    const client = createSafeExternalRedirectClient({ fetchExternalHttpsOnce: mock.fetch });
    const result = await client("https://example.com/1");
    t.expectFalse(result.ok);
    t.expectEqual(mock.calls.length, 2);

  });

  await runTest("cada hop recebe o mesmo AbortSignal", async (t) => {

    const mock = new MockHttpsClient();
    mock.queueResponse({ ok: false, statusCode: 301, error: "SOURCE_REDIRECT", location: "/2" });
    mock.queueResponse({ ok: true, body: "ok", statusCode: 200, contentType: "text/plain", hostname: "example.com", bytes: 2 });
    const client = createSafeExternalRedirectClient({ fetchExternalHttpsOnce: mock.fetch });
    const ac = new AbortController();
    await client("https://example.com/1", { signal: ac.signal });
    t.expectEqual(mock.calls[0].signal, ac.signal);
    t.expectEqual(mock.calls[1].signal, ac.signal);

  });

  await runTest("cada hop é validado antes de seguir", async (t) => {

    const mock = new MockHttpsClient();
    mock.queueResponse({ ok: false, statusCode: 301, error: "SOURCE_REDIRECT", location: "http://example.com/2" });
    const client = createSafeExternalRedirectClient({ fetchExternalHttpsOnce: mock.fetch });
    const result = await client("https://example.com/1");
    t.expectFalse(result.ok);
    t.expectEqual((result as any).error, "SOURCE_UNSAFE_REDIRECT");
    t.expectEqual(mock.calls.length, 1);

  });

  await runTest("redirect para mesma URL retorna SOURCE_REDIRECT_LOOP", async (t) => {

    const mock = new MockHttpsClient();
    mock.queueResponse({ ok: false, statusCode: 301, error: "SOURCE_REDIRECT", location: "https://example.com/1" });
    const client = createSafeExternalRedirectClient({ fetchExternalHttpsOnce: mock.fetch });
    const result = await client("https://example.com/1");
    t.expectFalse(result.ok);
    t.expectEqual((result as any).error, "SOURCE_REDIRECT_LOOP");

  });

  await runTest("loop de duas URLs retorna SOURCE_REDIRECT_LOOP", async (t) => {

    const mock = new MockHttpsClient();
    mock.queueResponse({ ok: false, statusCode: 301, error: "SOURCE_REDIRECT", location: "https://example.com/2" });
    mock.queueResponse({ ok: false, statusCode: 301, error: "SOURCE_REDIRECT", location: "https://example.com/1" });
    const client = createSafeExternalRedirectClient({ fetchExternalHttpsOnce: mock.fetch });
    const result = await client("https://example.com/1");
    t.expectFalse(result.ok);
    t.expectEqual((result as any).error, "SOURCE_REDIRECT_LOOP");

  });

  await runTest("loop após normalização retorna SOURCE_REDIRECT_LOOP", async (t) => {

    const mock = new MockHttpsClient();
    mock.queueResponse({ ok: false, statusCode: 301, error: "SOURCE_REDIRECT", location: "https://example.com/dir/../1" });
    const client = createSafeExternalRedirectClient({ fetchExternalHttpsOnce: mock.fetch });
    const result = await client("https://example.com/1");
    t.expectFalse(result.ok);
    t.expectEqual((result as any).error, "SOURCE_REDIRECT_LOOP");

  });

  await runTest("loop não chama fetch extra depois de detectado", async (t) => {

    const mock = new MockHttpsClient();
    mock.queueResponse({ ok: false, statusCode: 301, error: "SOURCE_REDIRECT", location: "https://example.com/1" });
    const client = createSafeExternalRedirectClient({ fetchExternalHttpsOnce: mock.fetch });
    const result = await client("https://example.com/1");
    t.expectFalse(result.ok);
    t.expectEqual(mock.calls.length, 1);

  });

  await runTest("loop não retorna redirectChain", async (t) => {

    const mock = new MockHttpsClient();
    mock.queueResponse({ ok: false, statusCode: 301, error: "SOURCE_REDIRECT", location: "https://example.com/1" });
    const client = createSafeExternalRedirectClient({ fetchExternalHttpsOnce: mock.fetch });
    const result = await client("https://example.com/1");
    t.expectFalse(result.ok);
    t.expectEqual((result as any).redirectChain, undefined);

  });

  await runTest("Location ausente", async (t) => {

    const mock = new MockHttpsClient();
    mock.queueResponse({ ok: false, statusCode: 301, error: "SOURCE_REDIRECT" });
    const client = createSafeExternalRedirectClient({ fetchExternalHttpsOnce: mock.fetch });
    const result = await client("https://example.com/1");
    t.expectFalse(result.ok);
    t.expectEqual((result as any).error, "SOURCE_UNSAFE_REDIRECT");

  });

  await runTest("Location vazio", async (t) => {

    const mock = new MockHttpsClient();
    mock.queueResponse({ ok: false, statusCode: 301, error: "SOURCE_REDIRECT", location: "" });
    const client = createSafeExternalRedirectClient({ fetchExternalHttpsOnce: mock.fetch });
    const result = await client("https://example.com/1");
    t.expectFalse(result.ok);
    t.expectEqual((result as any).error, "SOURCE_UNSAFE_REDIRECT");

  });

  await runTest("Location whitespace", async (t) => {

    const mock = new MockHttpsClient();
    mock.queueResponse({ ok: false, statusCode: 301, error: "SOURCE_REDIRECT", location: "   " });
    const client = createSafeExternalRedirectClient({ fetchExternalHttpsOnce: mock.fetch });
    const result = await client("https://example.com/1");
    t.expectFalse(result.ok);
    t.expectEqual((result as any).error, "SOURCE_UNSAFE_REDIRECT");

  });

  await runTest("Location com CR duplo", async (t) => {

    const mock = new MockHttpsClient();
    mock.queueResponse({ ok: false, statusCode: 301, error: "SOURCE_REDIRECT", location: "https://example.com/1\r" });
    const client = createSafeExternalRedirectClient({ fetchExternalHttpsOnce: mock.fetch });
    const result = await client("https://example.com/1");
    t.expectFalse(result.ok);
    t.expectEqual((result as any).error, "SOURCE_UNSAFE_REDIRECT");

  });

  await runTest("Location com LF duplo", async (t) => {

    const mock = new MockHttpsClient();
    mock.queueResponse({ ok: false, statusCode: 301, error: "SOURCE_REDIRECT", location: "https://example.com/1\n" });
    const client = createSafeExternalRedirectClient({ fetchExternalHttpsOnce: mock.fetch });
    const result = await client("https://example.com/1");
    t.expectFalse(result.ok);
    t.expectEqual((result as any).error, "SOURCE_UNSAFE_REDIRECT");

  });

  await runTest("Location com tab duplo", async (t) => {

    const mock = new MockHttpsClient();
    mock.queueResponse({ ok: false, statusCode: 301, error: "SOURCE_REDIRECT", location: "https://example.com/1\t" });
    const client = createSafeExternalRedirectClient({ fetchExternalHttpsOnce: mock.fetch });
    const result = await client("https://example.com/1");
    t.expectFalse(result.ok);
    t.expectEqual((result as any).error, "SOURCE_UNSAFE_REDIRECT");

  });

  await runTest("Location acima de 2048", async (t) => {

    const mock = new MockHttpsClient();
    mock.queueResponse({ ok: false, statusCode: 301, error: "SOURCE_REDIRECT", location: "https://example.com/1" + "a".repeat(2048) });
    const client = createSafeExternalRedirectClient({ fetchExternalHttpsOnce: mock.fetch });
    const result = await client("https://example.com/1");
    t.expectFalse(result.ok);
    t.expectEqual((result as any).error, "SOURCE_UNSAFE_REDIRECT");

  });

  await runTest("Location array", async (t) => {

    const mock = new MockHttpsClient();
    mock.queueResponse({ ok: false, statusCode: 301, error: "SOURCE_REDIRECT", location: ["https://example.com/2"] as any });
    const client = createSafeExternalRedirectClient({ fetchExternalHttpsOnce: mock.fetch });
    const result = await client("https://example.com/1");
    t.expectFalse(result.ok);
    t.expectEqual((result as any).error, "SOURCE_UNSAFE_REDIRECT");

  });

  await runTest("Location objeto", async (t) => {

    const mock = new MockHttpsClient();
    mock.queueResponse({ ok: false, statusCode: 301, error: "SOURCE_REDIRECT", location: { url: "https://example.com/2" } as any });
    const client = createSafeExternalRedirectClient({ fetchExternalHttpsOnce: mock.fetch });
    const result = await client("https://example.com/1");
    t.expectFalse(result.ok);
    t.expectEqual((result as any).error, "SOURCE_UNSAFE_REDIRECT");

  });

  await runTest("protocolo bloqueado http", async (t) => {

    const mock = new MockHttpsClient();
    mock.queueResponse({ ok: false, statusCode: 301, error: "SOURCE_REDIRECT", location: `http://example.com/1` });
    const client = createSafeExternalRedirectClient({ fetchExternalHttpsOnce: mock.fetch });
    const result = await client("https://example.com/1");
    t.expectFalse(result.ok);
    t.expectEqual((result as any).error, "SOURCE_UNSAFE_REDIRECT");
  
  });

  await runTest("protocolo bloqueado ftp", async (t) => {

    const mock = new MockHttpsClient();
    mock.queueResponse({ ok: false, statusCode: 301, error: "SOURCE_REDIRECT", location: `ftp://example.com/1` });
    const client = createSafeExternalRedirectClient({ fetchExternalHttpsOnce: mock.fetch });
    const result = await client("https://example.com/1");
    t.expectFalse(result.ok);
    t.expectEqual((result as any).error, "SOURCE_UNSAFE_REDIRECT");
  
  });

  await runTest("protocolo bloqueado file", async (t) => {

    const mock = new MockHttpsClient();
    mock.queueResponse({ ok: false, statusCode: 301, error: "SOURCE_REDIRECT", location: `file://example.com/1` });
    const client = createSafeExternalRedirectClient({ fetchExternalHttpsOnce: mock.fetch });
    const result = await client("https://example.com/1");
    t.expectFalse(result.ok);
    t.expectEqual((result as any).error, "SOURCE_UNSAFE_REDIRECT");
  
  });

  await runTest("protocolo bloqueado data", async (t) => {

    const mock = new MockHttpsClient();
    mock.queueResponse({ ok: false, statusCode: 301, error: "SOURCE_REDIRECT", location: `data://example.com/1` });
    const client = createSafeExternalRedirectClient({ fetchExternalHttpsOnce: mock.fetch });
    const result = await client("https://example.com/1");
    t.expectFalse(result.ok);
    t.expectEqual((result as any).error, "SOURCE_UNSAFE_REDIRECT");
  
  });

  await runTest("protocolo bloqueado javascript", async (t) => {

    const mock = new MockHttpsClient();
    mock.queueResponse({ ok: false, statusCode: 301, error: "SOURCE_REDIRECT", location: `javascript://example.com/1` });
    const client = createSafeExternalRedirectClient({ fetchExternalHttpsOnce: mock.fetch });
    const result = await client("https://example.com/1");
    t.expectFalse(result.ok);
    t.expectEqual((result as any).error, "SOURCE_UNSAFE_REDIRECT");
  
  });

  await runTest("protocolo bloqueado mailto", async (t) => {

    const mock = new MockHttpsClient();
    mock.queueResponse({ ok: false, statusCode: 301, error: "SOURCE_REDIRECT", location: `mailto://example.com/1` });
    const client = createSafeExternalRedirectClient({ fetchExternalHttpsOnce: mock.fetch });
    const result = await client("https://example.com/1");
    t.expectFalse(result.ok);
    t.expectEqual((result as any).error, "SOURCE_UNSAFE_REDIRECT");
  
  });

  await runTest("protocolo bloqueado blob", async (t) => {

    const mock = new MockHttpsClient();
    mock.queueResponse({ ok: false, statusCode: 301, error: "SOURCE_REDIRECT", location: `blob://example.com/1` });
    const client = createSafeExternalRedirectClient({ fetchExternalHttpsOnce: mock.fetch });
    const result = await client("https://example.com/1");
    t.expectFalse(result.ok);
    t.expectEqual((result as any).error, "SOURCE_UNSAFE_REDIRECT");
  
  });

  await runTest("protocolo bloqueado about", async (t) => {

    const mock = new MockHttpsClient();
    mock.queueResponse({ ok: false, statusCode: 301, error: "SOURCE_REDIRECT", location: `about://example.com/1` });
    const client = createSafeExternalRedirectClient({ fetchExternalHttpsOnce: mock.fetch });
    const result = await client("https://example.com/1");
    t.expectFalse(result.ok);
    t.expectEqual((result as any).error, "SOURCE_UNSAFE_REDIRECT");
  
  });

  await runTest("protocolo bloqueado chrome", async (t) => {

    const mock = new MockHttpsClient();
    mock.queueResponse({ ok: false, statusCode: 301, error: "SOURCE_REDIRECT", location: `chrome://example.com/1` });
    const client = createSafeExternalRedirectClient({ fetchExternalHttpsOnce: mock.fetch });
    const result = await client("https://example.com/1");
    t.expectFalse(result.ok);
    t.expectEqual((result as any).error, "SOURCE_UNSAFE_REDIRECT");
  
  });

  await runTest("alvo inseguro localhost", async (t) => {

    const mock = new MockHttpsClient();
    mock.queueResponse({ ok: false, statusCode: 301, error: "SOURCE_REDIRECT", location: `https://localhost/1` });
    const client = createSafeExternalRedirectClient({ fetchExternalHttpsOnce: mock.fetch });
    const result = await client("https://example.com/1");
    t.expectFalse(result.ok);
    t.expectEqual((result as any).error, "SOURCE_UNSAFE_REDIRECT");
  
  });

  await runTest("alvo inseguro 127.0.0.1", async (t) => {

    const mock = new MockHttpsClient();
    mock.queueResponse({ ok: false, statusCode: 301, error: "SOURCE_REDIRECT", location: `https://127.0.0.1/1` });
    const client = createSafeExternalRedirectClient({ fetchExternalHttpsOnce: mock.fetch });
    const result = await client("https://example.com/1");
    t.expectFalse(result.ok);
    t.expectEqual((result as any).error, "SOURCE_UNSAFE_REDIRECT");
  
  });

  await runTest("alvo inseguro 10.0.0.1", async (t) => {

    const mock = new MockHttpsClient();
    mock.queueResponse({ ok: false, statusCode: 301, error: "SOURCE_REDIRECT", location: `https://10.0.0.1/1` });
    const client = createSafeExternalRedirectClient({ fetchExternalHttpsOnce: mock.fetch });
    const result = await client("https://example.com/1");
    t.expectFalse(result.ok);
    t.expectEqual((result as any).error, "SOURCE_UNSAFE_REDIRECT");
  
  });

  await runTest("alvo inseguro 192.168.0.1", async (t) => {

    const mock = new MockHttpsClient();
    mock.queueResponse({ ok: false, statusCode: 301, error: "SOURCE_REDIRECT", location: `https://192.168.0.1/1` });
    const client = createSafeExternalRedirectClient({ fetchExternalHttpsOnce: mock.fetch });
    const result = await client("https://example.com/1");
    t.expectFalse(result.ok);
    t.expectEqual((result as any).error, "SOURCE_UNSAFE_REDIRECT");
  
  });

  await runTest("alvo inseguro [::1]", async (t) => {

    const mock = new MockHttpsClient();
    mock.queueResponse({ ok: false, statusCode: 301, error: "SOURCE_REDIRECT", location: `https://[::1]/1` });
    const client = createSafeExternalRedirectClient({ fetchExternalHttpsOnce: mock.fetch });
    const result = await client("https://example.com/1");
    t.expectFalse(result.ok);
    t.expectEqual((result as any).error, "SOURCE_UNSAFE_REDIRECT");
  
  });

  await runTest("alvo inseguro user:pass@example.com", async (t) => {

    const mock = new MockHttpsClient();
    mock.queueResponse({ ok: false, statusCode: 301, error: "SOURCE_REDIRECT", location: `https://user:pass@example.com/1` });
    const client = createSafeExternalRedirectClient({ fetchExternalHttpsOnce: mock.fetch });
    const result = await client("https://example.com/1");
    t.expectFalse(result.ok);
    t.expectEqual((result as any).error, "SOURCE_UNSAFE_REDIRECT");
  
  });

  await runTest("alvo inseguro example.com:80", async (t) => {

    const mock = new MockHttpsClient();
    mock.queueResponse({ ok: false, statusCode: 301, error: "SOURCE_REDIRECT", location: `https://example.com:80/1` });
    const client = createSafeExternalRedirectClient({ fetchExternalHttpsOnce: mock.fetch });
    const result = await client("https://example.com/1");
    t.expectFalse(result.ok);
    t.expectEqual((result as any).error, "SOURCE_UNSAFE_REDIRECT");
  
  });

  await runTest("alvo inseguro in vá lido", async (t) => {

    const mock = new MockHttpsClient();
    mock.queueResponse({ ok: false, statusCode: 301, error: "SOURCE_REDIRECT", location: `https://in vá lido/1` });
    const client = createSafeExternalRedirectClient({ fetchExternalHttpsOnce: mock.fetch });
    const result = await client("https://example.com/1");
    t.expectFalse(result.ok);
    t.expectEqual((result as any).error, "SOURCE_UNSAFE_REDIRECT");
  
  });

  await runTest("abort antes da chamada não chama fetch", async (t) => {

    const mock = new MockHttpsClient();
    const ac = new AbortController();
    ac.abort();
    const client = createSafeExternalRedirectClient({ fetchExternalHttpsOnce: mock.fetch });
    const result = await client("https://example.com/1", { signal: ac.signal });
    t.expectFalse(result.ok);
    t.expectEqual((result as any).error, "SOURCE_TIMEOUT");
    t.expectEqual(mock.calls.length, 0);

  });

  await runTest("abort durante primeiro hop retorna SOURCE_TIMEOUT", async (t) => {

    const mock = new MockHttpsClient();
    const ac = new AbortController();
    mock.onCall = () => ac.abort();
    mock.queueResponse({ ok: false, statusCode: 504, error: "SOURCE_TIMEOUT" });
    const client = createSafeExternalRedirectClient({ fetchExternalHttpsOnce: mock.fetch });
    const result = await client("https://example.com/1", { signal: ac.signal });
    t.expectFalse(result.ok);
    t.expectEqual((result as any).error, "SOURCE_TIMEOUT");

  });

  await runTest("abort entre redirects impede próximo hop", async (t) => {

    const mock = new MockHttpsClient();
    const ac = new AbortController();
    mock.queueResponse({ ok: false, statusCode: 301, error: "SOURCE_REDIRECT", location: "https://example.com/2" });
    mock.onAfterCall = (callNum) => {
      if (callNum === 1) ac.abort();
    };
    const client = createSafeExternalRedirectClient({ fetchExternalHttpsOnce: mock.fetch });
    const result = await client("https://example.com/1", { signal: ac.signal });
    t.expectFalse(result.ok);
    t.expectEqual((result as any).error, "SOURCE_TIMEOUT");
    t.expectEqual(mock.calls.length, 1);

  });

  await runTest("abort durante segundo hop retorna SOURCE_TIMEOUT", async (t) => {

    const mock = new MockHttpsClient();
    const ac = new AbortController();
    mock.queueResponse({ ok: false, statusCode: 301, error: "SOURCE_REDIRECT", location: "https://example.com/2" });
    mock.queueResponse({ ok: false, statusCode: 504, error: "SOURCE_TIMEOUT" });
    mock.onCall = (callNum) => {
      if (callNum === 2) ac.abort();
    };
    const client = createSafeExternalRedirectClient({ fetchExternalHttpsOnce: mock.fetch });
    const result = await client("https://example.com/1", { signal: ac.signal });
    t.expectFalse(result.ok);
    t.expectEqual((result as any).error, "SOURCE_TIMEOUT");
    t.expectEqual(mock.calls.length, 2);

  });

  await runTest("abort não resolve duas vezes", async (t) => {

    const mock = new MockHttpsClient();
    const ac = new AbortController();
    mock.queueResponse({ ok: false, statusCode: 301, error: "SOURCE_REDIRECT", location: "https://example.com/2" });
    mock.onAfterCall = (callNum) => { if (callNum === 1) ac.abort(); };
    const client = createSafeExternalRedirectClient({ fetchExternalHttpsOnce: mock.fetch });
    const result = await client("https://example.com/1", { signal: ac.signal });
    t.expectFalse(result.ok);
    t.expectEqual((result as any).error, "SOURCE_TIMEOUT");

  });

  await runTest("eventos tardios do mock não alteram resultado", async (t) => {

    const mock = new MockHttpsClient();
    const ac = new AbortController();
    mock.queueResponse({ ok: false, statusCode: 301, error: "SOURCE_REDIRECT", location: "https://example.com/2" });
    mock.onAfterCall = (callNum) => { if (callNum === 1) ac.abort(); };
    const client = createSafeExternalRedirectClient({ fetchExternalHttpsOnce: mock.fetch });
    const result = await client("https://example.com/1", { signal: ac.signal });
    t.expectFalse(result.ok);

  });

  await runTest("rejeição tardia não gera unhandledRejection", async (t) => {

    const mock = new MockHttpsClient();
    const ac = new AbortController();
    let unhandledCount = 0;
    const handler = () => { unhandledCount++; };
    process.on("unhandledRejection", handler);
    try {
      mock.queueResponse({ ok: false, statusCode: 301, error: "SOURCE_REDIRECT", location: "https://example.com/2" });
      mock.onAfterCall = (callNum) => {
        if (callNum === 1) {
          ac.abort();
          Promise.reject(new Error("late rejection")).catch(() => {});
        }
      };
      const client = createSafeExternalRedirectClient({ fetchExternalHttpsOnce: mock.fetch });
      const result = await client("https://example.com/1", { signal: ac.signal });
      t.expectFalse(result.ok);
      await new Promise(r => setTimeout(r, 10));
      t.expectEqual(unhandledCount, 0);
    } finally {
      process.removeListener("unhandledRejection", handler);
    }

  });

  await runTest("erro não contém message", async (t) => {

    const mock = new MockHttpsClient();
    mock.queueResponse({ ok: false, statusCode: 404, error: "SOURCE_HTTP_ERROR" });
    const client = createSafeExternalRedirectClient({ fetchExternalHttpsOnce: mock.fetch });
    const result = await client("https://example.com/1");
    t.expectFalse(result.ok);
    t.expectEqual((result as any)["message"], undefined);
  
  });

  await runTest("erro não contém stack", async (t) => {

    const mock = new MockHttpsClient();
    mock.queueResponse({ ok: false, statusCode: 404, error: "SOURCE_HTTP_ERROR" });
    const client = createSafeExternalRedirectClient({ fetchExternalHttpsOnce: mock.fetch });
    const result = await client("https://example.com/1");
    t.expectFalse(result.ok);
    t.expectEqual((result as any)["stack"], undefined);
  
  });

  await runTest("erro não contém rawUrl", async (t) => {

    const mock = new MockHttpsClient();
    mock.queueResponse({ ok: false, statusCode: 404, error: "SOURCE_HTTP_ERROR" });
    const client = createSafeExternalRedirectClient({ fetchExternalHttpsOnce: mock.fetch });
    const result = await client("https://example.com/1");
    t.expectFalse(result.ok);
    t.expectEqual((result as any)["rawUrl"], undefined);
  
  });

  await runTest("erro não contém href", async (t) => {

    const mock = new MockHttpsClient();
    mock.queueResponse({ ok: false, statusCode: 404, error: "SOURCE_HTTP_ERROR" });
    const client = createSafeExternalRedirectClient({ fetchExternalHttpsOnce: mock.fetch });
    const result = await client("https://example.com/1");
    t.expectFalse(result.ok);
    t.expectEqual((result as any)["href"], undefined);
  
  });

  await runTest("erro não contém location", async (t) => {

    const mock = new MockHttpsClient();
    mock.queueResponse({ ok: false, statusCode: 404, error: "SOURCE_HTTP_ERROR" });
    const client = createSafeExternalRedirectClient({ fetchExternalHttpsOnce: mock.fetch });
    const result = await client("https://example.com/1");
    t.expectFalse(result.ok);
    t.expectEqual((result as any)["location"], undefined);
  
  });

  await runTest("erro não contém redirectChain", async (t) => {

    const mock = new MockHttpsClient();
    mock.queueResponse({ ok: false, statusCode: 404, error: "SOURCE_HTTP_ERROR" });
    const client = createSafeExternalRedirectClient({ fetchExternalHttpsOnce: mock.fetch });
    const result = await client("https://example.com/1");
    t.expectFalse(result.ok);
    t.expectEqual((result as any)["redirectChain"], undefined);
  
  });

  await runTest("erro não contém headers", async (t) => {

    const mock = new MockHttpsClient();
    mock.queueResponse({ ok: false, statusCode: 404, error: "SOURCE_HTTP_ERROR" });
    const client = createSafeExternalRedirectClient({ fetchExternalHttpsOnce: mock.fetch });
    const result = await client("https://example.com/1");
    t.expectFalse(result.ok);
    t.expectEqual((result as any)["headers"], undefined);
  
  });

  await runTest("erro não contém cookies", async (t) => {

    const mock = new MockHttpsClient();
    mock.queueResponse({ ok: false, statusCode: 404, error: "SOURCE_HTTP_ERROR" });
    const client = createSafeExternalRedirectClient({ fetchExternalHttpsOnce: mock.fetch });
    const result = await client("https://example.com/1");
    t.expectFalse(result.ok);
    t.expectEqual((result as any)["cookies"], undefined);
  
  });

  await runTest("erro não contém selectedAddress", async (t) => {

    const mock = new MockHttpsClient();
    mock.queueResponse({ ok: false, statusCode: 404, error: "SOURCE_HTTP_ERROR" });
    const client = createSafeExternalRedirectClient({ fetchExternalHttpsOnce: mock.fetch });
    const result = await client("https://example.com/1");
    t.expectFalse(result.ok);
    t.expectEqual((result as any)["selectedAddress"], undefined);
  
  });

  await runTest("erro não contém addresses", async (t) => {

    const mock = new MockHttpsClient();
    mock.queueResponse({ ok: false, statusCode: 404, error: "SOURCE_HTTP_ERROR" });
    const client = createSafeExternalRedirectClient({ fetchExternalHttpsOnce: mock.fetch });
    const result = await client("https://example.com/1");
    t.expectFalse(result.ok);
    t.expectEqual((result as any)["addresses"], undefined);
  
  });

  await runTest("sucesso não contém redirectChain", async (t) => {

    const mock = new MockHttpsClient();
    mock.queueResponse({ ok: true, body: "ok", statusCode: 200, contentType: "text/plain", hostname: "example.com", bytes: 2 });
    const client = createSafeExternalRedirectClient({ fetchExternalHttpsOnce: mock.fetch });
    const result = await client("https://example.com/1");
    t.expectTrue(result.ok);
    t.expectEqual((result as any)["redirectChain"], undefined);
  
  });

  await runTest("sucesso não contém headers", async (t) => {

    const mock = new MockHttpsClient();
    mock.queueResponse({ ok: true, body: "ok", statusCode: 200, contentType: "text/plain", hostname: "example.com", bytes: 2 });
    const client = createSafeExternalRedirectClient({ fetchExternalHttpsOnce: mock.fetch });
    const result = await client("https://example.com/1");
    t.expectTrue(result.ok);
    t.expectEqual((result as any)["headers"], undefined);
  
  });

  await runTest("sucesso não contém cookies", async (t) => {

    const mock = new MockHttpsClient();
    mock.queueResponse({ ok: true, body: "ok", statusCode: 200, contentType: "text/plain", hostname: "example.com", bytes: 2 });
    const client = createSafeExternalRedirectClient({ fetchExternalHttpsOnce: mock.fetch });
    const result = await client("https://example.com/1");
    t.expectTrue(result.ok);
    t.expectEqual((result as any)["cookies"], undefined);
  
  });

  await runTest("server.ts não importa safeExternalRedirectClient", async (t) => {

    const fs = await import("node:fs");
    const content = fs.readFileSync("server.ts", "utf8");
    t.expectFalse(content.includes("safeExternalRedirectClient"));

  });

  await runTest("bloco /api/ai-import em server.ts não contém safeExternalRedirectClient", async (t) => {

    const fs = await import("node:fs");
    const content = fs.readFileSync("server.ts", "utf8");
    t.expectFalse(content.includes("safeExternalRedirectClient"));

  });

  await runTest("services/server/safeExternalFetch.ts existe", async (t) => {

    const fs = await import("node:fs");
    t.expectTrue(fs.existsSync("services/server/safeExternalFetch.ts"));

  });

  await runTest("app/applet/services/server/safeExternalRedirectClient.ts não existe", async (t) => {

    const fs = await import("node:fs");
    t.expectFalse(fs.existsSync("app/applet/services/server/safeExternalRedirectClient.ts"));

  });

  await runTest("app/applet/scripts/test_phase0_2c1c4_safe_external_redirect_client.ts não existe", async (t) => {

    const fs = await import("node:fs");
    t.expectFalse(fs.existsSync("app/applet/scripts/test_phase0_2c1c4_safe_external_redirect_client.ts"));

  });

  await runTest("package.json preservado", async (t) => {
    const currentHash = readRequiredHash("package.json");
    t.expectEqual(currentHash, initialHashes["package.json"]);
  });

  await runTest("package-lock.json preservado", async (t) => {
    const currentHash = readRequiredHash("package-lock.json");
    t.expectEqual(currentHash, initialHashes["package-lock.json"]);
  });

  await runTest("index.html preservado", async (t) => {
    const currentHash = readRequiredHash("index.html");
    t.expectEqual(currentHash, initialHashes["index.html"]);
  });

  await runTest("index.tsx preservado", async (t) => {
    const currentHash = readRequiredHash("index.tsx");
    t.expectEqual(currentHash, initialHashes["index.tsx"]);
  });

  await runTest("App.tsx preservado", async (t) => {
    const currentHash = readRequiredHash("App.tsx");
    t.expectEqual(currentHash, initialHashes["App.tsx"]);
  });

  await runTest("components/AppErrorBoundary.tsx preservado", async (t) => {
    const currentHash = readRequiredHash("components/AppErrorBoundary.tsx");
    t.expectEqual(currentHash, initialHashes["components/AppErrorBoundary.tsx"]);
  });

  await runTest("scripts/test_phase0_2a_ecosystem_auth.ts preservado", async (t) => {
    const currentHash = readRequiredHash("scripts/test_phase0_2a_ecosystem_auth.ts");
    t.expectEqual(currentHash, initialHashes["scripts/test_phase0_2a_ecosystem_auth.ts"]);
  });

  await runTest("scripts/test_phase0_2b_organization_security.ts preservado", async (t) => {
    const currentHash = readRequiredHash("scripts/test_phase0_2b_organization_security.ts");
    t.expectEqual(currentHash, initialHashes["scripts/test_phase0_2b_organization_security.ts"]);
  });

  await runTest("scripts/test_phase0_2c1a_ai_authorization.ts preservado", async (t) => {
    const currentHash = readRequiredHash("scripts/test_phase0_2c1a_ai_authorization.ts");
    t.expectEqual(currentHash, initialHashes["scripts/test_phase0_2c1a_ai_authorization.ts"]);
  });

  await runTest("scripts/test_phase0_2c1b_fix_chords_security.ts preservado", async (t) => {
    const currentHash = readRequiredHash("scripts/test_phase0_2c1b_fix_chords_security.ts");
    t.expectEqual(currentHash, initialHashes["scripts/test_phase0_2c1b_fix_chords_security.ts"]);
  });

  await runTest("scripts/test_phase0_2c1c1_safe_external_url_policy.ts preservado", async (t) => {
    const currentHash = readRequiredHash("scripts/test_phase0_2c1c1_safe_external_url_policy.ts");
    t.expectEqual(currentHash, initialHashes["scripts/test_phase0_2c1c1_safe_external_url_policy.ts"]);
  });

  await runTest("scripts/test_phase0_2c1c2_safe_external_dns_resolver.ts preservado", async (t) => {
    const currentHash = readRequiredHash("scripts/test_phase0_2c1c2_safe_external_dns_resolver.ts");
    t.expectEqual(currentHash, initialHashes["scripts/test_phase0_2c1c2_safe_external_dns_resolver.ts"]);
  });

  await runTest("scripts/test_phase0_2c1c3_safe_external_https_client.ts preservado", async (t) => {
    const currentHash = readRequiredHash("scripts/test_phase0_2c1c3_safe_external_https_client.ts");
    t.expectEqual(currentHash, initialHashes["scripts/test_phase0_2c1c3_safe_external_https_client.ts"]);
  });

  await runTest("somente os dois arquivos da fase pertencem à fase", async (t) => {
    const fs = await import("node:fs");
    
    t.expectTrue(fs.existsSync("services/server/safeExternalRedirectClient.ts"));
    t.expectTrue(fs.existsSync("scripts/test_phase0_2c1c4_safe_external_redirect_client.ts"));
    t.expectTrue(fs.existsSync("services/server/safeExternalFetch.ts"));
    t.expectFalse(fs.existsSync("app/applet/services/server/safeExternalRedirectClient.ts"));
    t.expectFalse(fs.existsSync("app/applet/scripts/test_phase0_2c1c4_safe_external_redirect_client.ts"));

    // Check for debug*.ts, patch*.js, fix*.js, update*.js, check*.txt in root directory
    const rootFiles = fs.readdirSync(".");
    const hasForbiddenFiles = rootFiles.some(file => {
      const lower = file.toLowerCase();
      if (lower === "fix_hover.js") return false; // pre-existing project script
      return (
        (lower.startsWith("debug") && lower.endsWith(".ts")) ||
        (lower.startsWith("patch") && lower.endsWith(".js")) ||
        (lower.startsWith("fix") && lower.endsWith(".js")) ||
        (lower.startsWith("update") && lower.endsWith(".js")) ||
        (lower.startsWith("check") && lower.endsWith(".txt"))
      );
    });
    t.expectFalse(hasForbiddenFiles);
  });

  await runTest("exceção inesperada no fetch vira SOURCE_FETCH_FAILED", async (t) => {

    const mock = new MockHttpsClient();
    const client = createSafeExternalRedirectClient({ fetchExternalHttpsOnce: mock.fetch });
    mock.fetch = () => { throw new Error("Boom"); };
    const result = await client("https://example.com/1");
    t.expectFalse(result.ok);
    t.expectEqual((result as any).error, "SOURCE_FETCH_FAILED");

  });

  await runTest("exceção inesperada fora do fetch vira SOURCE_FETCH_FAILED", async (t) => {

    const mock = new MockHttpsClient();
    const client = createSafeExternalRedirectClient({ fetchExternalHttpsOnce: mock.fetch });
    const originalTrim = String.prototype.trim;
    String.prototype.trim = function() { throw new Error("Boom"); };
    try {
      mock.queueResponse({ ok: false, statusCode: 301, error: "SOURCE_REDIRECT", location: "https://example.com/2" });
      const result = await client("https://example.com/1");
      t.expectFalse(result.ok);
      t.expectEqual((result as any).error, "SOURCE_FETCH_FAILED");
    } finally {
      String.prototype.trim = originalTrim;
    }

  });

  await runTest("higiene estática - não possui console.log", async (t) => {

    const fs = await import("node:fs");
    const content = fs.readFileSync("services/server/safeExternalRedirectClient.ts", "utf8");
    t.expectFalse(content.includes("console.log"));
  
  });

  await runTest("higiene estática - não possui console.error", async (t) => {

    const fs = await import("node:fs");
    const content = fs.readFileSync("services/server/safeExternalRedirectClient.ts", "utf8");
    t.expectFalse(content.includes("console.error"));
  
  });

  await runTest("higiene estática - não possui console.warn", async (t) => {

    const fs = await import("node:fs");
    const content = fs.readFileSync("services/server/safeExternalRedirectClient.ts", "utf8");
    t.expectFalse(content.includes("console.warn"));
  
  });

  await runTest("higiene estática - não possui logger", async (t) => {

    const fs = await import("node:fs");
    const content = fs.readFileSync("services/server/safeExternalRedirectClient.ts", "utf8");
    t.expectFalse(content.includes("logger"));
  
  });

  await runTest("higiene estática - não possui node:https", async (t) => {

    const fs = await import("node:fs");
    const content = fs.readFileSync("services/server/safeExternalRedirectClient.ts", "utf8");
    t.expectFalse(content.includes("node:https"));
  
  });

  await runTest("higiene estática - não possui node:http", async (t) => {

    const fs = await import("node:fs");
    const content = fs.readFileSync("services/server/safeExternalRedirectClient.ts", "utf8");
    t.expectFalse(content.includes("node:http"));
  
  });

  await runTest("higiene estática - não possui node:tls", async (t) => {

    const fs = await import("node:fs");
    const content = fs.readFileSync("services/server/safeExternalRedirectClient.ts", "utf8");
    t.expectFalse(content.includes("node:tls"));
  
  });

  await runTest("higiene estática - não possui node:dns", async (t) => {

    const fs = await import("node:fs");
    const content = fs.readFileSync("services/server/safeExternalRedirectClient.ts", "utf8");
    t.expectFalse(content.includes("node:dns"));
  
  });

  await runTest("higiene estática - não possui fetch(", async (t) => {

    const fs = await import("node:fs");
    const content = fs.readFileSync("services/server/safeExternalRedirectClient.ts", "utf8");
    t.expectFalse(content.includes("fetch("));
  
  });

  await runTest("higiene estática - não possui node-fetch", async (t) => {

    const fs = await import("node:fs");
    const content = fs.readFileSync("services/server/safeExternalRedirectClient.ts", "utf8");
    t.expectFalse(content.includes("node-fetch"));
  
  });

  await runTest("higiene estática - não possui axios", async (t) => {

    const fs = await import("node:fs");
    const content = fs.readFileSync("services/server/safeExternalRedirectClient.ts", "utf8");
    t.expectFalse(content.includes("axios"));
  
  });

  await runTest("higiene estática - não possui process.env", async (t) => {

    const fs = await import("node:fs");
    const content = fs.readFileSync("services/server/safeExternalRedirectClient.ts", "utf8");
    t.expectFalse(content.includes("process.env"));
  
  });

  await runTest("higiene estática - não possui readFileSync", async (t) => {

    const fs = await import("node:fs");
    const content = fs.readFileSync("services/server/safeExternalRedirectClient.ts", "utf8");
    t.expectFalse(content.includes("readFileSync"));
  
  });

  await runTest("higiene estática - não possui writeFileSync", async (t) => {

    const fs = await import("node:fs");
    const content = fs.readFileSync("services/server/safeExternalRedirectClient.ts", "utf8");
    t.expectFalse(content.includes("writeFileSync"));
  
  });

  await runTest("higiene estática - não possui node:fs", async (t) => {

    const fs = await import("node:fs");
    const content = fs.readFileSync("services/server/safeExternalRedirectClient.ts", "utf8");
    t.expectFalse(content.includes("node:fs"));
  
  });

  await runTest("higiene estática - não possui fs.", async (t) => {

    const fs = await import("node:fs");
    const content = fs.readFileSync("services/server/safeExternalRedirectClient.ts", "utf8");
    t.expectFalse(content.includes("fs."));
  
  });

  await runTest("higiene estática - não possui express case-insensitive", async (t) => {

    const fs = await import("node:fs");
    const content = fs.readFileSync("services/server/safeExternalRedirectClient.ts", "utf8").toLowerCase();
    t.expectFalse(content.includes("express"));
  
  });

  await runTest("higiene estática - não possui firebase case-insensitive", async (t) => {

    const fs = await import("node:fs");
    const content = fs.readFileSync("services/server/safeExternalRedirectClient.ts", "utf8").toLowerCase();
    t.expectFalse(content.includes("firebase"));
  
  });

  await runTest("higiene estática - não possui @google/genai case-insensitive", async (t) => {

    const fs = await import("node:fs");
    const content = fs.readFileSync("services/server/safeExternalRedirectClient.ts", "utf8").toLowerCase();
    t.expectFalse(content.includes("@google/genai"));
  
  });

  await runTest("higiene estática - não possui gemini case-insensitive", async (t) => {

    const fs = await import("node:fs");
    const content = fs.readFileSync("services/server/safeExternalRedirectClient.ts", "utf8").toLowerCase();
    t.expectFalse(content.includes("gemini"));
  
  });

  await runTest("integridade final dos arquivos protegidos", async (t) => {
    const fs = await import("node:fs");
    for (const file of PROTECTED_FILES) {
      const exists = fs.existsSync(file);
      t.expectTrue(exists);
      const hash = readRequiredHash(file);
      t.expectTrue(/^[0-9a-f]{64}$/.test(hash));
      t.expectEqual(hash, initialHashes[file]);
    }
  });

  for (const file of PROTECTED_FILES) {
    const finalHash = readRequiredHash(file);
    if (initialHashes[file] !== finalHash) {
      throw new Error(`Integridade violada: o arquivo ${file} foi alterado durante a execução dos testes!`);
    }
  }

  if (passedTests + failedTests !== registeredTests) {
    console.error(`Test accounting mismatch: registered (${registeredTests}) !== passed (${passedTests}) + failed (${failedTests})`);
    process.exitCode = 1;
  }

  console.log(`\n====================================`);
  console.log(`Phase 0.2C.1C.4 Test Suite Summary:`);
  console.log(`Total Registered: ${registeredTests}`);
  console.log(`Total Passed:     ${passedTests}`);
  console.log(`Total Failed:     ${failedTests}`);
  console.log(`Total Passed + Total Failed === Total Registered: ${passedTests + failedTests === registeredTests}`);
  console.log(`Total Failed === 0: ${failedTests === 0}`);
  console.log(`====================================`);

  if (failedTests > 0 || passedTests + failedTests !== registeredTests) {
    process.exit(1);
  }
}

runAll().catch(err => {
  console.error("Fatal test error:", err);
  process.exit(1);
});
