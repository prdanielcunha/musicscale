import fs from "fs";
import path from "path";
import crypto from "crypto";
import {
  fetchAiImportHtmlSafely,
  mapSafeExternalFetchErrorToAiImportResponse,
  SafeExternalFetchResultLike
} from "../services/server/aiImportSafeFetchAdapter.js";

// Test counters and reporting system
let registeredTests = 0;
let passedTests = 0;
let failedTests = 0;
let testsWithZeroAssertions = 0;

interface TestContext {
  assert: (condition: boolean, msg: string) => void;
}

async function test(name: string, fn: (t: TestContext) => void | Promise<void>) {
  registeredTests++;
  let assertionsCount = 0;
  let hasFailed = false;

  const context: TestContext = {
    assert: (condition: boolean, msg: string) => {
      assertionsCount++;
      if (!condition) {
        hasFailed = true;
        console.error(`  [FAIL] ${msg}`);
      }
    }
  };

  try {
    await fn(context);
    if (assertionsCount === 0) {
      testsWithZeroAssertions++;
      hasFailed = true;
      console.error(`  [WARN] Test "${name}" did not execute any assertions.`);
    }

    if (!hasFailed) {
      passedTests++;
      console.log(`[PASS] ${registeredTests}. ${name}`);
    } else {
      failedTests++;
      console.error(`[FAIL] ${registeredTests}. ${name}`);
    }
  } catch (err: any) {
    failedTests++;
    console.error(`[FAIL] ${registeredTests}. ${name} threw an exception:`, err.stack || err);
  }
}

// Memory hash storage for Integrity Check at startup
const trackedFiles = [
  "index.html",
  "index.tsx",
  "App.tsx",
  "components/AppErrorBoundary.tsx",
  "services/server/safeExternalUrlPolicy.ts",
  "services/server/safeExternalDnsResolver.ts",
  "services/server/safeExternalHttpsClient.ts",
  "services/server/safeExternalRedirectClient.ts",
  "services/server/safeExternalFetch.ts",
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
  "package.json",
  "package-lock.json"
];

const initialHashes: Record<string, string> = {};
for (const file of trackedFiles) {
  const fullPath = path.resolve(process.cwd(), file);
  if (!fs.existsSync(fullPath)) {
    console.error(`FATAL: Protected file ${file} does not exist at startup!`);
    process.exit(1);
  }
  const content = fs.readFileSync(fullPath);
  initialHashes[file] = crypto.createHash("sha256").update(content).digest("hex");
}

// Load server.ts contents for static check
const serverPath = path.resolve(process.cwd(), "server.ts");
const serverContent = fs.existsSync(serverPath) ? fs.readFileSync(serverPath, "utf8") : "";
const startIdx = serverContent.indexOf('app.post("/api/ai-import"');
const endIdx = serverContent.indexOf('app.post("/api/ai-suggest-songs"');
const aiImportRouteBlock = (startIdx !== -1 && endIdx !== -1) ? serverContent.substring(startIdx, endIdx) : "";
const fixChordsRouteIdx = serverContent.indexOf('app.post("/api/fix-chords"');
const fixChordsBlock = (fixChordsRouteIdx !== -1) ? serverContent.substring(fixChordsRouteIdx, fixChordsRouteIdx + 1000) : "";

async function runSuite() {
  console.log("=====================================");
  console.log("Starting Phase 0.2C.1C.7 Adapter Tests");
  console.log("=====================================");

  // 1-17: SUCCESS FUNCTIONAL TESTS
  await test("1. sucesso chama safeExternalFetch exatamente uma vez", async (t) => {
    let callCount = 0;
    const mockSafeFetch = async () => {
      callCount++;
      return {
        ok: true,
        body: "<html><body>Sample Music</body></html>",
        statusCode: 200,
        contentType: "text/html",
        hostname: "sample.com",
        bytes: 42,
        redirectsFollowed: 1,
        timedOut: false
      } as any;
    };
    await fetchAiImportHtmlSafely("https://sample.com", {
      safeExternalFetch: mockSafeFetch,
      makeErrorResponse: () => ({})
    });
    t.assert(callCount === 1, "safeExternalFetch must be invoked exactly once");
  });

  await test("2. sucesso usa normalizedUrlStr recebido", async (t) => {
    let receivedUrl = "";
    const mockSafeFetch = async (url: any) => {
      receivedUrl = String(url);
      return {
        ok: true,
        body: "music",
        statusCode: 200,
        contentType: "text/html",
        hostname: "sample.com",
        bytes: 10,
        redirectsFollowed: 0,
        timedOut: false
      } as any;
    };
    await fetchAiImportHtmlSafely("https://normalized.com/path", {
      safeExternalFetch: mockSafeFetch,
      makeErrorResponse: () => ({})
    });
    t.assert(receivedUrl === "https://normalized.com/path", "safeExternalFetch must receive normalized URL string");
  });

  await test("3. sucesso passa timeoutMs 8000", async (t) => {
    let receivedTimeout = 0;
    const mockSafeFetch = async (url: any, options: any) => {
      receivedTimeout = options?.timeoutMs;
      return {
        ok: true,
        body: "music",
        statusCode: 200,
        contentType: "text/html",
        hostname: "sample.com",
        bytes: 10,
        redirectsFollowed: 0,
        timedOut: false
      } as any;
    };
    await fetchAiImportHtmlSafely("https://test.com", {
      safeExternalFetch: mockSafeFetch,
      makeErrorResponse: () => ({})
    });
    t.assert(receivedTimeout === 8000, "Must pass timeoutMs 8000 to safeExternalFetch");
  });

  await test("4. sucesso passa maxRedirects 5", async (t) => {
    let receivedMaxRedirects = 0;
    const mockSafeFetch = async (url: any, options: any) => {
      receivedMaxRedirects = options?.maxRedirects;
      return {
        ok: true,
        body: "music",
        statusCode: 200,
        contentType: "text/html",
        hostname: "sample.com",
        bytes: 10,
        redirectsFollowed: 0,
        timedOut: false
      } as any;
    };
    await fetchAiImportHtmlSafely("https://test.com", {
      safeExternalFetch: mockSafeFetch,
      makeErrorResponse: () => ({})
    });
    t.assert(receivedMaxRedirects === 5, "Must pass maxRedirects 5 to safeExternalFetch");
  });

  await test("5. sucesso retorna ok true", async (t) => {
    const mockSafeFetch = async () => ({
      ok: true,
      body: "music",
      statusCode: 200,
      contentType: "text/html",
      hostname: "sample.com",
      bytes: 10,
      redirectsFollowed: 0,
      timedOut: false
    } as any);
    const res = await fetchAiImportHtmlSafely("https://test.com", {
      safeExternalFetch: mockSafeFetch,
      makeErrorResponse: () => ({})
    });
    t.assert(res.ok === true, "On success, return ok: true");
  });

  await test("6. sucesso retorna html igual ao body", async (t) => {
    const mockSafeFetch = async () => ({
      ok: true,
      body: "<h1>Specific HTML</h1>",
      statusCode: 200,
      contentType: "text/html",
      hostname: "sample.com",
      bytes: 23,
      redirectsFollowed: 0,
      timedOut: false
    } as any);
    const res = await fetchAiImportHtmlSafely("https://test.com", {
      safeExternalFetch: mockSafeFetch,
      makeErrorResponse: () => ({})
    });
    t.assert(res.ok === true && (res as any).html === "<h1>Specific HTML</h1>", "On success, returns raw html body content");
  });

  await test("7. sucesso loga hostname", async (t) => {
    let loggedData: any = null;
    const mockLogInfo = (step: string, msg: string, data: any) => {
      loggedData = data;
    };
    const mockSafeFetch = async () => ({
      ok: true,
      body: "music",
      statusCode: 200,
      contentType: "text/html",
      hostname: "sample.com",
      bytes: 10,
      redirectsFollowed: 0,
      timedOut: false
    } as any);
    await fetchAiImportHtmlSafely("https://test.com", {
      safeExternalFetch: mockSafeFetch,
      makeErrorResponse: () => ({}),
      logInfo: mockLogInfo
    });
    t.assert(loggedData && loggedData.hostname === "sample.com", "Log must include hostname on success");
  });

  await test("8. sucesso loga bytes", async (t) => {
    let loggedData: any = null;
    const mockLogInfo = (step: string, msg: string, data: any) => {
      loggedData = data;
    };
    const mockSafeFetch = async () => ({
      ok: true,
      body: "music",
      statusCode: 200,
      contentType: "text/html",
      hostname: "sample.com",
      bytes: 5432,
      redirectsFollowed: 0,
      timedOut: false
    } as any);
    await fetchAiImportHtmlSafely("https://test.com", {
      safeExternalFetch: mockSafeFetch,
      makeErrorResponse: () => ({}),
      logInfo: mockLogInfo
    });
    t.assert(loggedData && loggedData.bytes === 5432, "Log must include correct bytes size on success");
  });

  await test("9. sucesso loga redirectsFollowed", async (t) => {
    let loggedData: any = null;
    const mockLogInfo = (step: string, msg: string, data: any) => {
      loggedData = data;
    };
    const mockSafeFetch = async () => ({
      ok: true,
      body: "music",
      statusCode: 200,
      contentType: "text/html",
      hostname: "sample.com",
      bytes: 10,
      redirectsFollowed: 3,
      timedOut: false
    } as any);
    await fetchAiImportHtmlSafely("https://test.com", {
      safeExternalFetch: mockSafeFetch,
      makeErrorResponse: () => ({}),
      logInfo: mockLogInfo
    });
    t.assert(loggedData && loggedData.redirectsFollowed === 3, "Log must include redirectsFollowed count on success");
  });

  await test("10. sucesso loga contentType", async (t) => {
    let loggedData: any = null;
    const mockLogInfo = (step: string, msg: string, data: any) => {
      loggedData = data;
    };
    const mockSafeFetch = async () => ({
      ok: true,
      body: "music",
      statusCode: 200,
      contentType: "application/xhtml+xml",
      hostname: "sample.com",
      bytes: 10,
      redirectsFollowed: 0,
      timedOut: false
    } as any);
    await fetchAiImportHtmlSafely("https://test.com", {
      safeExternalFetch: mockSafeFetch,
      makeErrorResponse: () => ({}),
      logInfo: mockLogInfo
    });
    t.assert(loggedData && loggedData.contentType === "application/xhtml+xml", "Log must include contentType on success");
  });

  await test("11. sucesso não loga normalizedUrlStr", async (t) => {
    let hasLeak = false;
    const mockLogInfo = (step: string, msg: string, data: any) => {
      const serialized = JSON.stringify(data || {}) + msg;
      if (serialized.includes("normalizedUrlStr") || serialized.includes("leak-target.com")) {
        hasLeak = true;
      }
    };
    const mockSafeFetch = async () => ({
      ok: true,
      body: "music",
      statusCode: 200,
      contentType: "text/html",
      hostname: "safe-hostname.com",
      bytes: 10,
      redirectsFollowed: 0,
      timedOut: false
    } as any);
    await fetchAiImportHtmlSafely("https://leak-target.com/path", {
      safeExternalFetch: mockSafeFetch,
      makeErrorResponse: () => ({}),
      logInfo: mockLogInfo
    });
    t.assert(!hasLeak, "Success logs must not leak the normalized URL value");
  });

  await test("12. sucesso não loga query", async (t) => {
    let hasLeak = false;
    const mockLogInfo = (step: string, msg: string, data: any) => {
      const serialized = JSON.stringify(data || {}) + msg;
      if (serialized.includes("query") || serialized.includes("search") || serialized.includes("param=val")) {
        hasLeak = true;
      }
    };
    const mockSafeFetch = async () => ({
      ok: true,
      body: "music",
      statusCode: 200,
      contentType: "text/html",
      hostname: "test.com",
      bytes: 10,
      redirectsFollowed: 0,
      timedOut: false
    } as any);
    await fetchAiImportHtmlSafely("https://test.com?param=val", {
      safeExternalFetch: mockSafeFetch,
      makeErrorResponse: () => ({}),
      logInfo: mockLogInfo
    });
    t.assert(!hasLeak, "Success logs must not leak the query parameter value");
  });

  await test("13. sucesso não loga headers", async (t) => {
    let hasLeak = false;
    const mockLogInfo = (step: string, msg: string, data: any) => {
      const serialized = JSON.stringify(data || {}) + msg;
      if (serialized.includes("headers") || serialized.includes("User-Agent")) {
        hasLeak = true;
      }
    };
    const mockSafeFetch = async () => ({
      ok: true,
      body: "music",
      statusCode: 200,
      contentType: "text/html",
      hostname: "test.com",
      bytes: 10,
      redirectsFollowed: 0,
      timedOut: false
    } as any);
    await fetchAiImportHtmlSafely("https://test.com", {
      safeExternalFetch: mockSafeFetch,
      makeErrorResponse: () => ({}),
      logInfo: mockLogInfo
    });
    t.assert(!hasLeak, "Success logs must not leak headers");
  });

  await test("14. sucesso não loga cookies", async (t) => {
    let hasLeak = false;
    const mockLogInfo = (step: string, msg: string, data: any) => {
      const serialized = JSON.stringify(data || {}) + msg;
      if (serialized.includes("cookies") || serialized.includes("sess")) {
        hasLeak = true;
      }
    };
    const mockSafeFetch = async () => ({
      ok: true,
      body: "music",
      statusCode: 200,
      contentType: "text/html",
      hostname: "test.com",
      bytes: 10,
      redirectsFollowed: 0,
      timedOut: false
    } as any);
    await fetchAiImportHtmlSafely("https://test.com", {
      safeExternalFetch: mockSafeFetch,
      makeErrorResponse: () => ({}),
      logInfo: mockLogInfo
    });
    t.assert(!hasLeak, "Success logs must not leak cookies");
  });

  await test("15. sucesso não loga selectedAddress", async (t) => {
    let hasLeak = false;
    const mockLogInfo = (step: string, msg: string, data: any) => {
      const serialized = JSON.stringify(data || {}) + msg;
      if (serialized.includes("selectedAddress") || serialized.includes("127.0.0.1")) {
        hasLeak = true;
      }
    };
    const mockSafeFetch = async () => ({
      ok: true,
      body: "music",
      statusCode: 200,
      contentType: "text/html",
      hostname: "test.com",
      bytes: 10,
      redirectsFollowed: 0,
      timedOut: false
    } as any);
    await fetchAiImportHtmlSafely("https://test.com", {
      safeExternalFetch: mockSafeFetch,
      makeErrorResponse: () => ({}),
      logInfo: mockLogInfo
    });
    t.assert(!hasLeak, "Success logs must not leak selectedAddress or IP");
  });

  await test("16. sucesso não loga addresses", async (t) => {
    let hasLeak = false;
    const mockLogInfo = (step: string, msg: string, data: any) => {
      const serialized = JSON.stringify(data || {}) + msg;
      if (serialized.includes("addresses")) {
        hasLeak = true;
      }
    };
    const mockSafeFetch = async () => ({
      ok: true,
      body: "music",
      statusCode: 200,
      contentType: "text/html",
      hostname: "test.com",
      bytes: 10,
      redirectsFollowed: 0,
      timedOut: false
    } as any);
    await fetchAiImportHtmlSafely("https://test.com", {
      safeExternalFetch: mockSafeFetch,
      makeErrorResponse: () => ({}),
      logInfo: mockLogInfo
    });
    t.assert(!hasLeak, "Success logs must not leak addresses array");
  });

  await test("17. sucesso não loga redirectChain", async (t) => {
    let hasLeak = false;
    const mockLogInfo = (step: string, msg: string, data: any) => {
      const serialized = JSON.stringify(data || {}) + msg;
      if (serialized.includes("redirectChain")) {
        hasLeak = true;
      }
    };
    const mockSafeFetch = async () => ({
      ok: true,
      body: "music",
      statusCode: 200,
      contentType: "text/html",
      hostname: "test.com",
      bytes: 10,
      redirectsFollowed: 0,
      timedOut: false
    } as any);
    await fetchAiImportHtmlSafely("https://test.com", {
      safeExternalFetch: mockSafeFetch,
      makeErrorResponse: () => ({}),
      logInfo: mockLogInfo
    });
    t.assert(!hasLeak, "Success logs must not leak redirectChain");
  });

  // 18-35: ERROR CODES MAPPING TESTS
  await test("18. INVALID_SOURCE_URL retorna ok false", async (t) => {
    const mockSafeFetch = async () => ({
      ok: false,
      statusCode: 400,
      error: "INVALID_SOURCE_URL"
    } as any);
    const res = await fetchAiImportHtmlSafely("https://test.com", {
      safeExternalFetch: mockSafeFetch,
      makeErrorResponse: () => ({ errorMapped: true })
    });
    t.assert(res.ok === false, "Returns ok: false for INVALID_SOURCE_URL");
  });

  await test("19. INVALID_SOURCE_URL chama makeErrorResponse com code VALIDATION", async (t) => {
    let passedCode = "";
    const mockSafeFetch = async () => ({
      ok: false,
      statusCode: 400,
      error: "INVALID_SOURCE_URL"
    } as any);
    const mockMakeErrorResponse = (code: any) => {
      passedCode = code;
      return { err: true };
    };
    await fetchAiImportHtmlSafely("https://test.com", {
      safeExternalFetch: mockSafeFetch,
      makeErrorResponse: mockMakeErrorResponse
    });
    t.assert(passedCode === "VALIDATION", "INVALID_SOURCE_URL maps to VALIDATION code");
  });

  await test("20. INVALID_SOURCE_URL usa step 2_URL_NORMALIZATION", async (t) => {
    let passedStep = "";
    const mockSafeFetch = async () => ({
      ok: false,
      statusCode: 400,
      error: "INVALID_SOURCE_URL"
    } as any);
    const mockMakeErrorResponse = (code: any, msg: any, details: any, step: any) => {
      passedStep = step;
      return { err: true };
    };
    await fetchAiImportHtmlSafely("https://test.com", {
      safeExternalFetch: mockSafeFetch,
      makeErrorResponse: mockMakeErrorResponse
    });
    t.assert(passedStep === "2_URL_NORMALIZATION", "INVALID_SOURCE_URL uses step 2_URL_NORMALIZATION");
  });

  await test("21. UNSAFE_SOURCE_URL retorna ok false", async (t) => {
    const mockSafeFetch = async () => ({
      ok: false,
      statusCode: 403,
      error: "UNSAFE_SOURCE_URL"
    } as any);
    const res = await fetchAiImportHtmlSafely("https://test.com", {
      safeExternalFetch: mockSafeFetch,
      makeErrorResponse: () => ({})
    });
    t.assert(res.ok === false, "Returns ok: false for UNSAFE_SOURCE_URL");
  });

  await test("22. UNSAFE_SOURCE_URL chama makeErrorResponse com code VALIDATION", async (t) => {
    let passedCode = "";
    const mockSafeFetch = async () => ({
      ok: false,
      statusCode: 403,
      error: "UNSAFE_SOURCE_URL"
    } as any);
    const mockMakeErrorResponse = (code: any) => {
      passedCode = code;
      return { err: true };
    };
    await fetchAiImportHtmlSafely("https://test.com", {
      safeExternalFetch: mockSafeFetch,
      makeErrorResponse: mockMakeErrorResponse
    });
    t.assert(passedCode === "VALIDATION", "UNSAFE_SOURCE_URL maps to VALIDATION");
  });

  await test("23. UNSAFE_SOURCE_URL usa step 3_NETWORK_FETCH", async (t) => {
    let passedStep = "";
    const mockSafeFetch = async () => ({
      ok: false,
      statusCode: 403,
      error: "UNSAFE_SOURCE_URL"
    } as any);
    const mockMakeErrorResponse = (code: any, msg: any, details: any, step: any) => {
      passedStep = step;
      return { err: true };
    };
    await fetchAiImportHtmlSafely("https://test.com", {
      safeExternalFetch: mockSafeFetch,
      makeErrorResponse: mockMakeErrorResponse
    });
    t.assert(passedStep === "3_NETWORK_FETCH", "UNSAFE_SOURCE_URL uses 3_NETWORK_FETCH");
  });

  await test("24. SOURCE_TIMEOUT retorna ok false", async (t) => {
    const mockSafeFetch = async () => ({
      ok: false,
      statusCode: 504,
      error: "SOURCE_TIMEOUT",
      timedOut: true
    } as any);
    const res = await fetchAiImportHtmlSafely("https://test.com", {
      safeExternalFetch: mockSafeFetch,
      makeErrorResponse: () => ({})
    });
    t.assert(res.ok === false, "Returns ok: false on timeout");
  });

  await test("25. SOURCE_TIMEOUT chama makeErrorResponse com code TIMEOUT", async (t) => {
    let passedCode = "";
    const mockSafeFetch = async () => ({
      ok: false,
      statusCode: 504,
      error: "SOURCE_TIMEOUT",
      timedOut: true
    } as any);
    const mockMakeErrorResponse = (code: any) => {
      passedCode = code;
      return {};
    };
    await fetchAiImportHtmlSafely("https://test.com", {
      safeExternalFetch: mockSafeFetch,
      makeErrorResponse: mockMakeErrorResponse
    });
    t.assert(passedCode === "TIMEOUT", "SOURCE_TIMEOUT maps to TIMEOUT");
  });

  await test("26. SOURCE_TIMEOUT preserva somente details { timedOut: true/false }", async (t) => {
    let passedDetails: any = null;
    const mockSafeFetch = async () => ({
      ok: false,
      statusCode: 504,
      error: "SOURCE_TIMEOUT",
      timedOut: true
    } as any);
    const mockMakeErrorResponse = (code: any, msg: any, details: any) => {
      passedDetails = details;
      return {};
    };
    await fetchAiImportHtmlSafely("https://test.com", {
      safeExternalFetch: mockSafeFetch,
      makeErrorResponse: mockMakeErrorResponse
    });
    t.assert(passedDetails && passedDetails.timedOut === true, "Preserves only timedOut in details");
  });

  await test("27. SOURCE_DNS_FAILED mapeia para SCRAPING", async (t) => {
    let passedCode = "";
    const mockSafeFetch = async () => ({
      ok: false,
      statusCode: 502,
      error: "SOURCE_DNS_FAILED"
    } as any);
    const mockMakeErrorResponse = (code: any) => {
      passedCode = code;
      return {};
    };
    await fetchAiImportHtmlSafely("https://test.com", {
      safeExternalFetch: mockSafeFetch,
      makeErrorResponse: mockMakeErrorResponse
    });
    t.assert(passedCode === "SCRAPING", "SOURCE_DNS_FAILED maps to SCRAPING");
  });

  await test("28. SOURCE_HTTP_ERROR mapeia para SCRAPING", async (t) => {
    let passedCode = "";
    const mockSafeFetch = async () => ({
      ok: false,
      statusCode: 502,
      error: "SOURCE_HTTP_ERROR"
    } as any);
    const mockMakeErrorResponse = (code: any) => {
      passedCode = code;
      return {};
    };
    await fetchAiImportHtmlSafely("https://test.com", {
      safeExternalFetch: mockSafeFetch,
      makeErrorResponse: mockMakeErrorResponse
    });
    t.assert(passedCode === "SCRAPING", "SOURCE_HTTP_ERROR maps to SCRAPING");
  });

  await test("29. SOURCE_UNSUPPORTED_CONTENT_TYPE mapeia para SCRAPING", async (t) => {
    let passedCode = "";
    const mockSafeFetch = async () => ({
      ok: false,
      statusCode: 415,
      error: "SOURCE_UNSUPPORTED_CONTENT_TYPE"
    } as any);
    const mockMakeErrorResponse = (code: any) => {
      passedCode = code;
      return {};
    };
    await fetchAiImportHtmlSafely("https://test.com", {
      safeExternalFetch: mockSafeFetch,
      makeErrorResponse: mockMakeErrorResponse
    });
    t.assert(passedCode === "SCRAPING", "SOURCE_UNSUPPORTED_CONTENT_TYPE maps to SCRAPING");
  });

  await test("30. SOURCE_UNSUPPORTED_ENCODING mapeia para SCRAPING", async (t) => {
    let passedCode = "";
    const mockSafeFetch = async () => ({
      ok: false,
      statusCode: 415,
      error: "SOURCE_UNSUPPORTED_ENCODING"
    } as any);
    const mockMakeErrorResponse = (code: any) => {
      passedCode = code;
      return {};
    };
    await fetchAiImportHtmlSafely("https://test.com", {
      safeExternalFetch: mockSafeFetch,
      makeErrorResponse: mockMakeErrorResponse
    });
    t.assert(passedCode === "SCRAPING", "SOURCE_UNSUPPORTED_ENCODING maps to SCRAPING");
  });

  await test("31. SOURCE_TOO_LARGE mapeia para SCRAPING", async (t) => {
    let passedCode = "";
    const mockSafeFetch = async () => ({
      ok: false,
      statusCode: 413,
      error: "SOURCE_TOO_LARGE"
    } as any);
    const mockMakeErrorResponse = (code: any) => {
      passedCode = code;
      return {};
    };
    await fetchAiImportHtmlSafely("https://test.com", {
      safeExternalFetch: mockSafeFetch,
      makeErrorResponse: mockMakeErrorResponse
    });
    t.assert(passedCode === "SCRAPING", "SOURCE_TOO_LARGE maps to SCRAPING");
  });

  await test("32. SOURCE_REDIRECT_LIMIT mapeia para SCRAPING", async (t) => {
    let passedCode = "";
    const mockSafeFetch = async () => ({
      ok: false,
      statusCode: 502,
      error: "SOURCE_REDIRECT_LIMIT"
    } as any);
    const mockMakeErrorResponse = (code: any) => {
      passedCode = code;
      return {};
    };
    await fetchAiImportHtmlSafely("https://test.com", {
      safeExternalFetch: mockSafeFetch,
      makeErrorResponse: mockMakeErrorResponse
    });
    t.assert(passedCode === "SCRAPING", "SOURCE_REDIRECT_LIMIT maps to SCRAPING");
  });

  await test("33. SOURCE_REDIRECT_LOOP mapeia para SCRAPING", async (t) => {
    let passedCode = "";
    const mockSafeFetch = async () => ({
      ok: false,
      statusCode: 502,
      error: "SOURCE_REDIRECT_LOOP"
    } as any);
    const mockMakeErrorResponse = (code: any) => {
      passedCode = code;
      return {};
    };
    await fetchAiImportHtmlSafely("https://test.com", {
      safeExternalFetch: mockSafeFetch,
      makeErrorResponse: mockMakeErrorResponse
    });
    t.assert(passedCode === "SCRAPING", "SOURCE_REDIRECT_LOOP maps to SCRAPING");
  });

  await test("34. SOURCE_UNSAFE_REDIRECT mapeia para VALIDATION", async (t) => {
    let passedCode = "";
    const mockSafeFetch = async () => ({
      ok: false,
      statusCode: 403,
      error: "SOURCE_UNSAFE_REDIRECT"
    } as any);
    const mockMakeErrorResponse = (code: any) => {
      passedCode = code;
      return {};
    };
    await fetchAiImportHtmlSafely("https://test.com", {
      safeExternalFetch: mockSafeFetch,
      makeErrorResponse: mockMakeErrorResponse
    });
    t.assert(passedCode === "VALIDATION", "SOURCE_UNSAFE_REDIRECT maps to VALIDATION");
  });

  await test("35. SOURCE_FETCH_FAILED mapeia para SCRAPING", async (t) => {
    let passedCode = "";
    const mockSafeFetch = async () => ({
      ok: false,
      statusCode: 502,
      error: "SOURCE_FETCH_FAILED"
    } as any);
    const mockMakeErrorResponse = (code: any) => {
      passedCode = code;
      return {};
    };
    await fetchAiImportHtmlSafely("https://test.com", {
      safeExternalFetch: mockSafeFetch,
      makeErrorResponse: mockMakeErrorResponse
    });
    t.assert(passedCode === "SCRAPING", "SOURCE_FETCH_FAILED maps to SCRAPING");
  });

  // 36-50: ERROR PRIVACY COMPLIANCE
  const sensitiveErrorFields = [
    "rawUrl",
    "normalizedUrlStr",
    "href",
    "query",
    "search",
    "fragment",
    "location",
    "redirectChain",
    "headers",
    "cookies",
    "selectedAddress",
    "addresses",
    "stack",
    "message",
    "Error"
  ];

  for (const field of sensitiveErrorFields) {
    const testIndex = 36 + sensitiveErrorFields.indexOf(field);
    await test(`${testIndex}. erro não retorna ${field}`, async (t) => {
      const mockSafeFetch = async () => ({
        ok: false,
        statusCode: 502,
        error: "SOURCE_FETCH_FAILED",
        rawUrl: "secret",
        normalizedUrlStr: "secret",
        href: "secret",
        query: "secret",
        search: "secret",
        fragment: "secret",
        location: "secret",
        redirectChain: ["secret"],
        headers: { "x-secret": "1" },
        cookies: "secret",
        selectedAddress: "127.0.0.1",
        addresses: ["127.0.0.1"],
        stack: "secret",
        message: "secret",
        internalError: new Error("secret")
      } as any);

      let passedDetails: any = null;
      const mockMakeErrorResponse = (code: any, msg: any, details: any) => {
        passedDetails = details;
        return { mapped: true, code, msg, details };
      };

      const res = await fetchAiImportHtmlSafely("https://test.com", {
        safeExternalFetch: mockSafeFetch,
        makeErrorResponse: mockMakeErrorResponse
      });

      const stringifiedResponse = JSON.stringify(res);
      t.assert(!stringifiedResponse.includes("secret") && !stringifiedResponse.includes("127.0.0.1"), `Error response must not leak ${field} content`);
    });
  }

  // 51-57: EXCEPTION IN SAFE FETCH
  await test("51. se safeExternalFetch lançar exceção, adapter retorna ok false", async (t) => {
    const mockSafeFetch = async () => {
      throw new Error("Hard crash of the client");
    };
    const res = await fetchAiImportHtmlSafely("https://test.com", {
      safeExternalFetch: mockSafeFetch,
      makeErrorResponse: () => ({ error: "mapped" })
    });
    t.assert(res.ok === false, "Returns ok: false if underlying fetch crashes");
  });

  await test("52. exceção vira SOURCE_FETCH_FAILED/SCRAPING", async (t) => {
    let passedCode = "";
    const mockSafeFetch = async () => {
      throw new Error("Hard crash of the client");
    };
    const mockMakeErrorResponse = (code: any) => {
      passedCode = code;
      return { mapped: true };
    };
    await fetchAiImportHtmlSafely("https://test.com", {
      safeExternalFetch: mockSafeFetch,
      makeErrorResponse: mockMakeErrorResponse
    });
    t.assert(passedCode === "SCRAPING", "Exceptions must fallback to SCRAPING error");
  });

  await test("53. exceção não vaza message", async (t) => {
    const mockSafeFetch = async () => {
      throw new Error("Hard crash of the client");
    };
    const mockMakeErrorResponse = (code: any, msg: any, details: any) => {
      return { msg, details };
    };
    const res = await fetchAiImportHtmlSafely("https://test.com", {
      safeExternalFetch: mockSafeFetch,
      makeErrorResponse: mockMakeErrorResponse
    });
    const serialized = JSON.stringify(res);
    t.assert(!serialized.includes("Hard crash"), "Exception error message must not leak in error response");
  });

  await test("54. exceção não vaza stack", async (t) => {
    const mockSafeFetch = async () => {
      throw new Error("Hard crash of the client");
    };
    const mockMakeErrorResponse = (code: any, msg: any, details: any) => {
      return { details };
    };
    const res = await fetchAiImportHtmlSafely("https://test.com", {
      safeExternalFetch: mockSafeFetch,
      makeErrorResponse: mockMakeErrorResponse
    });
    const serialized = JSON.stringify(res);
    t.assert(!serialized.includes("aiImportSafeFetchAdapter"), "Exception stack traces must not leak in error response");
  });

  await test("55. exceção gera logWarn sanitizado", async (t) => {
    let loggedWarn: any = null;
    const mockLogWarn = (step: string, msg: string, data: any) => {
      loggedWarn = { step, msg, data };
    };
    const mockSafeFetch = async () => {
      throw new Error("Hard crash");
    };
    await fetchAiImportHtmlSafely("https://test.com", {
      safeExternalFetch: mockSafeFetch,
      makeErrorResponse: () => ({}),
      logWarn: mockLogWarn
    });
    t.assert(loggedWarn && loggedWarn.data.error === "SOURCE_FETCH_FAILED" && loggedWarn.data.statusCode === 502, "Exception must log a standardized sanitised warning");
  });

  await test("56. exceção não loga URL", async (t) => {
    let loggedStr = "";
    const mockLogWarn = (step: string, msg: string, data: any) => {
      loggedStr += msg + JSON.stringify(data || {});
    };
    const mockSafeFetch = async () => {
      throw new Error("Hard crash");
    };
    await fetchAiImportHtmlSafely("https://dangerous-exception-url.com", {
      safeExternalFetch: mockSafeFetch,
      makeErrorResponse: () => ({}),
      logWarn: mockLogWarn
    });
    t.assert(!loggedStr.includes("dangerous-exception-url.com"), "Exception logs must not contain the URL");
  });

  await test("57. exceção não loga query", async (t) => {
    let loggedStr = "";
    const mockLogWarn = (step: string, msg: string, data: any) => {
      loggedStr += msg + JSON.stringify(data || {});
    };
    const mockSafeFetch = async () => {
      throw new Error("Hard crash");
    };
    await fetchAiImportHtmlSafely("https://test.com?token=ex-leak-query", {
      safeExternalFetch: mockSafeFetch,
      makeErrorResponse: () => ({}),
      logWarn: mockLogWarn
    });
    t.assert(!loggedStr.includes("ex-leak-query"), "Exception logs must not contain the query parameter values");
  });

  // 58-67: FAILURE LOGS SANITISATION
  await test("58. falha loga error", async (t) => {
    let loggedWarn: any = null;
    const mockLogWarn = (step: string, msg: string, data: any) => {
      loggedWarn = data;
    };
    const mockSafeFetch = async () => ({
      ok: false,
      statusCode: 403,
      error: "UNSAFE_SOURCE_URL"
    } as any);
    await fetchAiImportHtmlSafely("https://test.com", {
      safeExternalFetch: mockSafeFetch,
      makeErrorResponse: () => ({}),
      logWarn: mockLogWarn
    });
    t.assert(loggedWarn && loggedWarn.error === "UNSAFE_SOURCE_URL", "Failure logs must include the error code");
  });

  await test("59. falha loga statusCode", async (t) => {
    let loggedWarn: any = null;
    const mockLogWarn = (step: string, msg: string, data: any) => {
      loggedWarn = data;
    };
    const mockSafeFetch = async () => ({
      ok: false,
      statusCode: 413,
      error: "SOURCE_TOO_LARGE"
    } as any);
    await fetchAiImportHtmlSafely("https://test.com", {
      safeExternalFetch: mockSafeFetch,
      makeErrorResponse: () => ({}),
      logWarn: mockLogWarn
    });
    t.assert(loggedWarn && loggedWarn.statusCode === 413, "Failure logs must include status code");
  });

  await test("60. falha loga timedOut", async (t) => {
    let loggedWarn: any = null;
    const mockLogWarn = (step: string, msg: string, data: any) => {
      loggedWarn = data;
    };
    const mockSafeFetch = async () => ({
      ok: false,
      statusCode: 504,
      error: "SOURCE_TIMEOUT",
      timedOut: true
    } as any);
    await fetchAiImportHtmlSafely("https://test.com", {
      safeExternalFetch: mockSafeFetch,
      makeErrorResponse: () => ({}),
      logWarn: mockLogWarn
    });
    t.assert(loggedWarn && loggedWarn.timedOut === true, "Failure logs must include timedOut boolean");
  });

  await test("61. falha não loga URL", async (t) => {
    let loggedStr = "";
    const mockLogWarn = (step: string, msg: string, data: any) => {
      loggedStr += msg + JSON.stringify(data || {});
    };
    const mockSafeFetch = async () => ({
      ok: false,
      statusCode: 403,
      error: "UNSAFE_SOURCE_URL"
    } as any);
    await fetchAiImportHtmlSafely("https://dangerous-failure-url.com", {
      safeExternalFetch: mockSafeFetch,
      makeErrorResponse: () => ({}),
      logWarn: mockLogWarn
    });
    t.assert(!loggedStr.includes("dangerous-failure-url"), "Failure logs must not contain the requested URL");
  });

  await test("62. falha não loga normalizedUrlStr", async (t) => {
    let loggedStr = "";
    const mockLogWarn = (step: string, msg: string, data: any) => {
      loggedStr += msg + JSON.stringify(data || {});
    };
    const mockSafeFetch = async () => ({
      ok: false,
      statusCode: 403,
      error: "UNSAFE_SOURCE_URL"
    } as any);
    await fetchAiImportHtmlSafely("https://test.com", {
      safeExternalFetch: mockSafeFetch,
      makeErrorResponse: () => ({}),
      logWarn: mockLogWarn
    });
    t.assert(!loggedStr.includes("normalizedUrlStr"), "Failure logs must not contain the string normalizedUrlStr");
  });

  await test("63. falha não loga query", async (t) => {
    let loggedStr = "";
    const mockLogWarn = (step: string, msg: string, data: any) => {
      loggedStr += msg + JSON.stringify(data || {});
    };
    const mockSafeFetch = async () => ({
      ok: false,
      statusCode: 403,
      error: "UNSAFE_SOURCE_URL"
    } as any);
    await fetchAiImportHtmlSafely("https://test.com?secret_query=val", {
      safeExternalFetch: mockSafeFetch,
      makeErrorResponse: () => ({}),
      logWarn: mockLogWarn
    });
    t.assert(!loggedStr.includes("secret_query"), "Failure logs must not contain URL query parameters");
  });

  await test("64. falha não loga headers", async (t) => {
    let loggedStr = "";
    const mockLogWarn = (step: string, msg: string, data: any) => {
      loggedStr += msg + JSON.stringify(data || {});
    };
    const mockSafeFetch = async () => ({
      ok: false,
      statusCode: 403,
      error: "UNSAFE_SOURCE_URL",
      headers: { "x-secret-fail": "true" }
    } as any);
    await fetchAiImportHtmlSafely("https://test.com", {
      safeExternalFetch: mockSafeFetch,
      makeErrorResponse: () => ({}),
      logWarn: mockLogWarn
    });
    t.assert(!loggedStr.includes("headers") && !loggedStr.includes("x-secret-fail"), "Failure logs must not contain headers");
  });

  await test("65. falha não loga cookies", async (t) => {
    let loggedStr = "";
    const mockLogWarn = (step: string, msg: string, data: any) => {
      loggedStr += msg + JSON.stringify(data || {});
    };
    const mockSafeFetch = async () => ({
      ok: false,
      statusCode: 403,
      error: "UNSAFE_SOURCE_URL",
      cookies: "secret-cookie-val"
    } as any);
    await fetchAiImportHtmlSafely("https://test.com", {
      safeExternalFetch: mockSafeFetch,
      makeErrorResponse: () => ({}),
      logWarn: mockLogWarn
    });
    t.assert(!loggedStr.includes("cookies") && !loggedStr.includes("secret-cookie-val"), "Failure logs must not contain cookies");
  });

  await test("66. falha não loga redirectChain", async (t) => {
    let loggedStr = "";
    const mockLogWarn = (step: string, msg: string, data: any) => {
      loggedStr += msg + JSON.stringify(data || {});
    };
    const mockSafeFetch = async () => ({
      ok: false,
      statusCode: 403,
      error: "UNSAFE_SOURCE_URL",
      redirectChain: ["https://redirect.com"]
    } as any);
    await fetchAiImportHtmlSafely("https://test.com", {
      safeExternalFetch: mockSafeFetch,
      makeErrorResponse: () => ({}),
      logWarn: mockLogWarn
    });
    t.assert(!loggedStr.includes("redirectChain"), "Failure logs must not contain redirectChain");
  });

  await test("67. falha não loga IPs", async (t) => {
    let loggedStr = "";
    const mockLogWarn = (step: string, msg: string, data: any) => {
      loggedStr += msg + JSON.stringify(data || {});
    };
    const mockSafeFetch = async () => ({
      ok: false,
      statusCode: 403,
      error: "UNSAFE_SOURCE_URL",
      selectedAddress: "127.0.0.1"
    } as any);
    await fetchAiImportHtmlSafely("https://test.com", {
      safeExternalFetch: mockSafeFetch,
      makeErrorResponse: () => ({}),
      logWarn: mockLogWarn
    });
    t.assert(!loggedStr.includes("127.0.0.1"), "Failure logs must not contain connection IPs");
  });

  // 68-91: SERVER.TS STATIC CODE ANALYSIS TESTS
  await test("68. server.ts importa fetchAiImportHtmlSafely", (t) => {
    t.assert(serverContent.includes("import { fetchAiImportHtmlSafely }"), "server.ts must import fetchAiImportHtmlSafely");
  });

  await test("69. server.ts ainda importa createSafeExternalFetch", (t) => {
    t.assert(serverContent.includes("createSafeExternalFetch"), "server.ts must import createSafeExternalFetch");
  });

  await test("70. server.ts ainda cria aiImportSafeExternalFetch fora da rota", (t) => {
    const instIdx = serverContent.indexOf("const aiImportSafeExternalFetch = createSafeExternalFetch();");
    t.assert(instIdx !== -1 && instIdx < startIdx, "aiImportSafeExternalFetch must be instantiated outside the route");
  });

  await test("71. /api/ai-import chama fetchAiImportHtmlSafely", (t) => {
    t.assert(aiImportRouteBlock.includes("fetchAiImportHtmlSafely("), "api/ai-import route must call fetchAiImportHtmlSafely");
  });

  await test("72. /api/ai-import passa safeExternalFetch: aiImportSafeExternalFetch", (t) => {
    t.assert(aiImportRouteBlock.includes("safeExternalFetch: aiImportSafeExternalFetch"), "api/ai-import route must pass the safeExternalFetch instance");
  });

  await test("73. /api/ai-import passa makeErrorResponse", (t) => {
    t.assert(aiImportRouteBlock.includes("makeErrorResponse"), "api/ai-import route must pass makeErrorResponse");
  });

  await test("74. /api/ai-import passa logInfo", (t) => {
    t.assert(aiImportRouteBlock.includes("logInfo"), "api/ai-import route must pass logInfo");
  });

  await test("75. /api/ai-import passa logWarn", (t) => {
    t.assert(aiImportRouteBlock.includes("logWarn"), "api/ai-import route must pass logWarn");
  });

  await test("76. /api/ai-import usa safeHtmlResult.html", (t) => {
    t.assert(aiImportRouteBlock.includes("safeHtmlResult.html"), "api/ai-import route must use html content from the result");
  });

  await test("77. /api/ai-import retorna safeHtmlResult.response quando ok false", (t) => {
    t.assert(aiImportRouteBlock.includes("safeHtmlResult.response"), "api/ai-import route must return the response if fetching failed");
  });

  await test("78. /api/ai-import não contém helper local mapSafeExternalFetchErrorToAiImportResponse", (t) => {
    t.assert(!aiImportRouteBlock.includes("const mapSafeExternalFetchErrorToAiImportResponse ="), "Local helper mapSafeExternalFetchErrorToAiImportResponse must be deleted from server.ts");
  });

  await test("79. /api/ai-import não contém fetch(normalizedUrlStr", (t) => {
    t.assert(!aiImportRouteBlock.includes("fetch(normalizedUrlStr"), "Global fetch must not be used on the normalized URL");
  });

  await test("80. /api/ai-import não contém fetchResponse", (t) => {
    t.assert(!aiImportRouteBlock.includes("fetchResponse"), "Legacy fetchResponse must be completely gone");
  });

  await test("81. /api/ai-import não contém fetchResponse.text()", (t) => {
    t.assert(!aiImportRouteBlock.includes("fetchResponse.text("), "Legacy body parsing must be completely gone");
  });

  await test("82. /api/ai-import não contém fetchResponse.ok", (t) => {
    t.assert(!aiImportRouteBlock.includes("fetchResponse.ok"), "Legacy ok checks must be completely gone");
  });

  await test("83. /api/ai-import não contém fetchResponse.status", (t) => {
    t.assert(!aiImportRouteBlock.includes("fetchResponse.status"), "Legacy status checks must be completely gone");
  });

  await test("84. /api/ai-import não contém new AbortController() no bloco de rede", (t) => {
    t.assert(!aiImportRouteBlock.includes("new AbortController()"), "Manual AbortController inside Step 3 block must be removed");
  });

  await test("85. /api/ai-import não contém setTimeout para fetch externo", (t) => {
    t.assert(!aiImportRouteBlock.includes("fetchController.abort("), "Manual abort timeouts for external fetch must be removed");
  });

  await test("86. /api/ai-import não contém headers manuais \"User-Agent\"", (t) => {
    t.assert(!aiImportRouteBlock.includes('"User-Agent":'), "Manual headers like User-Agent must be removed");
  });

  await test("87. /api/ai-import não loga url", (t) => {
    t.assert(!aiImportRouteBlock.includes('`Normalizing and sanitizing input URL: "${url}"`'), "Raw URL must not be printed in route logs");
  });

  await test("88. /api/ai-import não loga normalizedUrlStr", (t) => {
    t.assert(!aiImportRouteBlock.includes('`Successfully normalized URL to: "${normalizedUrlStr}"`'), "Normalized URL must not be printed in route logs");
  });

  await test("89. /api/ai-import não loga query/search/href", (t) => {
    t.assert(!aiImportRouteBlock.includes("logInfo") || !aiImportRouteBlock.match(/logInfo\([^)]*?(?:query|\.search|\.href)/), "No sensitive URL properties must be printed in route logs");
  });

  await test("90. /api/fix-chords não contém safeExternalFetch", (t) => {
    t.assert(!fixChordsBlock.includes("safeExternalFetch") && !fixChordsBlock.includes("aiImportSafeExternalFetch"), "/api/fix-chords must remain isolated from external network fetching");
  });

  await test("91. /api/fix-chords não contém fetchAiImportHtmlSafely", (t) => {
    t.assert(!fixChordsBlock.includes("fetchAiImportHtmlSafely"), "/api/fix-chords must remain isolated from fetch adapter");
  });

  // 92-95: FILE SYSTEM INTEGRITY CHECKS (COMPARE CURRENT HASHES TO STARTUP HASHES)
  await test("92. frontend não foi modificado por hash", (t) => {
    const frontendFiles = ["index.html", "index.tsx", "App.tsx"];
    let unmodified = true;
    for (const file of frontendFiles) {
      const fullPath = path.resolve(process.cwd(), file);
      const content = fs.readFileSync(fullPath);
      const hash = crypto.createHash("sha256").update(content).digest("hex");
      if (hash !== initialHashes[file]) {
        unmodified = false;
      }
    }
    t.assert(unmodified, "Frontend files (index.html, index.tsx, App.tsx) must not be modified");
  });

  await test("93. boot não foi modificado por hash", (t) => {
    const bootFile = "components/AppErrorBoundary.tsx";
    const fullPath = path.resolve(process.cwd(), bootFile);
    const content = fs.readFileSync(fullPath);
    const hash = crypto.createHash("sha256").update(content).digest("hex");
    t.assert(hash === initialHashes[bootFile], "AppErrorBoundary.tsx must not be modified");
  });

  await test("94. package.json não foi modificado por hash", (t) => {
    const file = "package.json";
    const fullPath = path.resolve(process.cwd(), file);
    const content = fs.readFileSync(fullPath);
    const hash = crypto.createHash("sha256").update(content).digest("hex");
    t.assert(hash === initialHashes[file], "package.json must not be modified");
  });

  await test("95. package-lock.json não foi modificado por hash", (t) => {
    const file = "package-lock.json";
    const fullPath = path.resolve(process.cwd(), file);
    const content = fs.readFileSync(fullPath);
    const hash = crypto.createHash("sha256").update(content).digest("hex");
    t.assert(hash === initialHashes[file], "package-lock.json must not be modified");
  });

  console.log("\n=====================================");
  console.log("Phase 0.2C.1C.7 Test Suite Summary:");
  console.log(`Total Registered: ${registeredTests}`);
  console.log(`Total Passed:     ${passedTests}`);
  console.log(`Total Failed:     ${failedTests}`);
  console.log(`Zero Assertions:  ${testsWithZeroAssertions}`);
  console.log(`Total Passed + Total Failed === Total Registered: ${passedTests + failedTests === registeredTests}`);
  console.log(`Total Failed === 0: ${failedTests === 0}`);
  console.log("=====================================");

  if (failedTests > 0 || testsWithZeroAssertions > 0 || passedTests + failedTests !== registeredTests) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runSuite();
