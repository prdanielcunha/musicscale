import { createSafeExternalHttpsClient } from "../services/server/safeExternalHttpsClient.js";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { createHash } from "crypto";

const FILES = [
  "index.html",
  "index.tsx",
  "App.tsx",
  "components/AppErrorBoundary.tsx",
  "server.ts",
  "services/server/safeExternalUrlPolicy.ts",
  "services/server/safeExternalDnsResolver.ts",
  "services/server/aiRequestSecurity.ts",
  "services/server/fixChordsHandler.ts",
  "scripts/test_phase0_2a_ecosystem_auth.ts",
  "scripts/test_phase0_2b_organization_security.ts",
  "scripts/test_phase0_2c1a_ai_authorization.ts",
  "scripts/test_phase0_2c1b_fix_chords_security.ts",
  "scripts/test_phase0_2c1c1_safe_external_url_policy.ts",
  "scripts/test_phase0_2c1c2_safe_external_dns_resolver.ts",
  "package.json",
  "package-lock.json"
];

const initialHashes = new Map<string, string>();
for (const file of FILES) {
  const fullPath = join(process.cwd(), file);
  if (!existsSync(fullPath)) throw new Error(`Arquivo protegido não existe: ${file}`);
  const hash = createHash("sha256").update(readFileSync(fullPath)).digest("hex");
  initialHashes.set(file, hash);
}

let registered = 0, passed = 0, failed = 0;

interface AssertHelper {
  ok(value: unknown, message?: string): void;
  strictEqual(actual: unknown, expected: unknown, message?: string): void;
  deepStrictEqual(actual: unknown, expected: unknown, message?: string): void;
}

async function test(
  name: string,
  fn: (assert: AssertHelper) => Promise<void> | void
): Promise<void> {
  registered++;
  let assertionCount = 0;

  const localAssert = {
    ok(value: unknown, message?: string) {
      assertionCount++;
      if (!value) {
        throw new Error(message || "Assertion failed");
      }
    },
    strictEqual(actual: unknown, expected: unknown, message?: string) {
      assertionCount++;
      if (actual !== expected) {
        throw new Error(`${message || "Equality failed"}: ${String(actual)} !== ${String(expected)}`);
      }
    },
    deepStrictEqual(actual: unknown, expected: unknown, message?: string) {
      assertionCount++;
      const actualJson = JSON.stringify(actual);
      const expectedJson = JSON.stringify(expected);
      if (actualJson !== expectedJson) {
        throw new Error(`${message || "Deep equality failed"}: ${actualJson} !== ${expectedJson}`);
      }
    }
  };

  try {
    await fn(localAssert);
    if (assertionCount === 0) {
      throw new Error("No assertions made in test");
    }
    passed++;
    console.log(`[PASS] ${name}`);
  } catch (error: any) {
    failed++;
    console.log(`[FAIL] ${name}\n       ${error.message}`);
  }
}

function createMockResolver() {
  let calls = 0;
  let lastHostname = "";
  let result: any = {
    ok: true,
    hostname: "example.com",
    addresses: [{ address: "93.184.216.34", family: 4 }],
    selectedAddress: { address: "93.184.216.34", family: 4 }
  };

  const resolve = async (hostname: string, options?: any) => {
    calls++;
    lastHostname = hostname;
    if (result instanceof Error) {
      throw result;
    }
    return result;
  };

  return {
    resolve,
    getCalls: () => calls,
    getLastHostname: () => lastHostname,
    setResult: (res: any) => { result = res; }
  };
}

class MockClientRequest {
  options: any;
  callback: any;
  destroyed = false;
  destroyCalls = 0;
  endCalls = 0;
  listeners: { [key: string]: any[] } = {};

  constructor(options: any, callback: any) {
    this.options = options;
    this.callback = callback;
  }

  on(event: string, cb: any) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(cb);
    return this;
  }

  destroy() {
    this.destroyed = true;
    this.destroyCalls++;
  }

  end() {
    this.endCalls++;
  }

  triggerError(err: Error) {
    const list = this.listeners["error"] || [];
    for (const cb of list) {
      cb(err);
    }
  }
}

class MockIncomingMessage {
  statusCode: number;
  headers: any;
  listeners: { [key: string]: any[] } = {};
  destroyed = false;
  destroyCalls = 0;

  constructor(statusCode: number, headers: any) {
    this.statusCode = statusCode;
    this.headers = headers;
  }

  on(event: string, cb: any) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(cb);
    return this;
  }

  destroy() {
    this.destroyed = true;
    this.destroyCalls++;
  }

  triggerData(chunk: any) {
    const list = this.listeners["data"] || [];
    for (const cb of list) {
      cb(chunk);
    }
  }

  triggerEnd() {
    const list = this.listeners["end"] || [];
    for (const cb of list) {
      cb();
    }
  }

  triggerError(err: Error) {
    const list = this.listeners["error"] || [];
    for (const cb of list) {
      cb(err);
    }
  }
}

function createMockRequestHttps() {
  let lastOptions: any = null;
  let reqInstance: MockClientRequest | null = null;
  let resInstance: MockIncomingMessage | null = null;

  const request = (options: any, callback: any) => {
    lastOptions = options;
    reqInstance = new MockClientRequest(options, callback);
    return reqInstance as any;
  };

  return {
    request,
    getLastOptions: () => lastOptions,
    getReqInstance: () => reqInstance,
    getResInstance: () => resInstance,
    respond: (statusCode: number, headers: any) => {
      resInstance = new MockIncomingMessage(statusCode, headers);
      if (reqInstance && reqInstance.callback) {
        reqInstance.callback(resInstance);
      }
      return resInstance;
    }
  };
}

class MockAbortSignal {
  listeners = new Set<() => void>();
  aborted = false;

  addEventListener(event: string, listener: any) {
    if (event === "abort") {
      this.listeners.add(listener);
    }
  }

  removeEventListener(event: string, listener: any) {
    if (event === "abort") {
      this.listeners.delete(listener);
    }
  }

  abort() {
    this.aborted = true;
    for (const listener of this.listeners) {
      try {
        listener();
      } catch {}
    }
  }
}

async function runAllTests() {
  // --- CORREÇÃO 1 — PORTA SEMPRE 443 (4 tests) ---
  await test("CORREÇÃO 1.1: URL https://example.com:443 usa porta 443", async (assert) => {
    const r = createMockResolver();
    const h = createMockRequestHttps();
    const client = createSafeExternalHttpsClient({ resolveSafeExternalHost: r.resolve, requestHttps: h.request });
    const p = client("https://example.com:443");
    await Promise.resolve();
    const reqOpts = h.getLastOptions();
    assert.ok(reqOpts !== null);
    assert.strictEqual(reqOpts.port, 443);
  });

  await test("CORREÇÃO 1.2: Nenhuma URL pode fazer request com porta diferente no options", async (assert) => {
    const r = createMockResolver();
    const h = createMockRequestHttps();
    const client = createSafeExternalHttpsClient({ resolveSafeExternalHost: r.resolve, requestHttps: h.request });
    const p = client("https://example.com:443");
    await Promise.resolve();
    const reqOpts = h.getLastOptions();
    assert.ok(reqOpts !== null);
    assert.strictEqual(reqOpts.port, 443);
  });

  await test("CORREÇÃO 1.3: Request options.port === 443 se porta estiver ausente na URL", async (assert) => {
    const r = createMockResolver();
    const h = createMockRequestHttps();
    const client = createSafeExternalHttpsClient({ resolveSafeExternalHost: r.resolve, requestHttps: h.request });
    const p = client("https://example.com");
    await Promise.resolve();
    const reqOpts = h.getLastOptions();
    assert.ok(reqOpts !== null);
    assert.strictEqual(reqOpts.port, 443);
  });

  await test("CORREÇÃO 1.4: URL sem porta explícita usa porta 443", async (assert) => {
    const r = createMockResolver();
    const h = createMockRequestHttps();
    const client = createSafeExternalHttpsClient({ resolveSafeExternalHost: r.resolve, requestHttps: h.request });
    const p = client("https://example.com/some/path");
    await Promise.resolve();
    const reqOpts = h.getLastOptions();
    assert.ok(reqOpts !== null);
    assert.strictEqual(reqOpts.port, 443);
  });

  // --- CORREÇÃO 2 — LOOKUP NÃO ACEITA OUTRO HOSTNAME (5 tests) ---
  await test("CORREÇÃO 2.1: Lookup com hostname correto devolve IP selecionado", async (assert) => {
    const r = createMockResolver();
    const h = createMockRequestHttps();
    const client = createSafeExternalHttpsClient({ resolveSafeExternalHost: r.resolve, requestHttps: h.request });
    const p = client("https://example.com");
    await Promise.resolve();
    const reqOpts = h.getLastOptions();
    assert.ok(reqOpts !== null);
    let resolvedIp = "";
    reqOpts.lookup("example.com", {}, (err: any, ip: string) => {
      resolvedIp = ip;
    });
    assert.strictEqual(resolvedIp, "93.184.216.34");
  });

  await test("CORREÇÃO 2.2: Lookup com hostname correto devolve família selecionada", async (assert) => {
    const r = createMockResolver();
    const h = createMockRequestHttps();
    const client = createSafeExternalHttpsClient({ resolveSafeExternalHost: r.resolve, requestHttps: h.request });
    const p = client("https://example.com");
    await Promise.resolve();
    const reqOpts = h.getLastOptions();
    assert.ok(reqOpts !== null);
    let resolvedFamily = 0;
    reqOpts.lookup("example.com", {}, (err: any, ip: string, family: number) => {
      resolvedFamily = family;
    });
    assert.strictEqual(resolvedFamily, 4);
  });

  await test("CORREÇÃO 2.3: Lookup com hostname diferente retorna erro", async (assert) => {
    const r = createMockResolver();
    const h = createMockRequestHttps();
    const client = createSafeExternalHttpsClient({ resolveSafeExternalHost: r.resolve, requestHttps: h.request });
    const p = client("https://example.com");
    await Promise.resolve();
    const reqOpts = h.getLastOptions();
    assert.ok(reqOpts !== null);
    let lookupErr: any = null;
    reqOpts.lookup("evil.com", {}, (err: any) => {
      lookupErr = err;
    });
    assert.ok(lookupErr !== null);
  });

  await test("CORREÇÃO 2.4: Lookup com hostname diferente não devolve IP", async (assert) => {
    const r = createMockResolver();
    const h = createMockRequestHttps();
    const client = createSafeExternalHttpsClient({ resolveSafeExternalHost: r.resolve, requestHttps: h.request });
    const p = client("https://example.com");
    await Promise.resolve();
    const reqOpts = h.getLastOptions();
    assert.ok(reqOpts !== null);
    let resolvedIp = "initial";
    reqOpts.lookup("evil.com", {}, (err: any, ip: string) => {
      resolvedIp = ip;
    });
    assert.strictEqual(resolvedIp, undefined);
  });

  await test("CORREÇÃO 2.5: Lookup não chama o DNS resolver novamente", async (assert) => {
    const r = createMockResolver();
    const h = createMockRequestHttps();
    const client = createSafeExternalHttpsClient({ resolveSafeExternalHost: r.resolve, requestHttps: h.request });
    const p = client("https://example.com");
    await Promise.resolve();
    const reqOpts = h.getLastOptions();
    assert.ok(reqOpts !== null);
    reqOpts.lookup("example.com", {}, () => {});
    assert.strictEqual(r.getCalls(), 1);
  });

  // --- CORREÇÃO 3 — CONTENT-LENGTH ESTRITO (12 tests) ---
  await test("CORREÇÃO 3.1: Content-Length de string decimal inteira válida '12345' é aceito", async (assert) => {
    const r = createMockResolver();
    const h = createMockRequestHttps();
    const client = createSafeExternalHttpsClient({ resolveSafeExternalHost: r.resolve, requestHttps: h.request });
    const p = client("https://example.com");
    await Promise.resolve();
    h.respond(200, { "content-type": "text/html", "content-length": "12345" });
    const resMsg = h.getResInstance();
    if (resMsg) resMsg.triggerEnd();
    const res = await p;
    assert.strictEqual(res.ok, true);
  });

  await test("CORREÇÃO 3.2: Content-Length igual a '0' é aceito", async (assert) => {
    const r = createMockResolver();
    const h = createMockRequestHttps();
    const client = createSafeExternalHttpsClient({ resolveSafeExternalHost: r.resolve, requestHttps: h.request });
    const p = client("https://example.com");
    await Promise.resolve();
    h.respond(200, { "content-type": "text/html", "content-length": "0" });
    const resMsg = h.getResInstance();
    if (resMsg) resMsg.triggerEnd();
    const res = await p;
    assert.strictEqual(res.ok, true);
  });

  await test("CORREÇÃO 3.3: Content-Length igual a exatamente '2097152' é aceito", async (assert) => {
    const r = createMockResolver();
    const h = createMockRequestHttps();
    const client = createSafeExternalHttpsClient({ resolveSafeExternalHost: r.resolve, requestHttps: h.request });
    const p = client("https://example.com");
    await Promise.resolve();
    h.respond(200, { "content-type": "text/html", "content-length": "2097152" });
    const resMsg = h.getResInstance();
    if (resMsg) resMsg.triggerEnd();
    const res = await p;
    assert.strictEqual(res.ok, true);
  });

  await test("CORREÇÃO 3.4: Content-Length vazio é rejeitado com SOURCE_FETCH_FAILED", async (assert) => {
    const r = createMockResolver();
    const h = createMockRequestHttps();
    const client = createSafeExternalHttpsClient({ resolveSafeExternalHost: r.resolve, requestHttps: h.request });
    const p = client("https://example.com");
    await Promise.resolve();
    h.respond(200, { "content-type": "text/html", "content-length": " " });
    const res = await p;
    assert.strictEqual(res.ok, false);
    assert.strictEqual((res as any).error, "SOURCE_FETCH_FAILED");
  });

  await test("CORREÇÃO 3.5: Content-Length negativo '-5' é rejeitado com SOURCE_FETCH_FAILED", async (assert) => {
    const r = createMockResolver();
    const h = createMockRequestHttps();
    const client = createSafeExternalHttpsClient({ resolveSafeExternalHost: r.resolve, requestHttps: h.request });
    const p = client("https://example.com");
    await Promise.resolve();
    h.respond(200, { "content-type": "text/html", "content-length": "-5" });
    const res = await p;
    assert.strictEqual(res.ok, false);
    assert.strictEqual((res as any).error, "SOURCE_FETCH_FAILED");
  });

  await test("CORREÇÃO 3.6: Content-Length decimal '123.45' é rejeitado com SOURCE_FETCH_FAILED", async (assert) => {
    const r = createMockResolver();
    const h = createMockRequestHttps();
    const client = createSafeExternalHttpsClient({ resolveSafeExternalHost: r.resolve, requestHttps: h.request });
    const p = client("https://example.com");
    await Promise.resolve();
    h.respond(200, { "content-type": "text/html", "content-length": "123.45" });
    const res = await p;
    assert.strictEqual(res.ok, false);
    assert.strictEqual((res as any).error, "SOURCE_FETCH_FAILED");
  });

  await test("CORREÇÃO 3.7: Content-Length '123abc' é rejeitado com SOURCE_FETCH_FAILED", async (assert) => {
    const r = createMockResolver();
    const h = createMockRequestHttps();
    const client = createSafeExternalHttpsClient({ resolveSafeExternalHost: r.resolve, requestHttps: h.request });
    const p = client("https://example.com");
    await Promise.resolve();
    h.respond(200, { "content-type": "text/html", "content-length": "123abc" });
    const res = await p;
    assert.strictEqual(res.ok, false);
    assert.strictEqual((res as any).error, "SOURCE_FETCH_FAILED");
  });

  await test("CORREÇÃO 3.8: Content-Length '1e3' é rejeitado com SOURCE_FETCH_FAILED", async (assert) => {
    const r = createMockResolver();
    const h = createMockRequestHttps();
    const client = createSafeExternalHttpsClient({ resolveSafeExternalHost: r.resolve, requestHttps: h.request });
    const p = client("https://example.com");
    await Promise.resolve();
    h.respond(200, { "content-type": "text/html", "content-length": "1e3" });
    const res = await p;
    assert.strictEqual(res.ok, false);
    assert.strictEqual((res as any).error, "SOURCE_FETCH_FAILED");
  });

  await test("CORREÇÃO 3.9: Content-Length NaN é rejeitado com SOURCE_FETCH_FAILED", async (assert) => {
    const r = createMockResolver();
    const h = createMockRequestHttps();
    const client = createSafeExternalHttpsClient({ resolveSafeExternalHost: r.resolve, requestHttps: h.request });
    const p = client("https://example.com");
    await Promise.resolve();
    h.respond(200, { "content-type": "text/html", "content-length": "NaN" });
    const res = await p;
    assert.strictEqual(res.ok, false);
    assert.strictEqual((res as any).error, "SOURCE_FETCH_FAILED");
  });

  await test("CORREÇÃO 3.10: Content-Length Infinity é rejeitado com SOURCE_FETCH_FAILED", async (assert) => {
    const r = createMockResolver();
    const h = createMockRequestHttps();
    const client = createSafeExternalHttpsClient({ resolveSafeExternalHost: r.resolve, requestHttps: h.request });
    const p = client("https://example.com");
    await Promise.resolve();
    h.respond(200, { "content-type": "text/html", "content-length": "Infinity" });
    const res = await p;
    assert.strictEqual(res.ok, false);
    assert.strictEqual((res as any).error, "SOURCE_FETCH_FAILED");
  });

  await test("CORREÇÃO 3.11: Content-Length array com valor inválido é rejeitado com SOURCE_FETCH_FAILED", async (assert) => {
    const r = createMockResolver();
    const h = createMockRequestHttps();
    const client = createSafeExternalHttpsClient({ resolveSafeExternalHost: r.resolve, requestHttps: h.request });
    const p = client("https://example.com");
    await Promise.resolve();
    h.respond(200, { "content-type": "text/html", "content-length": ["123abc"] as any });
    const res = await p;
    assert.strictEqual(res.ok, false);
    assert.strictEqual((res as any).error, "SOURCE_FETCH_FAILED");
  });

  await test("CORREÇÃO 3.12: Content-Length acima de 2MB é rejeitado com SOURCE_TOO_LARGE", async (assert) => {
    const r = createMockResolver();
    const h = createMockRequestHttps();
    const client = createSafeExternalHttpsClient({ resolveSafeExternalHost: r.resolve, requestHttps: h.request });
    const p = client("https://example.com");
    await Promise.resolve();
    h.respond(200, { "content-type": "text/html", "content-length": "2097153" });
    const res = await p;
    assert.strictEqual(res.ok, false);
    assert.strictEqual((res as any).error, "SOURCE_TOO_LARGE");
  });

  // --- CORREÇÃO 4 — CHUNKS DEVEM SER NORMALIZADOS PARA BUFFER (5 tests) ---
  await test("CORREÇÃO 4.1: Chunk string conta bytes UTF-8 corretamente", async (assert) => {
    const r = createMockResolver();
    const h = createMockRequestHttps();
    const client = createSafeExternalHttpsClient({ resolveSafeExternalHost: r.resolve, requestHttps: h.request });
    const p = client("https://example.com");
    await Promise.resolve();
    h.respond(200, { "content-type": "text/html" });
    const resMsg = h.getResInstance();
    if (resMsg) {
      resMsg.triggerData("café"); // 5 bytes in UTF-8
      resMsg.triggerEnd();
    }
    const res = await p;
    assert.strictEqual(res.ok, true);
    if (res.ok) {
      assert.strictEqual(res.bytes, 5);
      assert.strictEqual(res.body, "café");
    }
  });

  await test("CORREÇÃO 4.2: Chunk Buffer conta bytes corretamente", async (assert) => {
    const r = createMockResolver();
    const h = createMockRequestHttps();
    const client = createSafeExternalHttpsClient({ resolveSafeExternalHost: r.resolve, requestHttps: h.request });
    const p = client("https://example.com");
    await Promise.resolve();
    h.respond(200, { "content-type": "text/html" });
    const resMsg = h.getResInstance();
    if (resMsg) {
      resMsg.triggerData(Buffer.from([0x01, 0x02, 0x03]));
      resMsg.triggerEnd();
    }
    const res = await p;
    assert.strictEqual(res.ok, true);
    if (res.ok) {
      assert.strictEqual(res.bytes, 3);
    }
  });

  await test("CORREÇÃO 4.3: Chunk de tipo inválido retorna SOURCE_FETCH_FAILED", async (assert) => {
    const r = createMockResolver();
    const h = createMockRequestHttps();
    const client = createSafeExternalHttpsClient({ resolveSafeExternalHost: r.resolve, requestHttps: h.request });
    const p = client("https://example.com");
    await Promise.resolve();
    h.respond(200, { "content-type": "text/html" });
    const resMsg = h.getResInstance();
    if (resMsg) {
      resMsg.triggerData(12345 as any);
    }
    const res = await p;
    assert.strictEqual(res.ok, false);
    assert.strictEqual((res as any).error, "SOURCE_FETCH_FAILED");
  });

  await test("CORREÇÃO 4.4: Chunks são concatenados na ordem correta", async (assert) => {
    const r = createMockResolver();
    const h = createMockRequestHttps();
    const client = createSafeExternalHttpsClient({ resolveSafeExternalHost: r.resolve, requestHttps: h.request });
    const p = client("https://example.com");
    await Promise.resolve();
    h.respond(200, { "content-type": "text/html" });
    const resMsg = h.getResInstance();
    if (resMsg) {
      resMsg.triggerData("abc");
      resMsg.triggerData("def");
      resMsg.triggerEnd();
    }
    const res = await p;
    assert.strictEqual(res.ok, true);
    if (res.ok) {
      assert.strictEqual(res.body, "abcdef");
    }
  });

  await test("CORREÇÃO 4.5: Soma de bytes do resultado é igual ao total de bytes reais", async (assert) => {
    const r = createMockResolver();
    const h = createMockRequestHttps();
    const client = createSafeExternalHttpsClient({ resolveSafeExternalHost: r.resolve, requestHttps: h.request });
    const p = client("https://example.com");
    await Promise.resolve();
    h.respond(200, { "content-type": "text/html" });
    const resMsg = h.getResInstance();
    if (resMsg) {
      resMsg.triggerData(Buffer.alloc(100));
      resMsg.triggerData(Buffer.alloc(200));
      resMsg.triggerEnd();
    }
    const res = await p;
    assert.strictEqual(res.ok, true);
    if (res.ok) {
      assert.strictEqual(res.bytes, 300);
    }
  });

  // --- CORREÇÃO 5 — ABORT ROBUSTO COM EVENTOS TARDIOS (14 tests) ---
  await test("CORREÇÃO 5.1: Abort antes da validação da URL não chama DNS nem HTTPS", async (assert) => {
    const r = createMockResolver();
    const h = createMockRequestHttps();
    const client = createSafeExternalHttpsClient({ resolveSafeExternalHost: r.resolve, requestHttps: h.request });
    const sig = new MockAbortSignal();
    sig.abort();
    const res = await client("https://example.com", { signal: sig as any });
    assert.strictEqual(res.ok, false);
    assert.strictEqual((res as any).error, "SOURCE_TIMEOUT");
    assert.strictEqual(r.getCalls(), 0);
  });

  await test("CORREÇÃO 5.2: Abort durante DNS não chama HTTPS", async (assert) => {
    const r = createMockResolver();
    const h = createMockRequestHttps();
    const client = createSafeExternalHttpsClient({ resolveSafeExternalHost: r.resolve, requestHttps: h.request });
    const sig = new MockAbortSignal();
    const p = client("https://example.com", { signal: sig as any });
    sig.abort();
    const res = await p;
    assert.strictEqual(res.ok, false);
    assert.strictEqual((res as any).error, "SOURCE_TIMEOUT");
    assert.strictEqual(h.getLastOptions(), null);
  });

  await test("CORREÇÃO 5.3: Abort durante conexão destrói request", async (assert) => {
    const r = createMockResolver();
    const h = createMockRequestHttps();
    const client = createSafeExternalHttpsClient({ resolveSafeExternalHost: r.resolve, requestHttps: h.request });
    const sig = new MockAbortSignal();
    const p = client("https://example.com", { signal: sig as any });
    await Promise.resolve();
    sig.abort();
    const reqInstance = h.getReqInstance();
    assert.ok(reqInstance !== null);
    assert.strictEqual(reqInstance?.destroyed, true);
    const res = await p;
    assert.strictEqual(res.ok, false);
    assert.strictEqual((res as any).error, "SOURCE_TIMEOUT");
  });

  await test("CORREÇÃO 5.4: Abort durante recebimento de body destrói request e response", async (assert) => {
    const r = createMockResolver();
    const h = createMockRequestHttps();
    const client = createSafeExternalHttpsClient({ resolveSafeExternalHost: r.resolve, requestHttps: h.request });
    const sig = new MockAbortSignal();
    const p = client("https://example.com", { signal: sig as any });
    await Promise.resolve();
    h.respond(200, { "content-type": "text/html" });
    const resMsg = h.getResInstance();
    assert.ok(resMsg !== null);
    sig.abort();
    assert.strictEqual(resMsg?.destroyed, true);
    const res = await p;
    assert.strictEqual(res.ok, false);
  });

  await test("CORREÇÃO 5.5: Abort retorna status 504 e erro SOURCE_TIMEOUT", async (assert) => {
    const r = createMockResolver();
    const h = createMockRequestHttps();
    const client = createSafeExternalHttpsClient({ resolveSafeExternalHost: r.resolve, requestHttps: h.request });
    const sig = new MockAbortSignal();
    const p = client("https://example.com", { signal: sig as any });
    await Promise.resolve();
    sig.abort();
    const res = await p;
    assert.strictEqual(res.ok, false);
    assert.strictEqual(res.statusCode, 504);
    assert.strictEqual((res as any).error, "SOURCE_TIMEOUT");
  });

  await test("CORREÇÃO 5.6: Data tardio após abort não altera resultado", async (assert) => {
    const r = createMockResolver();
    const h = createMockRequestHttps();
    const client = createSafeExternalHttpsClient({ resolveSafeExternalHost: r.resolve, requestHttps: h.request });
    const sig = new MockAbortSignal();
    const p = client("https://example.com", { signal: sig as any });
    await Promise.resolve();
    h.respond(200, { "content-type": "text/html" });
    const resMsg = h.getResInstance();
    sig.abort();
    if (resMsg) {
      resMsg.triggerData("late data");
      resMsg.triggerEnd();
    }
    const res = await p;
    assert.strictEqual(res.ok, false);
    assert.strictEqual((res as any).error, "SOURCE_TIMEOUT");
  });

  await test("CORREÇÃO 5.7: End tardio após abort não altera resultado", async (assert) => {
    const r = createMockResolver();
    const h = createMockRequestHttps();
    const client = createSafeExternalHttpsClient({ resolveSafeExternalHost: r.resolve, requestHttps: h.request });
    const sig = new MockAbortSignal();
    const p = client("https://example.com", { signal: sig as any });
    await Promise.resolve();
    h.respond(200, { "content-type": "text/html" });
    const resMsg = h.getResInstance();
    sig.abort();
    if (resMsg) {
      resMsg.triggerEnd();
    }
    const res = await p;
    assert.strictEqual(res.ok, false);
    assert.strictEqual((res as any).error, "SOURCE_TIMEOUT");
  });

  await test("CORREÇÃO 5.8: Error tardio de response após abort não altera resultado", async (assert) => {
    const r = createMockResolver();
    const h = createMockRequestHttps();
    const client = createSafeExternalHttpsClient({ resolveSafeExternalHost: r.resolve, requestHttps: h.request });
    const sig = new MockAbortSignal();
    const p = client("https://example.com", { signal: sig as any });
    await Promise.resolve();
    h.respond(200, { "content-type": "text/html" });
    const resMsg = h.getResInstance();
    sig.abort();
    if (resMsg) {
      resMsg.triggerError(new Error("Late error"));
    }
    const res = await p;
    assert.strictEqual(res.ok, false);
    assert.strictEqual((res as any).error, "SOURCE_TIMEOUT");
  });

  await test("CORREÇÃO 5.9: Request error tardio após sucesso não altera resultado", async (assert) => {
    const r = createMockResolver();
    const h = createMockRequestHttps();
    const client = createSafeExternalHttpsClient({ resolveSafeExternalHost: r.resolve, requestHttps: h.request });
    const p = client("https://example.com");
    await Promise.resolve();
    h.respond(200, { "content-type": "text/html" });
    const resMsg = h.getResInstance();
    if (resMsg) {
      resMsg.triggerData("ok");
      resMsg.triggerEnd();
    }
    const reqInstance = h.getReqInstance();
    if (reqInstance) {
      reqInstance.triggerError(new Error("Late req error"));
    }
    const res = await p;
    assert.strictEqual(res.ok, true);
  });

  await test("CORREÇÃO 5.10: Response error tardio após sucesso não altera resultado", async (assert) => {
    const r = createMockResolver();
    const h = createMockRequestHttps();
    const client = createSafeExternalHttpsClient({ resolveSafeExternalHost: r.resolve, requestHttps: h.request });
    const p = client("https://example.com");
    await Promise.resolve();
    h.respond(200, { "content-type": "text/html" });
    const resMsg = h.getResInstance();
    if (resMsg) {
      resMsg.triggerData("ok");
      resMsg.triggerEnd();
      resMsg.triggerError(new Error("Late res error"));
    }
    const res = await p;
    assert.strictEqual(res.ok, true);
  });

  await test("CORREÇÃO 5.11: unhandledRejection não ocorre durante fluxos de erro tardios", async (assert) => {
    let unhandled = false;
    const handler = () => { unhandled = true; };
    process.on("unhandledRejection", handler);
    const r = createMockResolver();
    const h = createMockRequestHttps();
    const client = createSafeExternalHttpsClient({ resolveSafeExternalHost: r.resolve, requestHttps: h.request });
    const p = client("https://example.com");
    await Promise.resolve();
    h.respond(200, { "content-type": "text/html" });
    const resMsg = h.getResInstance();
    if (resMsg) {
      resMsg.triggerError(new Error("Trigger"));
      resMsg.triggerError(new Error("Late Trigger"));
    }
    await p;
    process.off("unhandledRejection", handler);
    assert.strictEqual(unhandled, false);
  });

  await test("CORREÇÃO 5.12: Listener de abort é removido após sucesso", async (assert) => {
    const r = createMockResolver();
    const h = createMockRequestHttps();
    const client = createSafeExternalHttpsClient({ resolveSafeExternalHost: r.resolve, requestHttps: h.request });
    const sig = new MockAbortSignal();
    const p = client("https://example.com", { signal: sig as any });
    await Promise.resolve();
    h.respond(200, { "content-type": "text/html" });
    const resMsg = h.getResInstance();
    if (resMsg) {
      resMsg.triggerEnd();
    }
    await p;
    assert.strictEqual(sig.listeners.size, 0);
  });

  await test("CORREÇÃO 5.13: Listener de abort é removido após erro de DNS", async (assert) => {
    const r = createMockResolver();
    r.setResult({ ok: false, statusCode: 502, error: "SOURCE_DNS_FAILED" });
    const h = createMockRequestHttps();
    const client = createSafeExternalHttpsClient({ resolveSafeExternalHost: r.resolve, requestHttps: h.request });
    const sig = new MockAbortSignal();
    const p = client("https://example.com", { signal: sig as any });
    await p;
    assert.strictEqual(sig.listeners.size, 0);
  });

  await test("CORREÇÃO 5.14: Listener de abort é removido após abort concluído", async (assert) => {
    const r = createMockResolver();
    const h = createMockRequestHttps();
    const client = createSafeExternalHttpsClient({ resolveSafeExternalHost: r.resolve, requestHttps: h.request });
    const sig = new MockAbortSignal();
    const p = client("https://example.com", { signal: sig as any });
    await Promise.resolve();
    sig.abort();
    await p;
    assert.strictEqual(sig.listeners.size, 0);
  });

  // --- CORREÇÃO 6 — TESTES DE STATUS SEPARADOS (15 tests) ---
  await test("CORREÇÃO 6.1: Status 404 retorna SOURCE_HTTP_ERROR", async (assert) => {
    const r = createMockResolver();
    const h = createMockRequestHttps();
    const client = createSafeExternalHttpsClient({ resolveSafeExternalHost: r.resolve, requestHttps: h.request });
    const p = client("https://example.com");
    await Promise.resolve();
    h.respond(404, { "content-type": "text/html" });
    const res = await p;
    assert.strictEqual(res.ok, false);
    assert.strictEqual((res as any).error, "SOURCE_HTTP_ERROR");
  });

  await test("CORREÇÃO 6.2: Status 500 retorna SOURCE_HTTP_ERROR", async (assert) => {
    const r = createMockResolver();
    const h = createMockRequestHttps();
    const client = createSafeExternalHttpsClient({ resolveSafeExternalHost: r.resolve, requestHttps: h.request });
    const p = client("https://example.com");
    await Promise.resolve();
    h.respond(500, { "content-type": "text/html" });
    const res = await p;
    assert.strictEqual(res.ok, false);
    assert.strictEqual((res as any).error, "SOURCE_HTTP_ERROR");
  });

  await test("CORREÇÃO 6.3: Status 301 com Location válido retorna SOURCE_REDIRECT", async (assert) => {
    const r = createMockResolver();
    const h = createMockRequestHttps();
    const client = createSafeExternalHttpsClient({ resolveSafeExternalHost: r.resolve, requestHttps: h.request });
    const p = client("https://example.com");
    await Promise.resolve();
    h.respond(301, { "content-type": "text/html", "location": "https://secure.example.com" });
    const res = await p;
    assert.strictEqual(res.ok, false);
    assert.strictEqual((res as any).error, "SOURCE_REDIRECT");
    assert.strictEqual((res as any).location, "https://secure.example.com");
  });

  await test("CORREÇÃO 6.4: Status 302 com Location válido retorna SOURCE_REDIRECT", async (assert) => {
    const r = createMockResolver();
    const h = createMockRequestHttps();
    const client = createSafeExternalHttpsClient({ resolveSafeExternalHost: r.resolve, requestHttps: h.request });
    const p = client("https://example.com");
    await Promise.resolve();
    h.respond(302, { "content-type": "text/html", "location": "https://secure.example.com" });
    const res = await p;
    assert.strictEqual(res.ok, false);
    assert.strictEqual((res as any).error, "SOURCE_REDIRECT");
  });

  await test("CORREÇÃO 6.5: Status 303 com Location válido retorna SOURCE_REDIRECT", async (assert) => {
    const r = createMockResolver();
    const h = createMockRequestHttps();
    const client = createSafeExternalHttpsClient({ resolveSafeExternalHost: r.resolve, requestHttps: h.request });
    const p = client("https://example.com");
    await Promise.resolve();
    h.respond(303, { "content-type": "text/html", "location": "https://secure.example.com" });
    const res = await p;
    assert.strictEqual(res.ok, false);
    assert.strictEqual((res as any).error, "SOURCE_REDIRECT");
  });

  await test("CORREÇÃO 6.6: Status 307 com Location válido retorna SOURCE_REDIRECT", async (assert) => {
    const r = createMockResolver();
    const h = createMockRequestHttps();
    const client = createSafeExternalHttpsClient({ resolveSafeExternalHost: r.resolve, requestHttps: h.request });
    const p = client("https://example.com");
    await Promise.resolve();
    h.respond(307, { "content-type": "text/html", "location": "https://secure.example.com" });
    const res = await p;
    assert.strictEqual(res.ok, false);
    assert.strictEqual((res as any).error, "SOURCE_REDIRECT");
  });

  await test("CORREÇÃO 6.7: Status 308 com Location válido retorna SOURCE_REDIRECT", async (assert) => {
    const r = createMockResolver();
    const h = createMockRequestHttps();
    const client = createSafeExternalHttpsClient({ resolveSafeExternalHost: r.resolve, requestHttps: h.request });
    const p = client("https://example.com");
    await Promise.resolve();
    h.respond(308, { "content-type": "text/html", "location": "https://secure.example.com" });
    const res = await p;
    assert.strictEqual(res.ok, false);
    assert.strictEqual((res as any).error, "SOURCE_REDIRECT");
  });

  await test("CORREÇÃO 6.8: Status 301 sem Location retorna SOURCE_HTTP_ERROR", async (assert) => {
    const r = createMockResolver();
    const h = createMockRequestHttps();
    const client = createSafeExternalHttpsClient({ resolveSafeExternalHost: r.resolve, requestHttps: h.request });
    const p = client("https://example.com");
    await Promise.resolve();
    h.respond(301, { "content-type": "text/html" });
    const res = await p;
    assert.strictEqual(res.ok, false);
    assert.strictEqual((res as any).error, "SOURCE_HTTP_ERROR");
  });

  await test("CORREÇÃO 6.9: Status 302 com Location array retorna SOURCE_HTTP_ERROR", async (assert) => {
    const r = createMockResolver();
    const h = createMockRequestHttps();
    const client = createSafeExternalHttpsClient({ resolveSafeExternalHost: r.resolve, requestHttps: h.request });
    const p = client("https://example.com");
    await Promise.resolve();
    h.respond(302, { "content-type": "text/html", "location": ["https://one.com", "https://two.com"] as any });
    const res = await p;
    assert.strictEqual(res.ok, false);
    assert.strictEqual((res as any).error, "SOURCE_HTTP_ERROR");
  });

  await test("CORREÇÃO 6.10: Redirect destrói response", async (assert) => {
    const r = createMockResolver();
    const h = createMockRequestHttps();
    const client = createSafeExternalHttpsClient({ resolveSafeExternalHost: r.resolve, requestHttps: h.request });
    const p = client("https://example.com");
    await Promise.resolve();
    const resMsg = h.respond(301, { "content-type": "text/html", "location": "https://secure.example.com" });
    await p;
    assert.strictEqual(resMsg.destroyed, true);
  });

  await test("CORREÇÃO 6.11: Redirect destrói request", async (assert) => {
    const r = createMockResolver();
    const h = createMockRequestHttps();
    const client = createSafeExternalHttpsClient({ resolveSafeExternalHost: r.resolve, requestHttps: h.request });
    const p = client("https://example.com");
    await Promise.resolve();
    h.respond(301, { "content-type": "text/html", "location": "https://secure.example.com" });
    await p;
    const reqInstance = h.getReqInstance();
    assert.strictEqual(reqInstance?.destroyed, true);
  });

  await test("CORREÇÃO 6.12: Status não-2xx destrói response", async (assert) => {
    const r = createMockResolver();
    const h = createMockRequestHttps();
    const client = createSafeExternalHttpsClient({ resolveSafeExternalHost: r.resolve, requestHttps: h.request });
    const p = client("https://example.com");
    await Promise.resolve();
    const resMsg = h.respond(500, { "content-type": "text/html" });
    await p;
    assert.strictEqual(resMsg.destroyed, true);
  });

  await test("CORREÇÃO 6.13: Status não-2xx destrói request", async (assert) => {
    const r = createMockResolver();
    const h = createMockRequestHttps();
    const client = createSafeExternalHttpsClient({ resolveSafeExternalHost: r.resolve, requestHttps: h.request });
    const p = client("https://example.com");
    await Promise.resolve();
    h.respond(500, { "content-type": "text/html" });
    await p;
    const reqInstance = h.getReqInstance();
    assert.strictEqual(reqInstance?.destroyed, true);
  });

  await test("CORREÇÃO 6.14: Redirect não lê body (não emite end)", async (assert) => {
    const r = createMockResolver();
    const h = createMockRequestHttps();
    const client = createSafeExternalHttpsClient({ resolveSafeExternalHost: r.resolve, requestHttps: h.request });
    const p = client("https://example.com");
    await Promise.resolve();
    const resMsg = h.respond(301, { "content-type": "text/html", "location": "https://secure.example.com" });
    let ended = false;
    resMsg.on("end", () => { ended = true; });
    await p;
    assert.strictEqual(ended, false);
  });

  await test("CORREÇÃO 6.15: Status 204 sem body é aceito com sucesso", async (assert) => {
    const r = createMockResolver();
    const h = createMockRequestHttps();
    const client = createSafeExternalHttpsClient({ resolveSafeExternalHost: r.resolve, requestHttps: h.request });
    const p = client("https://example.com");
    await Promise.resolve();
    h.respond(204, { "content-type": "text/plain" });
    const resMsg = h.getResInstance();
    if (resMsg) {
      resMsg.triggerEnd();
    }
    const res = await p;
    assert.strictEqual(res.ok, true);
    if (res.ok) {
      assert.strictEqual(res.body, "");
    }
  });

  // --- CORREÇÃO 7 — TESTES DE CONTENT-TYPE SEPARADOS (16 tests) ---
  await test("CORREÇÃO 7.1: Content-Type text/html é aceito", async (assert) => {
    const r = createMockResolver();
    const h = createMockRequestHttps();
    const client = createSafeExternalHttpsClient({ resolveSafeExternalHost: r.resolve, requestHttps: h.request });
    const p = client("https://example.com");
    await Promise.resolve();
    h.respond(200, { "content-type": "text/html" });
    const resMsg = h.getResInstance();
    if (resMsg) resMsg.triggerEnd();
    const res = await p;
    assert.strictEqual(res.ok, true);
  });

  await test("CORREÇÃO 7.2: Content-Type text/html com charset utf-8 é aceito", async (assert) => {
    const r = createMockResolver();
    const h = createMockRequestHttps();
    const client = createSafeExternalHttpsClient({ resolveSafeExternalHost: r.resolve, requestHttps: h.request });
    const p = client("https://example.com");
    await Promise.resolve();
    h.respond(200, { "content-type": "text/html; charset=utf-8" });
    const resMsg = h.getResInstance();
    if (resMsg) resMsg.triggerEnd();
    const res = await p;
    assert.strictEqual(res.ok, true);
  });

  await test("CORREÇÃO 7.3: Content-Type application/xhtml+xml é aceito", async (assert) => {
    const r = createMockResolver();
    const h = createMockRequestHttps();
    const client = createSafeExternalHttpsClient({ resolveSafeExternalHost: r.resolve, requestHttps: h.request });
    const p = client("https://example.com");
    await Promise.resolve();
    h.respond(200, { "content-type": "application/xhtml+xml" });
    const resMsg = h.getResInstance();
    if (resMsg) resMsg.triggerEnd();
    const res = await p;
    assert.strictEqual(res.ok, true);
  });

  await test("CORREÇÃO 7.4: Content-Type text/plain é aceito", async (assert) => {
    const r = createMockResolver();
    const h = createMockRequestHttps();
    const client = createSafeExternalHttpsClient({ resolveSafeExternalHost: r.resolve, requestHttps: h.request });
    const p = client("https://example.com");
    await Promise.resolve();
    h.respond(200, { "content-type": "text/plain" });
    const resMsg = h.getResInstance();
    if (resMsg) resMsg.triggerEnd();
    const res = await p;
    assert.strictEqual(res.ok, true);
  });

  await test("CORREÇÃO 7.5: Content-Type application/json é rejeitado", async (assert) => {
    const r = createMockResolver();
    const h = createMockRequestHttps();
    const client = createSafeExternalHttpsClient({ resolveSafeExternalHost: r.resolve, requestHttps: h.request });
    const p = client("https://example.com");
    await Promise.resolve();
    h.respond(200, { "content-type": "application/json" });
    const res = await p;
    assert.strictEqual(res.ok, false);
    assert.strictEqual((res as any).error, "SOURCE_UNSUPPORTED_CONTENT_TYPE");
  });

  await test("CORREÇÃO 7.6: Content-Type application/pdf é rejeitado", async (assert) => {
    const r = createMockResolver();
    const h = createMockRequestHttps();
    const client = createSafeExternalHttpsClient({ resolveSafeExternalHost: r.resolve, requestHttps: h.request });
    const p = client("https://example.com");
    await Promise.resolve();
    h.respond(200, { "content-type": "application/pdf" });
    const res = await p;
    assert.strictEqual(res.ok, false);
    assert.strictEqual((res as any).error, "SOURCE_UNSUPPORTED_CONTENT_TYPE");
  });

  await test("CORREÇÃO 7.7: Content-Type application/octet-stream é rejeitado", async (assert) => {
    const r = createMockResolver();
    const h = createMockRequestHttps();
    const client = createSafeExternalHttpsClient({ resolveSafeExternalHost: r.resolve, requestHttps: h.request });
    const p = client("https://example.com");
    await Promise.resolve();
    h.respond(200, { "content-type": "application/octet-stream" });
    const res = await p;
    assert.strictEqual(res.ok, false);
    assert.strictEqual((res as any).error, "SOURCE_UNSUPPORTED_CONTENT_TYPE");
  });

  await test("CORREÇÃO 7.8: Content-Type image/png é rejeitado", async (assert) => {
    const r = createMockResolver();
    const h = createMockRequestHttps();
    const client = createSafeExternalHttpsClient({ resolveSafeExternalHost: r.resolve, requestHttps: h.request });
    const p = client("https://example.com");
    await Promise.resolve();
    h.respond(200, { "content-type": "image/png" });
    const res = await p;
    assert.strictEqual(res.ok, false);
    assert.strictEqual((res as any).error, "SOURCE_UNSUPPORTED_CONTENT_TYPE");
  });

  await test("CORREÇÃO 7.9: Content-Type audio/mpeg é rejeitado", async (assert) => {
    const r = createMockResolver();
    const h = createMockRequestHttps();
    const client = createSafeExternalHttpsClient({ resolveSafeExternalHost: r.resolve, requestHttps: h.request });
    const p = client("https://example.com");
    await Promise.resolve();
    h.respond(200, { "content-type": "audio/mpeg" });
    const res = await p;
    assert.strictEqual(res.ok, false);
    assert.strictEqual((res as any).error, "SOURCE_UNSUPPORTED_CONTENT_TYPE");
  });

  await test("CORREÇÃO 7.10: Content-Type video/mp4 é rejeitado", async (assert) => {
    const r = createMockResolver();
    const h = createMockRequestHttps();
    const client = createSafeExternalHttpsClient({ resolveSafeExternalHost: r.resolve, requestHttps: h.request });
    const p = client("https://example.com");
    await Promise.resolve();
    h.respond(200, { "content-type": "video/mp4" });
    const res = await p;
    assert.strictEqual(res.ok, false);
    assert.strictEqual((res as any).error, "SOURCE_UNSUPPORTED_CONTENT_TYPE");
  });

  await test("CORREÇÃO 7.11: Content-Type font/woff2 é rejeitado", async (assert) => {
    const r = createMockResolver();
    const h = createMockRequestHttps();
    const client = createSafeExternalHttpsClient({ resolveSafeExternalHost: r.resolve, requestHttps: h.request });
    const p = client("https://example.com");
    await Promise.resolve();
    h.respond(200, { "content-type": "font/woff2" });
    const res = await p;
    assert.strictEqual(res.ok, false);
    assert.strictEqual((res as any).error, "SOURCE_UNSUPPORTED_CONTENT_TYPE");
  });

  await test("CORREÇÃO 7.12: Content-Type multipart/form-data é rejeitado", async (assert) => {
    const r = createMockResolver();
    const h = createMockRequestHttps();
    const client = createSafeExternalHttpsClient({ resolveSafeExternalHost: r.resolve, requestHttps: h.request });
    const p = client("https://example.com");
    await Promise.resolve();
    h.respond(200, { "content-type": "multipart/form-data" });
    const res = await p;
    assert.strictEqual(res.ok, false);
    assert.strictEqual((res as any).error, "SOURCE_UNSUPPORTED_CONTENT_TYPE");
  });

  await test("CORREÇÃO 7.13: Content-Type ausente é rejeitado", async (assert) => {
    const r = createMockResolver();
    const h = createMockRequestHttps();
    const client = createSafeExternalHttpsClient({ resolveSafeExternalHost: r.resolve, requestHttps: h.request });
    const p = client("https://example.com");
    await Promise.resolve();
    h.respond(200, {});
    const res = await p;
    assert.strictEqual(res.ok, false);
    assert.strictEqual((res as any).error, "SOURCE_UNSUPPORTED_CONTENT_TYPE");
  });

  await test("CORREÇÃO 7.14: Content-Type array utilizando primeiro valor se for válido", async (assert) => {
    const r = createMockResolver();
    const h = createMockRequestHttps();
    const client = createSafeExternalHttpsClient({ resolveSafeExternalHost: r.resolve, requestHttps: h.request });
    const p = client("https://example.com");
    await Promise.resolve();
    h.respond(200, { "content-type": ["text/html", "application/json"] as any });
    const resMsg = h.getResInstance();
    if (resMsg) resMsg.triggerEnd();
    const res = await p;
    assert.strictEqual(res.ok, true);
  });

  await test("CORREÇÃO 7.15: Content-Type com caixa alta normaliza e é aceito", async (assert) => {
    const r = createMockResolver();
    const h = createMockRequestHttps();
    const client = createSafeExternalHttpsClient({ resolveSafeExternalHost: r.resolve, requestHttps: h.request });
    const p = client("https://example.com");
    await Promise.resolve();
    h.respond(200, { "content-type": "TEXT/HTML; charset=UTF-8" });
    const resMsg = h.getResInstance();
    if (resMsg) resMsg.triggerEnd();
    const res = await p;
    assert.strictEqual(res.ok, true);
  });

  await test("CORREÇÃO 7.16: Content-Type inválido destrói response e request", async (assert) => {
    const r = createMockResolver();
    const h = createMockRequestHttps();
    const client = createSafeExternalHttpsClient({ resolveSafeExternalHost: r.resolve, requestHttps: h.request });
    const p = client("https://example.com");
    await Promise.resolve();
    const resMsg = h.respond(200, { "content-type": "application/json" });
    await p;
    assert.strictEqual(resMsg.destroyed, true);
    const reqInstance = h.getReqInstance();
    assert.strictEqual(reqInstance?.destroyed, true);
  });

  // --- CORREÇÃO 8 — TESTES DE CONTENT-ENCODING SEPARADOS (8 tests) ---
  await test("CORREÇÃO 8.1: Content-Encoding ausente é aceito por padrão", async (assert) => {
    const r = createMockResolver();
    const h = createMockRequestHttps();
    const client = createSafeExternalHttpsClient({ resolveSafeExternalHost: r.resolve, requestHttps: h.request });
    const p = client("https://example.com");
    await Promise.resolve();
    h.respond(200, { "content-type": "text/html" });
    const resMsg = h.getResInstance();
    if (resMsg) resMsg.triggerEnd();
    const res = await p;
    assert.strictEqual(res.ok, true);
  });

  await test("CORREÇÃO 8.2: Content-Encoding 'identity' é aceito", async (assert) => {
    const r = createMockResolver();
    const h = createMockRequestHttps();
    const client = createSafeExternalHttpsClient({ resolveSafeExternalHost: r.resolve, requestHttps: h.request });
    const p = client("https://example.com");
    await Promise.resolve();
    h.respond(200, { "content-type": "text/html", "content-encoding": "identity" });
    const resMsg = h.getResInstance();
    if (resMsg) resMsg.triggerEnd();
    const res = await p;
    assert.strictEqual(res.ok, true);
  });

  await test("CORREÇÃO 8.3: Content-Encoding 'identity' com caixa alta é normalizado e aceito", async (assert) => {
    const r = createMockResolver();
    const h = createMockRequestHttps();
    const client = createSafeExternalHttpsClient({ resolveSafeExternalHost: r.resolve, requestHttps: h.request });
    const p = client("https://example.com");
    await Promise.resolve();
    h.respond(200, { "content-type": "text/html", "content-encoding": "IDENTITY" });
    const resMsg = h.getResInstance();
    if (resMsg) resMsg.triggerEnd();
    const res = await p;
    assert.strictEqual(res.ok, true);
  });

  await test("CORREÇÃO 8.4: Content-Encoding 'gzip' é rejeitado", async (assert) => {
    const r = createMockResolver();
    const h = createMockRequestHttps();
    const client = createSafeExternalHttpsClient({ resolveSafeExternalHost: r.resolve, requestHttps: h.request });
    const p = client("https://example.com");
    await Promise.resolve();
    h.respond(200, { "content-type": "text/html", "content-encoding": "gzip" });
    const res = await p;
    assert.strictEqual(res.ok, false);
    assert.strictEqual((res as any).error, "SOURCE_UNSUPPORTED_ENCODING");
  });

  await test("CORREÇÃO 8.5: Content-Encoding 'br' é rejeitado", async (assert) => {
    const r = createMockResolver();
    const h = createMockRequestHttps();
    const client = createSafeExternalHttpsClient({ resolveSafeExternalHost: r.resolve, requestHttps: h.request });
    const p = client("https://example.com");
    await Promise.resolve();
    h.respond(200, { "content-type": "text/html", "content-encoding": "br" });
    const res = await p;
    assert.strictEqual(res.ok, false);
    assert.strictEqual((res as any).error, "SOURCE_UNSUPPORTED_ENCODING");
  });

  await test("CORREÇÃO 8.6: Content-Encoding 'deflate' é rejeitado", async (assert) => {
    const r = createMockResolver();
    const h = createMockRequestHttps();
    const client = createSafeExternalHttpsClient({ resolveSafeExternalHost: r.resolve, requestHttps: h.request });
    const p = client("https://example.com");
    await Promise.resolve();
    h.respond(200, { "content-type": "text/html", "content-encoding": "deflate" });
    const res = await p;
    assert.strictEqual(res.ok, false);
    assert.strictEqual((res as any).error, "SOURCE_UNSUPPORTED_ENCODING");
  });

  await test("CORREÇÃO 8.7: Content-Encoding array com gzip é rejeitado", async (assert) => {
    const r = createMockResolver();
    const h = createMockRequestHttps();
    const client = createSafeExternalHttpsClient({ resolveSafeExternalHost: r.resolve, requestHttps: h.request });
    const p = client("https://example.com");
    await Promise.resolve();
    h.respond(200, { "content-type": "text/html", "content-encoding": ["gzip"] as any });
    const res = await p;
    assert.strictEqual(res.ok, false);
    assert.strictEqual((res as any).error, "SOURCE_UNSUPPORTED_ENCODING");
  });

  await test("CORREÇÃO 8.8: Content-Encoding desconhecido é rejeitado", async (assert) => {
    const r = createMockResolver();
    const h = createMockRequestHttps();
    const client = createSafeExternalHttpsClient({ resolveSafeExternalHost: r.resolve, requestHttps: h.request });
    const p = client("https://example.com");
    await Promise.resolve();
    h.respond(200, { "content-type": "text/html", "content-encoding": "unknown" });
    const res = await p;
    assert.strictEqual(res.ok, false);
    assert.strictEqual((res as any).error, "SOURCE_UNSUPPORTED_ENCODING");
  });

  // --- CORREÇÃO 9 — BODY LIMIT COMPLETO (15 tests) ---
  await test("CORREÇÃO 9.1: Content-Length acima de 2 MB (2097153) é rejeitado", async (assert) => {
    const r = createMockResolver();
    const h = createMockRequestHttps();
    const client = createSafeExternalHttpsClient({ resolveSafeExternalHost: r.resolve, requestHttps: h.request });
    const p = client("https://example.com");
    await Promise.resolve();
    h.respond(200, { "content-type": "text/html", "content-length": "2097153" });
    const res = await p;
    assert.strictEqual(res.ok, false);
    assert.strictEqual((res as any).error, "SOURCE_TOO_LARGE");
  });

  await test("CORREÇÃO 9.2: Content-Length exatamente 2 MB (2097152) é aceito", async (assert) => {
    const r = createMockResolver();
    const h = createMockRequestHttps();
    const client = createSafeExternalHttpsClient({ resolveSafeExternalHost: r.resolve, requestHttps: h.request });
    const p = client("https://example.com");
    await Promise.resolve();
    h.respond(200, { "content-type": "text/html", "content-length": "2097152" });
    const resMsg = h.getResInstance();
    if (resMsg) {
      resMsg.triggerData(Buffer.alloc(2097152));
      resMsg.triggerEnd();
    }
    const res = await p;
    assert.strictEqual(res.ok, true);
  });

  await test("CORREÇÃO 9.3: Content-Length de 0 é aceito", async (assert) => {
    const r = createMockResolver();
    const h = createMockRequestHttps();
    const client = createSafeExternalHttpsClient({ resolveSafeExternalHost: r.resolve, requestHttps: h.request });
    const p = client("https://example.com");
    await Promise.resolve();
    h.respond(200, { "content-type": "text/html", "content-length": "0" });
    const resMsg = h.getResInstance();
    if (resMsg) resMsg.triggerEnd();
    const res = await p;
    assert.strictEqual(res.ok, true);
  });

  await test("CORREÇÃO 9.4: Content-Length inválido vazio é rejeitado", async (assert) => {
    const r = createMockResolver();
    const h = createMockRequestHttps();
    const client = createSafeExternalHttpsClient({ resolveSafeExternalHost: r.resolve, requestHttps: h.request });
    const p = client("https://example.com");
    await Promise.resolve();
    h.respond(200, { "content-type": "text/html", "content-length": "" });
    const res = await p;
    assert.strictEqual(res.ok, false);
    assert.strictEqual((res as any).error, "SOURCE_FETCH_FAILED");
  });

  await test("CORREÇÃO 9.5: Content-Length negativo é rejeitado", async (assert) => {
    const r = createMockResolver();
    const h = createMockRequestHttps();
    const client = createSafeExternalHttpsClient({ resolveSafeExternalHost: r.resolve, requestHttps: h.request });
    const p = client("https://example.com");
    await Promise.resolve();
    h.respond(200, { "content-type": "text/html", "content-length": "-123" });
    const res = await p;
    assert.strictEqual(res.ok, false);
    assert.strictEqual((res as any).error, "SOURCE_FETCH_FAILED");
  });

  await test("CORREÇÃO 9.6: Content-Length decimal é rejeitado", async (assert) => {
    const r = createMockResolver();
    const h = createMockRequestHttps();
    const client = createSafeExternalHttpsClient({ resolveSafeExternalHost: r.resolve, requestHttps: h.request });
    const p = client("https://example.com");
    await Promise.resolve();
    h.respond(200, { "content-type": "text/html", "content-length": "100.5" });
    const res = await p;
    assert.strictEqual(res.ok, false);
    assert.strictEqual((res as any).error, "SOURCE_FETCH_FAILED");
  });

  await test("CORREÇÃO 9.7: Content-Length com string malformada como 123abc é rejeitado", async (assert) => {
    const r = createMockResolver();
    const h = createMockRequestHttps();
    const client = createSafeExternalHttpsClient({ resolveSafeExternalHost: r.resolve, requestHttps: h.request });
    const p = client("https://example.com");
    await Promise.resolve();
    h.respond(200, { "content-type": "text/html", "content-length": "123abc" });
    const res = await p;
    assert.strictEqual(res.ok, false);
    assert.strictEqual((res as any).error, "SOURCE_FETCH_FAILED");
  });

  await test("CORREÇÃO 9.8: Content-Length com notação científica 1e3 é rejeitado", async (assert) => {
    const r = createMockResolver();
    const h = createMockRequestHttps();
    const client = createSafeExternalHttpsClient({ resolveSafeExternalHost: r.resolve, requestHttps: h.request });
    const p = client("https://example.com");
    await Promise.resolve();
    h.respond(200, { "content-type": "text/html", "content-length": "1e3" });
    const res = await p;
    assert.strictEqual(res.ok, false);
    assert.strictEqual((res as any).error, "SOURCE_FETCH_FAILED");
  });

  await test("CORREÇÃO 9.9: Sem Content-Length conta chunks recebidos dinamicamente", async (assert) => {
    const r = createMockResolver();
    const h = createMockRequestHttps();
    const client = createSafeExternalHttpsClient({ resolveSafeExternalHost: r.resolve, requestHttps: h.request });
    const p = client("https://example.com");
    await Promise.resolve();
    h.respond(200, { "content-type": "text/html" });
    const resMsg = h.getResInstance();
    if (resMsg) {
      resMsg.triggerData(Buffer.alloc(500));
      resMsg.triggerData(Buffer.alloc(500));
      resMsg.triggerEnd();
    }
    const res = await p;
    assert.strictEqual(res.ok, true);
    if (res.ok) {
      assert.strictEqual(res.bytes, 1000);
    }
  });

  await test("CORREÇÃO 9.10: Streaming dinâmico ultrapassando 2 MB destrói request", async (assert) => {
    const r = createMockResolver();
    const h = createMockRequestHttps();
    const client = createSafeExternalHttpsClient({ resolveSafeExternalHost: r.resolve, requestHttps: h.request });
    const p = client("https://example.com");
    await Promise.resolve();
    h.respond(200, { "content-type": "text/html" });
    const resMsg = h.getResInstance();
    if (resMsg) {
      resMsg.triggerData(Buffer.alloc(1024 * 1024));
      resMsg.triggerData(Buffer.alloc(1024 * 1024));
      resMsg.triggerData(Buffer.alloc(1));
    }
    await p;
    const reqInstance = h.getReqInstance();
    assert.strictEqual(reqInstance?.destroyed, true);
  });

  await test("CORREÇÃO 9.11: Streaming dinâmico ultrapassando 2 MB destrói response", async (assert) => {
    const r = createMockResolver();
    const h = createMockRequestHttps();
    const client = createSafeExternalHttpsClient({ resolveSafeExternalHost: r.resolve, requestHttps: h.request });
    const p = client("https://example.com");
    await Promise.resolve();
    h.respond(200, { "content-type": "text/html" });
    const resMsg = h.getResInstance();
    if (resMsg) {
      resMsg.triggerData(Buffer.alloc(1024 * 1024));
      resMsg.triggerData(Buffer.alloc(1024 * 1024));
      resMsg.triggerData(Buffer.alloc(1));
    }
    await p;
    assert.strictEqual(resMsg?.destroyed, true);
  });

  await test("CORREÇÃO 9.12: Streaming dinâmico exatamente com 2 MB é aceito", async (assert) => {
    const r = createMockResolver();
    const h = createMockRequestHttps();
    const client = createSafeExternalHttpsClient({ resolveSafeExternalHost: r.resolve, requestHttps: h.request });
    const p = client("https://example.com");
    await Promise.resolve();
    h.respond(200, { "content-type": "text/html" });
    const resMsg = h.getResInstance();
    if (resMsg) {
      resMsg.triggerData(Buffer.alloc(1024 * 1024));
      resMsg.triggerData(Buffer.alloc(1024 * 1024));
      resMsg.triggerEnd();
    }
    const res = await p;
    assert.strictEqual(res.ok, true);
    if (res.ok) {
      assert.strictEqual(res.bytes, 2 * 1024 * 1024);
    }
  });

  await test("CORREÇÃO 9.13: Corpo parcial não é retornado após excesso de tamanho", async (assert) => {
    const r = createMockResolver();
    const h = createMockRequestHttps();
    const client = createSafeExternalHttpsClient({ resolveSafeExternalHost: r.resolve, requestHttps: h.request });
    const p = client("https://example.com");
    await Promise.resolve();
    h.respond(200, { "content-type": "text/html" });
    const resMsg = h.getResInstance();
    if (resMsg) {
      resMsg.triggerData(Buffer.alloc(1024 * 1024));
      resMsg.triggerData(Buffer.alloc(1024 * 1024));
      resMsg.triggerData(Buffer.alloc(10));
    }
    const res = await p;
    assert.strictEqual(res.ok, false);
    assert.strictEqual((res as any).error, "SOURCE_TOO_LARGE");
    assert.strictEqual((res as any).body, undefined);
  });

  await test("CORREÇÃO 9.14: Bytes retornados no resultado de sucesso correspondem ao tamanho dos chunks", async (assert) => {
    const r = createMockResolver();
    const h = createMockRequestHttps();
    const client = createSafeExternalHttpsClient({ resolveSafeExternalHost: r.resolve, requestHttps: h.request });
    const p = client("https://example.com");
    await Promise.resolve();
    h.respond(200, { "content-type": "text/html" });
    const resMsg = h.getResInstance();
    if (resMsg) {
      resMsg.triggerData("one");
      resMsg.triggerData("two");
      resMsg.triggerEnd();
    }
    const res = await p;
    assert.strictEqual(res.ok, true);
    if (res.ok) {
      assert.strictEqual(res.bytes, 6);
    }
  });

  await test("CORREÇÃO 9.15: Chunks concatenados mantêm a ordem estrita de emissão", async (assert) => {
    const r = createMockResolver();
    const h = createMockRequestHttps();
    const client = createSafeExternalHttpsClient({ resolveSafeExternalHost: r.resolve, requestHttps: h.request });
    const p = client("https://example.com");
    await Promise.resolve();
    h.respond(200, { "content-type": "text/html" });
    const resMsg = h.getResInstance();
    if (resMsg) {
      resMsg.triggerData("first ");
      resMsg.triggerData("second");
      resMsg.triggerEnd();
    }
    const res = await p;
    assert.strictEqual(res.ok, true);
    if (res.ok) {
      assert.strictEqual(res.body, "first second");
    }
  });

  // --- CORREÇÃO 10 — PRIVACIDADE COMPLETA (11 tests) ---
  await test("CORREÇÃO 10.1: Resultado de erro não possui propriedade 'message'", async (assert) => {
    const r = createMockResolver();
    const h = createMockRequestHttps();
    const client = createSafeExternalHttpsClient({ resolveSafeExternalHost: r.resolve, requestHttps: h.request });
    const res = await client("not-a-url");
    assert.strictEqual((res as any).message, undefined);
  });

  await test("CORREÇÃO 10.2: Resultado de erro não possui propriedade 'stack'", async (assert) => {
    const r = createMockResolver();
    const h = createMockRequestHttps();
    const client = createSafeExternalHttpsClient({ resolveSafeExternalHost: r.resolve, requestHttps: h.request });
    const res = await client("not-a-url");
    assert.strictEqual((res as any).stack, undefined);
  });

  await test("CORREÇÃO 10.3: Resultado de erro não possui propriedade 'rawUrl' ou 'href'", async (assert) => {
    const r = createMockResolver();
    const h = createMockRequestHttps();
    const client = createSafeExternalHttpsClient({ resolveSafeExternalHost: r.resolve, requestHttps: h.request });
    const res = await client("not-a-url");
    assert.strictEqual((res as any).rawUrl, undefined);
    assert.strictEqual((res as any).href, undefined);
  });

  await test("CORREÇÃO 10.4: Resultado de erro não possui propriedade 'headers' ou 'cookies'", async (assert) => {
    const r = createMockResolver();
    const h = createMockRequestHttps();
    const client = createSafeExternalHttpsClient({ resolveSafeExternalHost: r.resolve, requestHttps: h.request });
    const res = await client("not-a-url");
    assert.strictEqual((res as any).headers, undefined);
    assert.strictEqual((res as any).cookies, undefined);
  });

  await test("CORREÇÃO 10.5: Resultado de erro não possui propriedade 'selectedAddress' ou 'addresses'", async (assert) => {
    const r = createMockResolver();
    const h = createMockRequestHttps();
    const client = createSafeExternalHttpsClient({ resolveSafeExternalHost: r.resolve, requestHttps: h.request });
    const res = await client("not-a-url");
    assert.strictEqual((res as any).selectedAddress, undefined);
    assert.strictEqual((res as any).addresses, undefined);
  });

  await test("CORREÇÃO 10.6: Resultado de erro não possui propriedade 'request' ou 'response'", async (assert) => {
    const r = createMockResolver();
    const h = createMockRequestHttps();
    const client = createSafeExternalHttpsClient({ resolveSafeExternalHost: r.resolve, requestHttps: h.request });
    const res = await client("not-a-url");
    assert.strictEqual((res as any).request, undefined);
    assert.strictEqual((res as any).response, undefined);
  });

  await test("CORREÇÃO 10.7: Resultado de erro não possui propriedade 'query' ou 'fragment'", async (assert) => {
    const r = createMockResolver();
    const h = createMockRequestHttps();
    const client = createSafeExternalHttpsClient({ resolveSafeExternalHost: r.resolve, requestHttps: h.request });
    const res = await client("not-a-url");
    assert.strictEqual((res as any).query, undefined);
    assert.strictEqual((res as any).fragment, undefined);
  });

  await test("CORREÇÃO 10.8: Resultado de sucesso não possui 'selectedAddress' ou 'addresses'", async (assert) => {
    const r = createMockResolver();
    const h = createMockRequestHttps();
    const client = createSafeExternalHttpsClient({ resolveSafeExternalHost: r.resolve, requestHttps: h.request });
    const p = client("https://example.com");
    await Promise.resolve();
    h.respond(200, { "content-type": "text/html" });
    const resMsg = h.getResInstance();
    if (resMsg) resMsg.triggerEnd();
    const res = await p;
    assert.strictEqual(res.ok, true);
    assert.strictEqual((res as any).selectedAddress, undefined);
    assert.strictEqual((res as any).addresses, undefined);
  });

  await test("CORREÇÃO 10.9: Resultado de sucesso não possui 'headers' ou 'cookies'", async (assert) => {
    const r = createMockResolver();
    const h = createMockRequestHttps();
    const client = createSafeExternalHttpsClient({ resolveSafeExternalHost: r.resolve, requestHttps: h.request });
    const p = client("https://example.com");
    await Promise.resolve();
    h.respond(200, { "content-type": "text/html" });
    const resMsg = h.getResInstance();
    if (resMsg) resMsg.triggerEnd();
    const res = await p;
    assert.strictEqual(res.ok, true);
    assert.strictEqual((res as any).headers, undefined);
    assert.strictEqual((res as any).cookies, undefined);
  });

  await test("CORREÇÃO 10.10: Resultado de sucesso não possui 'rawUrl' ou 'href'", async (assert) => {
    const r = createMockResolver();
    const h = createMockRequestHttps();
    const client = createSafeExternalHttpsClient({ resolveSafeExternalHost: r.resolve, requestHttps: h.request });
    const p = client("https://example.com");
    await Promise.resolve();
    h.respond(200, { "content-type": "text/html" });
    const resMsg = h.getResInstance();
    if (resMsg) resMsg.triggerEnd();
    const res = await p;
    assert.strictEqual(res.ok, true);
    assert.strictEqual((res as any).rawUrl, undefined);
    assert.strictEqual((res as any).href, undefined);
  });

  await test("CORREÇÃO 10.11: Resultado de redirect não possui 'headers', 'cookies', 'selectedAddress', 'addresses', 'rawUrl' ou 'href'", async (assert) => {
    const r = createMockResolver();
    const h = createMockRequestHttps();
    const client = createSafeExternalHttpsClient({ resolveSafeExternalHost: r.resolve, requestHttps: h.request });
    const p = client("https://example.com");
    await Promise.resolve();
    h.respond(301, { "content-type": "text/html", "location": "https://secure.example.com" });
    const res = await p;
    assert.strictEqual(res.ok, false);
    assert.strictEqual((res as any).headers, undefined);
    assert.strictEqual((res as any).cookies, undefined);
    assert.strictEqual((res as any).selectedAddress, undefined);
    assert.strictEqual((res as any).addresses, undefined);
    assert.strictEqual((res as any).rawUrl, undefined);
    assert.strictEqual((res as any).href, undefined);
  });

  // --- CORREÇÃO 11 & 12 — HIGIENE ESTÁTICA & APP/APPLET (2 tests) ---
  await test("CORREÇÃO 11.1: Verifica higiene estática do arquivo safeExternalHttpsClient.ts", async (assert) => {
    const clientFilePath = join(process.cwd(), "services/server/safeExternalHttpsClient.ts");
    const code = readFileSync(clientFilePath, "utf8");
    const codeLower = code.toLowerCase();

    assert.ok(!code.includes("console.log"), "contains console.log");
    assert.ok(!code.includes("console.error"), "contains console.error");
    assert.ok(!code.includes("console.warn"), "contains console.warn");
    assert.ok(!code.includes("logger"), "contains logger");
    assert.ok(!code.includes("node:http"), "contains node:http");
    assert.ok(!code.includes("node:tls"), "contains node:tls");
    assert.ok(!code.includes("node:dns"), "contains node:dns");
    assert.ok(!code.includes("fetch("), "contains fetch(");
    assert.ok(!code.includes("node-fetch"), "contains node-fetch");
    assert.ok(!code.includes("axios"), "contains axios");
    assert.ok(!codeLower.includes("express"), "contains express");
    assert.ok(!codeLower.includes("firebase"), "contains firebase");
    assert.ok(!codeLower.includes("@google/genai"), "contains @google/genai");
    assert.ok(!codeLower.includes("gemini"), "contains gemini");
    assert.ok(!code.includes("process.env"), "contains process.env");
    assert.ok(!code.includes("readFileSync"), "contains readFileSync");
    assert.ok(!code.includes("writeFileSync"), "contains writeFileSync");
    assert.ok(!code.includes("fs"), "contains fs");

    const serverCode = readFileSync(join(process.cwd(), "server.ts"), "utf8");
    assert.ok(!serverCode.includes("safeExternalHttpsClient"), "server.ts contains safeExternalHttpsClient");
    assert.ok(existsSync(join(process.cwd(), "services/server/safeExternalFetch.ts")), "safeExternalFetch.ts exists");
  });

  await test("CORREÇÃO 12.1: Verifica ausência de cópias de arquivos específicas da fase em app/applet", async (assert) => {
    const copyClientExists = existsSync(join(process.cwd(), "app/applet/services/server/safeExternalHttpsClient.ts"));
    const copyTestExists = existsSync(join(process.cwd(), "app/applet/scripts/test_phase0_2c1c3_safe_external_https_client.ts"));
    assert.ok(!copyClientExists, "safeExternalHttpsClient copy exists in app/applet");
    assert.ok(!copyTestExists, "test suite copy exists in app/applet");
  });

  // --- CORREÇÃO 13 — INTEGRIDADE (1 test) ---
  await test("CORREÇÃO 13.1: Todos os arquivos protegidos preservam o hash inicial", async (assert) => {
    for (const [file, originalHash] of initialHashes.entries()) {
      const fullPath = join(process.cwd(), file);
      const exists = existsSync(fullPath);
      assert.ok(exists, `Arquivo protegido ${file} sumiu!`);
      if (exists) {
        const hash = createHash("sha256").update(readFileSync(fullPath)).digest("hex");
        assert.strictEqual(hash.length, 64, `Hash de ${file} inválido`);
        assert.strictEqual(hash, originalHash, `Arquivo modificado de forma ilegal: ${file}`);
      }
    }
  });

  console.log(`\nTests passed: ${passed}`);
  console.log(`Tests failed: ${failed}`);
  console.log(`Total tests: ${registered}`);

  if (failed > 0) {
    process.exitCode = 1;
  } else {
    process.exitCode = 0;
  }
}

runAllTests().catch((err) => {
  console.error("Critical test runner failure:", err);
  process.exit(1);
});
