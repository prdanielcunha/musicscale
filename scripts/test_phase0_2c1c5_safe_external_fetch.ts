import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createSafeExternalFetch, SafeExternalFetchSuccess, SafeExternalFetchFailure } from "../services/server/safeExternalFetch.js";

let registeredTests = 0;
let passedTests = 0;
let failedTests = 0;

class MockRedirectClient {
  calls: any[] = [];
  responses: any[] = [];
  onCall?: (callNum: number) => void;

  queueResponse(res: any) {
    this.responses.push(res);
  }

  fetch = async (rawUrl: unknown, options?: { signal?: AbortSignal; maxRedirects?: number }) => {
    const callNum = this.calls.length + 1;
    this.calls.push({ rawUrl, signal: options?.signal, maxRedirects: options?.maxRedirects });
    
    if (this.onCall) {
      this.onCall(callNum);
    }

    if (options?.signal?.aborted) {
      return { ok: false, statusCode: 504, error: "SOURCE_TIMEOUT" };
    }

    const nextResponse = this.responses.shift();
    if (!nextResponse) {
      return { ok: false, statusCode: 502, error: "SOURCE_FETCH_FAILED" };
    }

    if (nextResponse instanceof Error) {
      throw nextResponse;
    }

    // Wait a brief moment to allow signals/abort to propagate
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
      }, 5);
    });

    if (options?.signal?.aborted) {
      return { ok: false, statusCode: 504, error: "SOURCE_TIMEOUT" };
    }

    return nextResponse;
  };
}

class MockTimerManager {
  timers: any[] = [];
  nextId = 1;

  setTimer = (callback: () => void, ms: number) => {
    const id = this.nextId++;
    this.timers.push({ id, callback, ms, cleared: false });
    return id;
  };

  clearTimer = (id: any) => {
    const timer = this.timers.find((t) => t.id === id);
    if (timer) {
      timer.cleared = true;
    }
  };

  trigger(id: any) {
    const timer = this.timers.find((t) => t.id === id);
    if (timer && !timer.cleared) {
      timer.callback();
    }
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
  "services/server/safeExternalRedirectClient.ts",
  "services/server/aiRequestSecurity.ts",
  "services/server/fixChordsHandler.ts",
  "scripts/test_phase0_2a_ecosystem_auth.ts",
  "scripts/test_phase0_2b_organization_security.ts",
  "scripts/test_phase0_2c1a_ai_authorization.ts",
  "scripts/test_phase0_2c1b_fix_chords_security.ts",
  "scripts/test_phase0_2c1c1_safe_external_url_policy.ts",
  "scripts/test_phase0_2c1c2_safe_external_dns_resolver.ts",
  "scripts/test_phase0_2c1c3_safe_external_https_client.ts",
  "scripts/test_phase0_2c1c4_safe_external_redirect_client.ts",
  "package.json",
  "package-lock.json"
];

async function runAll() {
  console.log("Starting Phase 0.2C.1C.5 safeExternalFetch Tests...");
  
  const initialHashes: Record<string, string> = {};
  for (const file of PROTECTED_FILES) {
    initialHashes[file] = readRequiredHash(file);
  }

  // VALIDAÇÃO INICIAL
  await runTest("1. URL não string retorna INVALID_SOURCE_URL", async (t) => {
    const mockRedirect = new MockRedirectClient();
    const timerManager = new MockTimerManager();
    const fetchFn = createSafeExternalFetch({
      fetchExternalHttpsWithRedirects: mockRedirect.fetch,
      setTimer: timerManager.setTimer,
      clearTimer: timerManager.clearTimer
    });

    const result = await fetchFn(12345 as any);
    t.expectFalse(result.ok);
    t.expectEqual(result.statusCode, 400);
    t.expectEqual((result as any).error, "INVALID_SOURCE_URL");
  });

  await runTest("2. URL inválida não cria timer", async (t) => {
    const mockRedirect = new MockRedirectClient();
    const timerManager = new MockTimerManager();
    const fetchFn = createSafeExternalFetch({
      fetchExternalHttpsWithRedirects: mockRedirect.fetch,
      setTimer: timerManager.setTimer,
      clearTimer: timerManager.clearTimer
    });

    await fetchFn("not-a-url");
    t.expectEqual(timerManager.timers.length, 0);
  });

  await runTest("3. URL inválida não chama redirect client", async (t) => {
    const mockRedirect = new MockRedirectClient();
    const timerManager = new MockTimerManager();
    const fetchFn = createSafeExternalFetch({
      fetchExternalHttpsWithRedirects: mockRedirect.fetch,
      setTimer: timerManager.setTimer,
      clearTimer: timerManager.clearTimer
    });

    await fetchFn("not-a-url");
    t.expectEqual(mockRedirect.calls.length, 0);
  });

  await runTest("4. URL HTTP retorna UNSAFE_SOURCE_URL", async (t) => {
    const mockRedirect = new MockRedirectClient();
    const timerManager = new MockTimerManager();
    const fetchFn = createSafeExternalFetch({
      fetchExternalHttpsWithRedirects: mockRedirect.fetch,
      setTimer: timerManager.setTimer,
      clearTimer: timerManager.clearTimer
    });

    const result = await fetchFn("http://example.com");
    t.expectFalse(result.ok);
    t.expectEqual(result.statusCode, 403);
    t.expectEqual((result as any).error, "UNSAFE_SOURCE_URL");
  });

  await runTest("5. URL HTTP não cria timer", async (t) => {
    const mockRedirect = new MockRedirectClient();
    const timerManager = new MockTimerManager();
    const fetchFn = createSafeExternalFetch({
      fetchExternalHttpsWithRedirects: mockRedirect.fetch,
      setTimer: timerManager.setTimer,
      clearTimer: timerManager.clearTimer
    });

    await fetchFn("http://example.com");
    t.expectEqual(timerManager.timers.length, 0);
  });

  await runTest("6. URL com localhost retorna UNSAFE_SOURCE_URL", async (t) => {
    const mockRedirect = new MockRedirectClient();
    const timerManager = new MockTimerManager();
    const fetchFn = createSafeExternalFetch({
      fetchExternalHttpsWithRedirects: mockRedirect.fetch,
      setTimer: timerManager.setTimer,
      clearTimer: timerManager.clearTimer
    });

    const result = await fetchFn("https://localhost/path");
    t.expectFalse(result.ok);
    t.expectEqual(result.statusCode, 403);
    t.expectEqual((result as any).error, "UNSAFE_SOURCE_URL");
  });

  await runTest("7. URL com IP privado retorna UNSAFE_SOURCE_URL", async (t) => {
    const mockRedirect = new MockRedirectClient();
    const timerManager = new MockTimerManager();
    const fetchFn = createSafeExternalFetch({
      fetchExternalHttpsWithRedirects: mockRedirect.fetch,
      setTimer: timerManager.setTimer,
      clearTimer: timerManager.clearTimer
    });

    const result = await fetchFn("https://192.168.1.1/path");
    t.expectFalse(result.ok);
    t.expectEqual(result.statusCode, 403);
    t.expectEqual((result as any).error, "UNSAFE_SOURCE_URL");
  });

  await runTest("8. URL válida é normalizada antes do redirect client", async (t) => {
    const mockRedirect = new MockRedirectClient();
    const timerManager = new MockTimerManager();
    const fetchFn = createSafeExternalFetch({
      fetchExternalHttpsWithRedirects: mockRedirect.fetch,
      setTimer: timerManager.setTimer,
      clearTimer: timerManager.clearTimer
    });

    mockRedirect.queueResponse({ ok: true, body: "ok", statusCode: 200, contentType: "text/html", hostname: "example.com", bytes: 2, redirectsFollowed: 0 });

    await fetchFn("https://EXAMPLE.com:443/foo/bar/.");
    t.expectEqual(mockRedirect.calls.length, 1);
    t.expectEqual(mockRedirect.calls[0].rawUrl, "https://example.com/foo/bar/");
  });

  await runTest("9. fragment inicial não é enviado ao redirect client", async (t) => {
    const mockRedirect = new MockRedirectClient();
    const timerManager = new MockTimerManager();
    const fetchFn = createSafeExternalFetch({
      fetchExternalHttpsWithRedirects: mockRedirect.fetch,
      setTimer: timerManager.setTimer,
      clearTimer: timerManager.clearTimer
    });

    mockRedirect.queueResponse({ ok: true, body: "ok", statusCode: 200, contentType: "text/html", hostname: "example.com", bytes: 2, redirectsFollowed: 0 });

    await fetchFn("https://example.com/foo#section1");
    t.expectEqual(mockRedirect.calls.length, 1);
    t.expectEqual(mockRedirect.calls[0].rawUrl, "https://example.com/foo");
  });

  await runTest("10. query válida é preservada", async (t) => {
    const mockRedirect = new MockRedirectClient();
    const timerManager = new MockTimerManager();
    const fetchFn = createSafeExternalFetch({
      fetchExternalHttpsWithRedirects: mockRedirect.fetch,
      setTimer: timerManager.setTimer,
      clearTimer: timerManager.clearTimer
    });

    mockRedirect.queueResponse({ ok: true, body: "ok", statusCode: 200, contentType: "text/html", hostname: "example.com", bytes: 2, redirectsFollowed: 0 });

    await fetchFn("https://example.com/foo?bar=baz");
    t.expectEqual(mockRedirect.calls.length, 1);
    t.expectEqual(mockRedirect.calls[0].rawUrl, "https://example.com/foo?bar=baz");
  });

  // ABORT EXTERNO ANTES DA EXECUÇÃO
  await runTest("11. signal externo já abortado retorna SOURCE_TIMEOUT", async (t) => {
    const mockRedirect = new MockRedirectClient();
    const timerManager = new MockTimerManager();
    const fetchFn = createSafeExternalFetch({
      fetchExternalHttpsWithRedirects: mockRedirect.fetch,
      setTimer: timerManager.setTimer,
      clearTimer: timerManager.clearTimer
    });

    const controller = new AbortController();
    controller.abort();

    const result = await fetchFn("https://example.com", { signal: controller.signal });
    t.expectFalse(result.ok);
    t.expectEqual(result.statusCode, 504);
    t.expectEqual((result as any).error, "SOURCE_TIMEOUT");
  });

  await runTest("12. signal externo já abortado não cria timer", async (t) => {
    const mockRedirect = new MockRedirectClient();
    const timerManager = new MockTimerManager();
    const fetchFn = createSafeExternalFetch({
      fetchExternalHttpsWithRedirects: mockRedirect.fetch,
      setTimer: timerManager.setTimer,
      clearTimer: timerManager.clearTimer
    });

    const controller = new AbortController();
    controller.abort();

    await fetchFn("https://example.com", { signal: controller.signal });
    t.expectEqual(timerManager.timers.length, 0);
  });

  await runTest("13. signal externo já abortado não chama redirect client", async (t) => {
    const mockRedirect = new MockRedirectClient();
    const timerManager = new MockTimerManager();
    const fetchFn = createSafeExternalFetch({
      fetchExternalHttpsWithRedirects: mockRedirect.fetch,
      setTimer: timerManager.setTimer,
      clearTimer: timerManager.clearTimer
    });

    const controller = new AbortController();
    controller.abort();

    await fetchFn("https://example.com", { signal: controller.signal });
    t.expectEqual(mockRedirect.calls.length, 0);
  });

  await runTest("14. signal externo já abortado retorna timedOut false", async (t) => {
    const mockRedirect = new MockRedirectClient();
    const timerManager = new MockTimerManager();
    const fetchFn = createSafeExternalFetch({
      fetchExternalHttpsWithRedirects: mockRedirect.fetch,
      setTimer: timerManager.setTimer,
      clearTimer: timerManager.clearTimer
    });

    const controller = new AbortController();
    controller.abort();

    const result = await fetchFn("https://example.com", { signal: controller.signal });
    t.expectEqual((result as any).timedOut, false);
  });

  // TIMEOUT
  await runTest("15. timeout padrão é 8000", async (t) => {
    const mockRedirect = new MockRedirectClient();
    const timerManager = new MockTimerManager();
    const fetchFn = createSafeExternalFetch({
      fetchExternalHttpsWithRedirects: mockRedirect.fetch,
      setTimer: timerManager.setTimer,
      clearTimer: timerManager.clearTimer
    });

    fetchFn("https://example.com");
    t.expectEqual(timerManager.timers.length, 1);
    t.expectEqual(timerManager.timers[0].ms, 8000);
  });

  await runTest("16. timeout customizado válido é usado", async (t) => {
    const mockRedirect = new MockRedirectClient();
    const timerManager = new MockTimerManager();
    const fetchFn = createSafeExternalFetch({
      fetchExternalHttpsWithRedirects: mockRedirect.fetch,
      setTimer: timerManager.setTimer,
      clearTimer: timerManager.clearTimer
    });

    fetchFn("https://example.com", { timeoutMs: 5000 });
    t.expectEqual(timerManager.timers.length, 1);
    t.expectEqual(timerManager.timers[0].ms, 5000);
  });

  await runTest("17. timeout menor que 1000 usa padrão", async (t) => {
    const mockRedirect = new MockRedirectClient();
    const timerManager = new MockTimerManager();
    const fetchFn = createSafeExternalFetch({
      fetchExternalHttpsWithRedirects: mockRedirect.fetch,
      setTimer: timerManager.setTimer,
      clearTimer: timerManager.clearTimer
    });

    fetchFn("https://example.com", { timeoutMs: 999 });
    t.expectEqual(timerManager.timers.length, 1);
    t.expectEqual(timerManager.timers[0].ms, 8000);
  });

  await runTest("18. timeout maior que 15000 usa padrão", async (t) => {
    const mockRedirect = new MockRedirectClient();
    const timerManager = new MockTimerManager();
    const fetchFn = createSafeExternalFetch({
      fetchExternalHttpsWithRedirects: mockRedirect.fetch,
      setTimer: timerManager.setTimer,
      clearTimer: timerManager.clearTimer
    });

    fetchFn("https://example.com", { timeoutMs: 15001 });
    t.expectEqual(timerManager.timers.length, 1);
    t.expectEqual(timerManager.timers[0].ms, 8000);
  });

  await runTest("19. timeout decimal usa padrão", async (t) => {
    const mockRedirect = new MockRedirectClient();
    const timerManager = new MockTimerManager();
    const fetchFn = createSafeExternalFetch({
      fetchExternalHttpsWithRedirects: mockRedirect.fetch,
      setTimer: timerManager.setTimer,
      clearTimer: timerManager.clearTimer
    });

    fetchFn("https://example.com", { timeoutMs: 2500.5 });
    t.expectEqual(timerManager.timers.length, 1);
    t.expectEqual(timerManager.timers[0].ms, 8000);
  });

  await runTest("20. timeout string usa padrão", async (t) => {
    const mockRedirect = new MockRedirectClient();
    const timerManager = new MockTimerManager();
    const fetchFn = createSafeExternalFetch({
      fetchExternalHttpsWithRedirects: mockRedirect.fetch,
      setTimer: timerManager.setTimer,
      clearTimer: timerManager.clearTimer
    });

    fetchFn("https://example.com", { timeoutMs: "5000" as any });
    t.expectEqual(timerManager.timers.length, 1);
    t.expectEqual(timerManager.timers[0].ms, 8000);
  });

  await runTest("21. timeout negativo usa padrão", async (t) => {
    const mockRedirect = new MockRedirectClient();
    const timerManager = new MockTimerManager();
    const fetchFn = createSafeExternalFetch({
      fetchExternalHttpsWithRedirects: mockRedirect.fetch,
      setTimer: timerManager.setTimer,
      clearTimer: timerManager.clearTimer
    });

    fetchFn("https://example.com", { timeoutMs: -5000 });
    t.expectEqual(timerManager.timers.length, 1);
    t.expectEqual(timerManager.timers[0].ms, 8000);
  });

  await runTest("22. timeout dispara abort no controller interno", async (t) => {
    const mockRedirect = new MockRedirectClient();
    const timerManager = new MockTimerManager();
    let aborted = false;
    const fetchFn = createSafeExternalFetch({
      fetchExternalHttpsWithRedirects: mockRedirect.fetch,
      setTimer: timerManager.setTimer,
      clearTimer: timerManager.clearTimer,
      createAbortController: () => {
        const c = new AbortController();
        c.signal.addEventListener("abort", () => {
          aborted = true;
        });
        return c;
      }
    });

    const promise = fetchFn("https://example.com");
    timerManager.trigger(timerManager.timers[0].id);
    await promise;
    t.expectTrue(aborted);
  });

  await runTest("23. timeout retorna SOURCE_TIMEOUT", async (t) => {
    const mockRedirect = new MockRedirectClient();
    const timerManager = new MockTimerManager();
    const fetchFn = createSafeExternalFetch({
      fetchExternalHttpsWithRedirects: mockRedirect.fetch,
      setTimer: timerManager.setTimer,
      clearTimer: timerManager.clearTimer
    });

    const promise = fetchFn("https://example.com");
    timerManager.trigger(timerManager.timers[0].id);
    const result = await promise;
    t.expectFalse(result.ok);
    t.expectEqual(result.statusCode, 504);
    t.expectEqual((result as any).error, "SOURCE_TIMEOUT");
  });

  await runTest("24. timeout retorna timedOut true", async (t) => {
    const mockRedirect = new MockRedirectClient();
    const timerManager = new MockTimerManager();
    const fetchFn = createSafeExternalFetch({
      fetchExternalHttpsWithRedirects: mockRedirect.fetch,
      setTimer: timerManager.setTimer,
      clearTimer: timerManager.clearTimer
    });

    const promise = fetchFn("https://example.com");
    timerManager.trigger(timerManager.timers[0].id);
    const result = await promise;
    t.expectEqual((result as any).timedOut, true);
  });

  await runTest("25. timeout limpa timer", async (t) => {
    const mockRedirect = new MockRedirectClient();
    const timerManager = new MockTimerManager();
    const fetchFn = createSafeExternalFetch({
      fetchExternalHttpsWithRedirects: mockRedirect.fetch,
      setTimer: timerManager.setTimer,
      clearTimer: timerManager.clearTimer
    });

    const promise = fetchFn("https://example.com");
    timerManager.trigger(timerManager.timers[0].id);
    await promise;
    t.expectTrue(timerManager.timers[0].cleared);
  });

  await runTest("26. timeout não resolve duas vezes", async (t) => {
    const mockRedirect = new MockRedirectClient();
    const timerManager = new MockTimerManager();
    const fetchFn = createSafeExternalFetch({
      fetchExternalHttpsWithRedirects: mockRedirect.fetch,
      setTimer: timerManager.setTimer,
      clearTimer: timerManager.clearTimer
    });

    let resolvedCount = 0;
    const promise = fetchFn("https://example.com");
    promise.then(() => {
      resolvedCount++;
    });

    timerManager.trigger(timerManager.timers[0].id);
    await promise;
    // trigger again
    timerManager.trigger(timerManager.timers[0].id);
    await new Promise((r) => setTimeout(r, 5));
    t.expectEqual(resolvedCount, 1);
  });

  await runTest("27. evento tardio após timeout não altera resultado", async (t) => {
    const mockRedirect = new MockRedirectClient();
    const timerManager = new MockTimerManager();
    const fetchFn = createSafeExternalFetch({
      fetchExternalHttpsWithRedirects: mockRedirect.fetch,
      setTimer: timerManager.setTimer,
      clearTimer: timerManager.clearTimer
    });

    let resultReceived: any = null;
    const promise = fetchFn("https://example.com");
    promise.then((res) => {
      resultReceived = res;
    });

    timerManager.trigger(timerManager.timers[0].id);
    await promise;

    mockRedirect.queueResponse({ ok: true, body: "success", statusCode: 200, contentType: "text/plain", hostname: "example.com", bytes: 7, redirectsFollowed: 0 });
    await new Promise((r) => setTimeout(r, 10));

    t.expectFalse(resultReceived.ok);
    t.expectEqual(resultReceived.statusCode, 504);
    t.expectEqual(resultReceived.error, "SOURCE_TIMEOUT");
    t.expectEqual(resultReceived.timedOut, true);
  });

  // ABORT EXTERNO DURANTE EXECUÇÃO
  await runTest("28. abort externo durante execução aborta controller interno", async (t) => {
    const mockRedirect = new MockRedirectClient();
    const timerManager = new MockTimerManager();
    let aborted = false;
    const fetchFn = createSafeExternalFetch({
      fetchExternalHttpsWithRedirects: mockRedirect.fetch,
      setTimer: timerManager.setTimer,
      clearTimer: timerManager.clearTimer,
      createAbortController: () => {
        const c = new AbortController();
        c.signal.addEventListener("abort", () => {
          aborted = true;
        });
        return c;
      }
    });

    const controller = new AbortController();
    const promise = fetchFn("https://example.com", { signal: controller.signal });
    controller.abort();
    await promise;
    t.expectTrue(aborted);
  });

  await runTest("29. abort externo retorna SOURCE_TIMEOUT", async (t) => {
    const mockRedirect = new MockRedirectClient();
    const timerManager = new MockTimerManager();
    const fetchFn = createSafeExternalFetch({
      fetchExternalHttpsWithRedirects: mockRedirect.fetch,
      setTimer: timerManager.setTimer,
      clearTimer: timerManager.clearTimer
    });

    const controller = new AbortController();
    const promise = fetchFn("https://example.com", { signal: controller.signal });
    controller.abort();
    const result = await promise;
    t.expectFalse(result.ok);
    t.expectEqual(result.statusCode, 504);
    t.expectEqual((result as any).error, "SOURCE_TIMEOUT");
  });

  await runTest("30. abort externo retorna timedOut false", async (t) => {
    const mockRedirect = new MockRedirectClient();
    const timerManager = new MockTimerManager();
    const fetchFn = createSafeExternalFetch({
      fetchExternalHttpsWithRedirects: mockRedirect.fetch,
      setTimer: timerManager.setTimer,
      clearTimer: timerManager.clearTimer
    });

    const controller = new AbortController();
    const promise = fetchFn("https://example.com", { signal: controller.signal });
    controller.abort();
    const result = await promise;
    t.expectEqual((result as any).timedOut, false);
  });

  await runTest("31. abort externo limpa timer", async (t) => {
    const mockRedirect = new MockRedirectClient();
    const timerManager = new MockTimerManager();
    const fetchFn = createSafeExternalFetch({
      fetchExternalHttpsWithRedirects: mockRedirect.fetch,
      setTimer: timerManager.setTimer,
      clearTimer: timerManager.clearTimer
    });

    const controller = new AbortController();
    const promise = fetchFn("https://example.com", { signal: controller.signal });
    controller.abort();
    await promise;
    t.expectTrue(timerManager.timers[0].cleared);
  });

  await runTest("32. abort externo remove listener", async (t) => {
    const mockRedirect = new MockRedirectClient();
    const timerManager = new MockTimerManager();
    let listenersCount = 0;
    const controller = new AbortController();
    
    const origAdd = controller.signal.addEventListener.bind(controller.signal);
    const origRemove = controller.signal.removeEventListener.bind(controller.signal);
    controller.signal.addEventListener = (event: string, handler: any) => {
      listenersCount++;
      return origAdd(event, handler);
    };
    controller.signal.removeEventListener = (event: string, handler: any) => {
      listenersCount--;
      return origRemove(event, handler);
    };

    const fetchFn = createSafeExternalFetch({
      fetchExternalHttpsWithRedirects: mockRedirect.fetch,
      setTimer: timerManager.setTimer,
      clearTimer: timerManager.clearTimer
    });

    const promise = fetchFn("https://example.com", { signal: controller.signal });
    controller.abort();
    await promise;
    t.expectEqual(listenersCount, 0);
  });

  await runTest("33. resultado tardio após abort externo não altera resultado", async (t) => {
    const mockRedirect = new MockRedirectClient();
    const timerManager = new MockTimerManager();
    const fetchFn = createSafeExternalFetch({
      fetchExternalHttpsWithRedirects: mockRedirect.fetch,
      setTimer: timerManager.setTimer,
      clearTimer: timerManager.clearTimer
    });

    const controller = new AbortController();
    let resultReceived: any = null;
    const promise = fetchFn("https://example.com", { signal: controller.signal });
    promise.then((res) => {
      resultReceived = res;
    });

    controller.abort();
    await promise;

    mockRedirect.queueResponse({ ok: true, body: "success", statusCode: 200, contentType: "text/plain", hostname: "example.com", bytes: 7, redirectsFollowed: 0 });
    await new Promise((r) => setTimeout(r, 10));

    t.expectFalse(resultReceived.ok);
    t.expectEqual(resultReceived.statusCode, 504);
    t.expectEqual(resultReceived.error, "SOURCE_TIMEOUT");
    t.expectEqual(resultReceived.timedOut, false);
  });

  await runTest("34. rejeição tardia após abort externo não gera unhandledRejection", async (t) => {
    const mockRedirect = new MockRedirectClient();
    const timerManager = new MockTimerManager();
    const fetchFn = createSafeExternalFetch({
      fetchExternalHttpsWithRedirects: mockRedirect.fetch,
      setTimer: timerManager.setTimer,
      clearTimer: timerManager.clearTimer
    });

    const controller = new AbortController();
    const promise = fetchFn("https://example.com", { signal: controller.signal });
    
    mockRedirect.queueResponse(new Error("fetch failed late"));

    controller.abort();
    const result = await promise;

    t.expectFalse(result.ok);
    t.expectEqual(result.statusCode, 504);
    t.expectEqual((result as any).error, "SOURCE_TIMEOUT");
    t.expectEqual((result as any).timedOut, false);
  });

  // SUCESSO
  await runTest("35-49. sucesso do redirect client", async (t) => {
    const mockRedirect = new MockRedirectClient();
    const timerManager = new MockTimerManager();
    const controller = new AbortController();
    let listenersCount = 0;
    
    const origAdd = controller.signal.addEventListener.bind(controller.signal);
    const origRemove = controller.signal.removeEventListener.bind(controller.signal);
    controller.signal.addEventListener = (event: string, handler: any) => {
      listenersCount++;
      return origAdd(event, handler);
    };
    controller.signal.removeEventListener = (event: string, handler: any) => {
      listenersCount--;
      return origRemove(event, handler);
    };

    const fetchFn = createSafeExternalFetch({
      fetchExternalHttpsWithRedirects: mockRedirect.fetch,
      setTimer: timerManager.setTimer,
      clearTimer: timerManager.clearTimer
    });

    mockRedirect.queueResponse({
      ok: true,
      body: "success content",
      statusCode: 200,
      contentType: "text/plain",
      hostname: "example.com",
      bytes: 15,
      redirectsFollowed: 1,
      headers: { "x-secret": "123" },
      cookies: ["session=abc"],
      selectedAddress: "93.184.216.34",
      addresses: ["93.184.216.34"]
    });

    const result = await fetchFn("https://example.com/foo", { signal: controller.signal });

    t.expectTrue(result.ok);
    const success = result as SafeExternalFetchSuccess;
    t.expectEqual(success.body, "success content");
    t.expectEqual(success.statusCode, 200);
    t.expectEqual(success.contentType, "text/plain");
    t.expectEqual(success.hostname, "example.com");
    t.expectEqual(success.bytes, 15);
    t.expectEqual(success.redirectsFollowed, 1);
    t.expectEqual(success.timedOut, false);
    t.expectTrue(timerManager.timers[0].cleared);
    t.expectEqual(listenersCount, 0);

    // Privacy checks
    t.expectEqual((success as any).headers, undefined);
    t.expectEqual((success as any).cookies, undefined);
    t.expectEqual((success as any).selectedAddress, undefined);
    t.expectEqual((success as any).addresses, undefined);
    t.expectEqual((success as any).rawUrl, undefined);
    t.expectEqual((success as any).href, undefined);
  });

  // ERROS REPASSADOS
  const errorCodes: Array<SafeExternalFetchFailure["error"]> = [
    "SOURCE_DNS_FAILED",
    "UNSAFE_SOURCE_URL",
    "SOURCE_HTTP_ERROR",
    "SOURCE_UNSUPPORTED_CONTENT_TYPE",
    "SOURCE_UNSUPPORTED_ENCODING",
    "SOURCE_TOO_LARGE",
    "SOURCE_REDIRECT_LIMIT",
    "SOURCE_REDIRECT_LOOP",
    "SOURCE_UNSAFE_REDIRECT",
    "SOURCE_FETCH_FAILED"
  ];

  for (const errorName of errorCodes) {
    await runTest(`50-67. Erro repassado: ${errorName}`, async (t) => {
      const mockRedirect = new MockRedirectClient();
      const timerManager = new MockTimerManager();
      const controller = new AbortController();
      let listenersCount = 0;
      
      const origAdd = controller.signal.addEventListener.bind(controller.signal);
      const origRemove = controller.signal.removeEventListener.bind(controller.signal);
      controller.signal.addEventListener = (event: string, handler: any) => {
        listenersCount++;
        return origAdd(event, handler);
      };
      controller.signal.removeEventListener = (event: string, handler: any) => {
        listenersCount--;
        return origRemove(event, handler);
      };

      const fetchFn = createSafeExternalFetch({
        fetchExternalHttpsWithRedirects: mockRedirect.fetch,
        setTimer: timerManager.setTimer,
        clearTimer: timerManager.clearTimer
      });

      mockRedirect.queueResponse({
        ok: false,
        statusCode: 400,
        error: errorName,
        message: "some message",
        stack: "some stack",
        location: "http://unsafe",
        redirectChain: ["url1"],
        headers: {},
        cookies: []
      });

      const result = await fetchFn("https://example.com/foo", { signal: controller.signal });

      t.expectFalse(result.ok);
      const fail = result as SafeExternalFetchFailure;
      t.expectEqual(fail.error, errorName);
      t.expectTrue(timerManager.timers[0].cleared);
      t.expectEqual(listenersCount, 0);

      // Privacy checks
      t.expectEqual((fail as any).message, undefined);
      t.expectEqual((fail as any).stack, undefined);
      t.expectEqual((fail as any).location, undefined);
      t.expectEqual((fail as any).redirectChain, undefined);
      t.expectEqual((fail as any).headers, undefined);
      t.expectEqual((fail as any).cookies, undefined);
    });
  }

  // SOURCE_TIMEOUT DO REDIRECT CLIENT
  await runTest("68. se timeout interno disparou, SOURCE_TIMEOUT do redirect client retorna timedOut true", async (t) => {
    const mockRedirect = new MockRedirectClient();
    const timerManager = new MockTimerManager();
    const fetchFn = createSafeExternalFetch({
      fetchExternalHttpsWithRedirects: mockRedirect.fetch,
      setTimer: timerManager.setTimer,
      clearTimer: timerManager.clearTimer
    });

    const promise = fetchFn("https://example.com");
    timerManager.trigger(timerManager.timers[0].id);
    const result = await promise;
    t.expectFalse(result.ok);
    t.expectEqual(result.statusCode, 504);
    t.expectEqual((result as any).error, "SOURCE_TIMEOUT");
    t.expectEqual((result as any).timedOut, true);
  });

  await runTest("69. se abort externo disparou, SOURCE_TIMEOUT do redirect client retorna timedOut false", async (t) => {
    const mockRedirect = new MockRedirectClient();
    const timerManager = new MockTimerManager();
    const fetchFn = createSafeExternalFetch({
      fetchExternalHttpsWithRedirects: mockRedirect.fetch,
      setTimer: timerManager.setTimer,
      clearTimer: timerManager.clearTimer
    });

    const controller = new AbortController();
    const promise = fetchFn("https://example.com", { signal: controller.signal });
    controller.abort();
    const result = await promise;
    t.expectFalse(result.ok);
    t.expectEqual(result.statusCode, 504);
    t.expectEqual((result as any).error, "SOURCE_TIMEOUT");
    t.expectEqual((result as any).timedOut, false);
  });

  await runTest("70. se redirect client retorna SOURCE_TIMEOUT sem timeout/abort externo, timedOut é false ou ausente, mas nunca true", async (t) => {
    const mockRedirect = new MockRedirectClient();
    const timerManager = new MockTimerManager();
    const fetchFn = createSafeExternalFetch({
      fetchExternalHttpsWithRedirects: mockRedirect.fetch,
      setTimer: timerManager.setTimer,
      clearTimer: timerManager.clearTimer
    });

    mockRedirect.queueResponse({ ok: false, statusCode: 504, error: "SOURCE_TIMEOUT" });

    const result = await fetchFn("https://example.com");
    t.expectFalse(result.ok);
    t.expectEqual(result.statusCode, 504);
    t.expectEqual((result as any).error, "SOURCE_TIMEOUT");
    t.expectTrue((result as any).timedOut === false || (result as any).timedOut === undefined);
  });

  // MAX REDIRECTS
  await runTest("71. maxRedirects é repassado ao redirect client", async (t) => {
    const mockRedirect = new MockRedirectClient();
    const timerManager = new MockTimerManager();
    const fetchFn = createSafeExternalFetch({
      fetchExternalHttpsWithRedirects: mockRedirect.fetch,
      setTimer: timerManager.setTimer,
      clearTimer: timerManager.clearTimer
    });

    mockRedirect.queueResponse({ ok: true, body: "ok", statusCode: 200, contentType: "text/plain", hostname: "example.com", bytes: 2, redirectsFollowed: 0 });

    await fetchFn("https://example.com", { maxRedirects: 3 });
    t.expectEqual(mockRedirect.calls[0].maxRedirects, 3);
  });

  await runTest("72. maxRedirects ausente permanece ausente", async (t) => {
    const mockRedirect = new MockRedirectClient();
    const timerManager = new MockTimerManager();
    const fetchFn = createSafeExternalFetch({
      fetchExternalHttpsWithRedirects: mockRedirect.fetch,
      setTimer: timerManager.setTimer,
      clearTimer: timerManager.clearTimer
    });

    mockRedirect.queueResponse({ ok: true, body: "ok", statusCode: 200, contentType: "text/plain", hostname: "example.com", bytes: 2, redirectsFollowed: 0 });

    await fetchFn("https://example.com");
    t.expectEqual(mockRedirect.calls[0].maxRedirects, undefined);
  });

  await runTest("73. maxRedirects 0 é repassado", async (t) => {
    const mockRedirect = new MockRedirectClient();
    const timerManager = new MockTimerManager();
    const fetchFn = createSafeExternalFetch({
      fetchExternalHttpsWithRedirects: mockRedirect.fetch,
      setTimer: timerManager.setTimer,
      clearTimer: timerManager.clearTimer
    });

    mockRedirect.queueResponse({ ok: true, body: "ok", statusCode: 200, contentType: "text/plain", hostname: "example.com", bytes: 2, redirectsFollowed: 0 });

    await fetchFn("https://example.com", { maxRedirects: 0 });
    t.expectEqual(mockRedirect.calls[0].maxRedirects, 0);
  });

  await runTest("74. maxRedirects 10 é repassado", async (t) => {
    const mockRedirect = new MockRedirectClient();
    const timerManager = new MockTimerManager();
    const fetchFn = createSafeExternalFetch({
      fetchExternalHttpsWithRedirects: mockRedirect.fetch,
      setTimer: timerManager.setTimer,
      clearTimer: timerManager.clearTimer
    });

    mockRedirect.queueResponse({ ok: true, body: "ok", statusCode: 200, contentType: "text/plain", hostname: "example.com", bytes: 2, redirectsFollowed: 0 });

    await fetchFn("https://example.com", { maxRedirects: 10 });
    t.expectEqual(mockRedirect.calls[0].maxRedirects, 10);
  });

  await runTest("75. maxRedirects inválido é repassado sem validação extra", async (t) => {
    const mockRedirect = new MockRedirectClient();
    const timerManager = new MockTimerManager();
    const fetchFn = createSafeExternalFetch({
      fetchExternalHttpsWithRedirects: mockRedirect.fetch,
      setTimer: timerManager.setTimer,
      clearTimer: timerManager.clearTimer
    });

    mockRedirect.queueResponse({ ok: true, body: "ok", statusCode: 200, contentType: "text/plain", hostname: "example.com", bytes: 2, redirectsFollowed: 0 });

    await fetchFn("https://example.com", { maxRedirects: -5 });
    t.expectEqual(mockRedirect.calls[0].maxRedirects, -5);
  });

  // EXCEÇÕES
  await runTest("76. exceção síncrona do redirect client vira SOURCE_FETCH_FAILED", async (t) => {
    const mockRedirect = {
      fetch: () => {
        throw new Error("sync error");
      }
    };
    const timerManager = new MockTimerManager();
    const fetchFn = createSafeExternalFetch({
      fetchExternalHttpsWithRedirects: mockRedirect.fetch,
      setTimer: timerManager.setTimer,
      clearTimer: timerManager.clearTimer
    });

    const result = await fetchFn("https://example.com");
    t.expectFalse(result.ok);
    t.expectEqual(result.statusCode, 502);
    t.expectEqual((result as any).error, "SOURCE_FETCH_FAILED");
  });

  await runTest("77. rejeição assíncrona do redirect client vira SOURCE_FETCH_FAILED", async (t) => {
    const mockRedirect = {
      fetch: async () => {
        throw new Error("async error");
      }
    };
    const timerManager = new MockTimerManager();
    const fetchFn = createSafeExternalFetch({
      fetchExternalHttpsWithRedirects: mockRedirect.fetch,
      setTimer: timerManager.setTimer,
      clearTimer: timerManager.clearTimer
    });

    const result = await fetchFn("https://example.com");
    t.expectFalse(result.ok);
    t.expectEqual(result.statusCode, 502);
    t.expectEqual((result as any).error, "SOURCE_FETCH_FAILED");
  });

  await runTest("78-81. exceção inesperada limpa timer e remove listener, sem vazar message ou stack", async (t) => {
    const mockRedirect = {
      fetch: async () => {
        throw new Error("secret detailed error description");
      }
    };
    const timerManager = new MockTimerManager();
    const controller = new AbortController();
    let listenersCount = 0;
    
    const origAdd = controller.signal.addEventListener.bind(controller.signal);
    const origRemove = controller.signal.removeEventListener.bind(controller.signal);
    controller.signal.addEventListener = (event: string, handler: any) => {
      listenersCount++;
      return origAdd(event, handler);
    };
    controller.signal.removeEventListener = (event: string, handler: any) => {
      listenersCount--;
      return origRemove(event, handler);
    };

    const fetchFn = createSafeExternalFetch({
      fetchExternalHttpsWithRedirects: mockRedirect.fetch,
      setTimer: timerManager.setTimer,
      clearTimer: timerManager.clearTimer
    });

    const result = await fetchFn("https://example.com", { signal: controller.signal });
    t.expectFalse(result.ok);
    t.expectEqual(result.statusCode, 502);
    t.expectEqual((result as any).error, "SOURCE_FETCH_FAILED");
    t.expectTrue(timerManager.timers[0].cleared);
    t.expectEqual(listenersCount, 0);

    // Privacy
    t.expectEqual((result as any).message, undefined);
    t.expectEqual((result as any).stack, undefined);
  });

  // PRIVACIDADE GERAL
  await runTest("82-93. privacidade total no resultado de erro e sucesso", async (t) => {
    const mockRedirect = new MockRedirectClient();
    const timerManager = new MockTimerManager();
    const fetchFn = createSafeExternalFetch({
      fetchExternalHttpsWithRedirects: mockRedirect.fetch,
      setTimer: timerManager.setTimer,
      clearTimer: timerManager.clearTimer
    });

    mockRedirect.queueResponse({
      ok: false,
      statusCode: 504,
      error: "SOURCE_TIMEOUT",
      rawUrl: "https://example.com/sensitive",
      href: "https://example.com/sensitive",
      query: "secret=123",
      fragment: "frag",
      request: {},
      response: {},
      selectedAddress: "127.0.0.1",
      addresses: ["127.0.0.1"],
      errorObject: new Error("internal details")
    });

    const result = await fetchFn("https://example.com");
    t.expectFalse(result.ok);
    
    // Check absence of all forbidden fields
    const keys = Object.keys(result);
    t.expectFalse(keys.includes("rawUrl"));
    t.expectFalse(keys.includes("href"));
    t.expectFalse(keys.includes("query"));
    t.expectFalse(keys.includes("fragment"));
    t.expectFalse(keys.includes("request"));
    t.expectFalse(keys.includes("response"));
    t.expectFalse(keys.includes("selectedAddress"));
    t.expectFalse(keys.includes("addresses"));
    t.expectFalse(keys.includes("errorObject"));
    t.expectFalse(keys.includes("redirectChain"));
    t.expectFalse(keys.includes("headers"));
    t.expectFalse(keys.includes("cookies"));

    // Success result privacy validation
    mockRedirect.queueResponse({
      ok: true,
      body: "body content",
      statusCode: 200,
      contentType: "text/plain",
      hostname: "example.com",
      bytes: 12,
      redirectsFollowed: 0,
      redirectChain: ["https://example.com"],
      headers: { "x-token": "12" },
      cookies: ["id=1"]
    });

    const successResult = await fetchFn("https://example.com");
    t.expectTrue(successResult.ok);
    const successKeys = Object.keys(successResult);
    t.expectFalse(successKeys.includes("redirectChain"));
    t.expectFalse(successKeys.includes("headers"));
    t.expectFalse(successKeys.includes("cookies"));
  });

  // PROTECTED EXCEPTIONS & DEVIATIONS
  await runTest("correcao2. createAbortController lança exceção", async (t) => {
    const mockRedirect = new MockRedirectClient();
    const timerManager = new MockTimerManager();
    const fetchFn = createSafeExternalFetch({
      fetchExternalHttpsWithRedirects: mockRedirect.fetch,
      setTimer: timerManager.setTimer,
      clearTimer: timerManager.clearTimer,
      createAbortController: () => {
        throw new Error("createAbortController secret error details");
      }
    });

    const result = await fetchFn("https://example.com");
    t.expectFalse(result.ok);
    t.expectEqual(result.statusCode, 502);
    t.expectEqual((result as any).error, "SOURCE_FETCH_FAILED");
    t.expectEqual(timerManager.timers.length, 0); // não cria timer
    t.expectEqual(mockRedirect.calls.length, 0); // não chama redirect client
    t.expectEqual((result as any).message, undefined); // não vaza message
    t.expectEqual((result as any).stack, undefined); // não vaza stack
  });

  await runTest("correcao3. setTimer lança exceção", async (t) => {
    const mockRedirect = new MockRedirectClient();
    let abortCalled = false;
    const fetchFn = createSafeExternalFetch({
      fetchExternalHttpsWithRedirects: mockRedirect.fetch,
      setTimer: () => {
        throw new Error("setTimer secret error details");
      },
      createAbortController: () => {
        const ctrl = new AbortController();
        const origAbort = ctrl.abort.bind(ctrl);
        ctrl.abort = () => {
          abortCalled = true;
          return origAbort();
        };
        return ctrl;
      }
    });

    const result = await fetchFn("https://example.com");
    t.expectFalse(result.ok);
    t.expectEqual(result.statusCode, 502);
    t.expectEqual((result as any).error, "SOURCE_FETCH_FAILED");
    t.expectTrue(abortCalled); // abort do controller interno foi chamado
    t.expectEqual(mockRedirect.calls.length, 0); // redirect client não foi chamado
    t.expectEqual((result as any).message, undefined);
    t.expectEqual((result as any).stack, undefined);
  });

  await runTest("correcao4. addEventListener lança exceção", async (t) => {
    const mockRedirect = new MockRedirectClient();
    const timerManager = new MockTimerManager();
    let abortCalled = false;
    const fetchFn = createSafeExternalFetch({
      fetchExternalHttpsWithRedirects: mockRedirect.fetch,
      setTimer: timerManager.setTimer,
      clearTimer: timerManager.clearTimer,
      createAbortController: () => {
        const ctrl = new AbortController();
        const origAbort = ctrl.abort.bind(ctrl);
        ctrl.abort = () => {
          abortCalled = true;
          return origAbort();
        };
        return ctrl;
      }
    });

    const signal = new AbortController().signal;
    Object.defineProperty(signal, "addEventListener", {
      value: () => {
        throw new Error("addEventListener secret error details");
      }
    });

    const result = await fetchFn("https://example.com", { signal });
    t.expectFalse(result.ok);
    t.expectEqual(result.statusCode, 502);
    t.expectEqual((result as any).error, "SOURCE_FETCH_FAILED");
    t.expectEqual(result.timedOut, false);
    t.expectTrue(timerManager.timers[0].cleared); // limpar timer se já criado
    t.expectTrue(abortCalled); // abortar controller interno
    t.expectEqual(mockRedirect.calls.length, 0); // não chamar redirect client
    t.expectEqual((result as any).message, undefined);
    t.expectEqual((result as any).stack, undefined);
  });

  await runTest("correcao5.1. clearTimer lança durante sucesso e sucesso ainda retorna", async (t) => {
    const mockRedirect = new MockRedirectClient();
    const timerManager = new MockTimerManager();
    const fetchFn = createSafeExternalFetch({
      fetchExternalHttpsWithRedirects: mockRedirect.fetch,
      setTimer: timerManager.setTimer,
      clearTimer: () => {
        throw new Error("clearTimer throw");
      }
    });
    mockRedirect.queueResponse({ ok: true, body: "ok", statusCode: 200, contentType: "text/plain", hostname: "example.com", bytes: 2, redirectsFollowed: 0 });
    const result = await fetchFn("https://example.com");
    t.expectTrue(result.ok);
    t.expectEqual((result as any).body, "ok");
  });

  await runTest("correcao5.2. clearTimer lança durante erro e erro ainda retorna", async (t) => {
    const mockRedirect = new MockRedirectClient();
    const timerManager = new MockTimerManager();
    const fetchFn = createSafeExternalFetch({
      fetchExternalHttpsWithRedirects: mockRedirect.fetch,
      setTimer: timerManager.setTimer,
      clearTimer: () => {
        throw new Error("clearTimer throw");
      }
    });
    mockRedirect.queueResponse({ ok: false, statusCode: 403, error: "UNSAFE_SOURCE_URL" });
    const result = await fetchFn("https://example.com");
    t.expectFalse(result.ok);
    t.expectEqual(result.statusCode, 403);
    t.expectEqual((result as any).error, "UNSAFE_SOURCE_URL");
  });

  await runTest("correcao5.3. clearTimer lança durante timeout e timeout ainda retorna", async (t) => {
    const mockRedirect = new MockRedirectClient();
    const timerManager = new MockTimerManager();
    const fetchFn = createSafeExternalFetch({
      fetchExternalHttpsWithRedirects: mockRedirect.fetch,
      setTimer: timerManager.setTimer,
      clearTimer: () => {
        throw new Error("clearTimer throw");
      }
    });
    const promise = fetchFn("https://example.com");
    timerManager.trigger(1);
    const result = await promise;
    t.expectFalse(result.ok);
    t.expectEqual(result.statusCode, 504);
    t.expectEqual((result as any).error, "SOURCE_TIMEOUT");
    t.expectTrue(result.timedOut);
  });

  await runTest("correcao5.4. clearTimer lança durante abort externo e abort ainda retorna", async (t) => {
    const mockRedirect = new MockRedirectClient();
    const timerManager = new MockTimerManager();
    const fetchFn = createSafeExternalFetch({
      fetchExternalHttpsWithRedirects: mockRedirect.fetch,
      setTimer: timerManager.setTimer,
      clearTimer: () => {
        throw new Error("clearTimer throw");
      }
    });
    const ctrl = new AbortController();
    const promise = fetchFn("https://example.com", { signal: ctrl.signal });
    ctrl.abort();
    const result = await promise;
    t.expectFalse(result.ok);
    t.expectEqual(result.statusCode, 504);
    t.expectEqual((result as any).error, "SOURCE_TIMEOUT");
    t.expectFalse(result.timedOut);
  });

  await runTest("correcao5.5. removeEventListener lança durante sucesso e sucesso ainda retorna", async (t) => {
    const mockRedirect = new MockRedirectClient();
    const timerManager = new MockTimerManager();
    const fetchFn = createSafeExternalFetch({
      fetchExternalHttpsWithRedirects: mockRedirect.fetch,
      setTimer: timerManager.setTimer,
      clearTimer: timerManager.clearTimer
    });
    const ctrl = new AbortController();
    Object.defineProperty(ctrl.signal, "removeEventListener", {
      value: () => {
        throw new Error("removeEventListener throw");
      }
    });
    mockRedirect.queueResponse({ ok: true, body: "ok", statusCode: 200, contentType: "text/plain", hostname: "example.com", bytes: 2, redirectsFollowed: 0 });
    const result = await fetchFn("https://example.com", { signal: ctrl.signal });
    t.expectTrue(result.ok);
    t.expectEqual((result as any).body, "ok");
  });

  await runTest("correcao5.6. removeEventListener lança durante erro e erro ainda retorna", async (t) => {
    const mockRedirect = new MockRedirectClient();
    const timerManager = new MockTimerManager();
    const fetchFn = createSafeExternalFetch({
      fetchExternalHttpsWithRedirects: mockRedirect.fetch,
      setTimer: timerManager.setTimer,
      clearTimer: timerManager.clearTimer
    });
    const ctrl = new AbortController();
    Object.defineProperty(ctrl.signal, "removeEventListener", {
      value: () => {
        throw new Error("removeEventListener throw");
      }
    });
    mockRedirect.queueResponse({ ok: false, statusCode: 403, error: "UNSAFE_SOURCE_URL" });
    const result = await fetchFn("https://example.com", { signal: ctrl.signal });
    t.expectFalse(result.ok);
    t.expectEqual(result.statusCode, 403);
    t.expectEqual((result as any).error, "UNSAFE_SOURCE_URL");
  });

  await runTest("correcao5.7. removeEventListener lança durante timeout e timeout ainda retorna", async (t) => {
    const mockRedirect = new MockRedirectClient();
    const timerManager = new MockTimerManager();
    const fetchFn = createSafeExternalFetch({
      fetchExternalHttpsWithRedirects: mockRedirect.fetch,
      setTimer: timerManager.setTimer,
      clearTimer: timerManager.clearTimer
    });
    const ctrl = new AbortController();
    Object.defineProperty(ctrl.signal, "removeEventListener", {
      value: () => {
        throw new Error("removeEventListener throw");
      }
    });
    const promise = fetchFn("https://example.com", { signal: ctrl.signal });
    timerManager.trigger(1);
    const result = await promise;
    t.expectFalse(result.ok);
    t.expectEqual(result.statusCode, 504);
    t.expectEqual((result as any).error, "SOURCE_TIMEOUT");
    t.expectTrue(result.timedOut);
  });

  await runTest("correcao5.8. removeEventListener lança durante abort externo e abort ainda retorna", async (t) => {
    const mockRedirect = new MockRedirectClient();
    const timerManager = new MockTimerManager();
    const fetchFn = createSafeExternalFetch({
      fetchExternalHttpsWithRedirects: mockRedirect.fetch,
      setTimer: timerManager.setTimer,
      clearTimer: timerManager.clearTimer
    });
    const ctrl = new AbortController();
    Object.defineProperty(ctrl.signal, "removeEventListener", {
      value: () => {
        throw new Error("removeEventListener throw");
      }
    });
    const promise = fetchFn("https://example.com", { signal: ctrl.signal });
    ctrl.abort();
    const result = await promise;
    t.expectFalse(result.ok);
    t.expectEqual(result.statusCode, 504);
    t.expectEqual((result as any).error, "SOURCE_TIMEOUT");
    t.expectFalse(result.timedOut);
  });

  await runTest("correcao6. rechecagem de abort externo immediately aborted", async (t) => {
    const mockRedirect = new MockRedirectClient();
    const timerManager = new MockTimerManager();
    let abortCalled = false;
    const fetchFn = createSafeExternalFetch({
      fetchExternalHttpsWithRedirects: mockRedirect.fetch,
      setTimer: timerManager.setTimer,
      clearTimer: timerManager.clearTimer,
      createAbortController: () => {
        const ctrl = new AbortController();
        const origAbort = ctrl.abort.bind(ctrl);
        ctrl.abort = () => {
          abortCalled = true;
          return origAbort();
        };
        return ctrl;
      }
    });

    const signalObj = {
      _aborted: false,
      get aborted() {
        return this._aborted;
      },
      addEventListener: (evt: string, cb: any) => {
        signalObj._aborted = true;
      },
      removeEventListener: (evt: string, cb: any) => {}
    };

    const result = await fetchFn("https://example.com", { signal: signalObj as any });
    t.expectFalse(result.ok);
    t.expectEqual(result.statusCode, 504);
    t.expectEqual((result as any).error, "SOURCE_TIMEOUT");
    t.expectFalse(result.timedOut);
    t.expectTrue(abortCalled); // abortar controller interno
    t.expectTrue(timerManager.timers[0].cleared); // limpar timer
    t.expectEqual(mockRedirect.calls.length, 0); // não chamar redirect client
  });

  // HIGIENE E INTEGRAÇÃO
  await runTest("94-115. Higiene estática e Isolamento", async (t) => {
    const fs = await import("node:fs");
    const content = fs.readFileSync("services/server/safeExternalFetch.ts", "utf8");
    const lowerContent = content.toLowerCase();

    // Check forbidden strings
    t.expectFalse(lowerContent.includes("console.log"));
    t.expectFalse(lowerContent.includes("console.error"));
    t.expectFalse(lowerContent.includes("console.warn"));
    t.expectFalse(lowerContent.includes("logger"));
    t.expectFalse(lowerContent.includes("node:https"));
    t.expectFalse(lowerContent.includes("node:http"));
    t.expectFalse(lowerContent.includes("node:tls"));
    t.expectFalse(lowerContent.includes("node:dns"));
    t.expectFalse(lowerContent.includes("node:fs"));
    t.expectFalse(/\bfetch\s*\(/i.test(content));
    t.expectFalse(lowerContent.includes("node-fetch"));
    t.expectFalse(lowerContent.includes("axios"));
    t.expectFalse(lowerContent.includes("express"));
    t.expectFalse(lowerContent.includes("firebase"));
    t.expectFalse(lowerContent.includes("@google/genai"));
    t.expectFalse(lowerContent.includes("gemini"));
    t.expectFalse(lowerContent.includes("process.env"));

    // Check server.ts does import safeExternalFetch
    const serverContent = fs.readFileSync("server.ts", "utf8");
    t.expectTrue(serverContent.includes("safeExternalFetch"));

    // Check app/applet paths do not exist
    t.expectFalse(fs.existsSync("app/applet/services/server/safeExternalFetch.ts"));
    t.expectFalse(fs.existsSync("app/applet/scripts/test_phase0_2c1c5_safe_external_fetch.ts"));

    // Check forbidden temporary files in root directory
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

  // INTEGRIDADE E ESCOPO
  await runTest("116-126. Integridade de arquivos protegidos", async (t) => {
    const fs = await import("node:fs");
    for (const file of PROTECTED_FILES) {
      t.expectTrue(fs.existsSync(file));
      const hash = readRequiredHash(file);
      t.expectEqual(hash, initialHashes[file]);
    }
  });

  await runTest("127-130. Escopo de arquivos da fase", async (t) => {
    const fs = await import("node:fs");
    
    t.expectTrue(fs.existsSync("services/server/safeExternalFetch.ts"));
    t.expectTrue(fs.existsSync("scripts/test_phase0_2c1c5_safe_external_fetch.ts"));
    t.expectFalse(fs.existsSync("app/applet/services/server/safeExternalFetch.ts"));
    t.expectFalse(fs.existsSync("app/applet/scripts/test_phase0_2c1c5_safe_external_fetch.ts"));
  });

  if (passedTests + failedTests !== registeredTests) {
    console.error(`Test accounting mismatch: registered (${registeredTests}) !== passed (${passedTests}) + failed (${failedTests})`);
    process.exitCode = 1;
  }

  console.log(`\n====================================`);
  console.log(`Phase 0.2C.1C.5 Test Suite Summary:`);
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
  console.error("Unhandled test execution error:", err);
  process.exit(1);
});
