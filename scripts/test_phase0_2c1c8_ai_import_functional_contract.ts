import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";
import {
  fetchAiImportHtmlSafely,
  mapSafeExternalFetchErrorToAiImportResponse,
  SafeExternalFetchResultLike
} from "../services/server/aiImportSafeFetchAdapter";

// 1. Setup Protected Files Checklist and calculate initial hashes
const protectedFiles = [
  "index.html",
  "index.tsx",
  "App.tsx",
  "components/AppErrorBoundary.tsx",
  "server.ts",
  "services/server/aiImportSafeFetchAdapter.ts",
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
  "scripts/test_phase0_2c1c7_ai_import_safe_fetch_adapter.ts",
  "package.json",
  "package-lock.json",
  "components/songs/AiSongImportModal.tsx",
  "components/songs/ChordsViewerModal.tsx"
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

// 3. Mocks Configuration & Initialization
let safeFetchCallCount = 0;
let safeFetchRawUrl: unknown = null;
let safeFetchOptions: { timeoutMs?: number; maxRedirects?: number } | undefined = undefined;

let mockSafeFetchResult: any = null;
let mockSafeFetchException: any = null;

let mockMakeErrorResponseCalls: { code: string; message: string; details: any; step: string }[] = [];
interface LogCall {
  type: "info" | "warn";
  step: string;
  msg: string;
  data: any;
}
let mockInfoLogs: LogCall[] = [];
let mockWarnLogs: LogCall[] = [];

function resetMocks() {
  safeFetchCallCount = 0;
  safeFetchRawUrl = null;
  safeFetchOptions = undefined;
  mockSafeFetchResult = null;
  mockSafeFetchException = null;
  mockMakeErrorResponseCalls = [];
  mockInfoLogs = [];
  mockWarnLogs = [];
}

async function mockSafeExternalFetch(rawUrl: unknown, options?: { timeoutMs?: number; maxRedirects?: number }) {
  safeFetchCallCount++;
  safeFetchRawUrl = rawUrl;
  safeFetchOptions = options;

  if (mockSafeFetchException) {
    throw mockSafeFetchException;
  }
  return mockSafeFetchResult;
}

function mockMakeErrorResponse(code: any, message: string, details?: any, step?: string) {
  const call = { code, message, details, step: step || "" };
  mockMakeErrorResponseCalls.push(call);
  return {
    ok: false,
    code,
    message,
    details: details || null,
    step: step || "UNKNOWN"
  };
}

function mockLogInfo(step: string, msg: string, data?: any) {
  mockInfoLogs.push({ type: "info", step, msg, data });
}

function mockLogWarn(step: string, msg: string, data?: any) {
  mockWarnLogs.push({ type: "warn", step, msg, data });
}

// 4. Test Orchestrator
async function runAdapterScenario(safeFetchResultOrThrow: any) {
  resetMocks();
  if (safeFetchResultOrThrow instanceof Error) {
    mockSafeFetchException = safeFetchResultOrThrow;
  } else {
    mockSafeFetchResult = safeFetchResultOrThrow;
  }

  const result = await fetchAiImportHtmlSafely("https://safe.example.com/song?secret=SHOULD_NOT_LEAK", {
    safeExternalFetch: mockSafeExternalFetch,
    makeErrorResponse: mockMakeErrorResponse,
    logInfo: mockLogInfo,
    logWarn: mockLogWarn
  });

  const allLogs = [...mockInfoLogs, ...mockWarnLogs];
  const allSerializedLogs = JSON.stringify(allLogs);
  const allSerializedResponse = JSON.stringify(result);

  return {
    result,
    safeFetchCalls: safeFetchCallCount,
    makeErrorResponseCalls: mockMakeErrorResponseCalls,
    infoLogs: mockInfoLogs,
    warnLogs: mockWarnLogs,
    allSerializedLogs,
    allSerializedResponse
  };
}

// 5. Test Declarations

async function main() {
  console.log("=== Starting Functional Contract Suite 0.2C.1C.8 ===");

  // Setup standard successful response
  const successResult: SafeExternalFetchResultLike = {
    ok: true,
    body: "<h1>My Cool Song</h1>",
    statusCode: 200,
    contentType: "text/html",
    hostname: "safe.example.com",
    bytes: 21,
    redirectsFollowed: 1,
    timedOut: false
  };

  // SUCCESS TESTS
  await test("1. sucesso retorna ok true", async (t) => {
    const scenario = await runAdapterScenario(successResult);
    t.assert(scenario.result.ok === true, "Result ok must be true on success");
  });

  await test("2. sucesso retorna html igual ao body original", async (t) => {
    const scenario = await runAdapterScenario(successResult);
    if (scenario.result.ok) {
      t.assert(scenario.result.html === "<h1>My Cool Song</h1>", "HTML must match original body");
    } else {
      t.assert(false, "Result should be ok");
    }
  });

  await test("3. sucesso chama safeExternalFetch exatamente uma vez", async (t) => {
    const scenario = await runAdapterScenario(successResult);
    t.assert(scenario.safeFetchCalls === 1, "safeExternalFetch must be called exactly once");
  });

  await test("4. sucesso passa rawUrl recebido", async (t) => {
    const scenario = await runAdapterScenario(successResult);
    t.assert(safeFetchRawUrl === "https://safe.example.com/song?secret=SHOULD_NOT_LEAK", "Passed rawUrl must match");
  });

  await test("5. sucesso passa timeoutMs 8000", async (t) => {
    const scenario = await runAdapterScenario(successResult);
    t.assert(safeFetchOptions?.timeoutMs === 8000, "Passed timeoutMs must be 8000");
  });

  await test("6. sucesso passa maxRedirects 5", async (t) => {
    const scenario = await runAdapterScenario(successResult);
    t.assert(safeFetchOptions?.maxRedirects === 5, "Passed maxRedirects must be 5");
  });

  await test("7. sucesso não chama makeErrorResponse", async (t) => {
    const scenario = await runAdapterScenario(successResult);
    t.assert(scenario.makeErrorResponseCalls.length === 0, "makeErrorResponse must not be called on success");
  });

  await test("8. sucesso chama logInfo", async (t) => {
    const scenario = await runAdapterScenario(successResult);
    t.assert(scenario.infoLogs.length > 0, "logInfo must be called on success");
  });

  await test("9. sucesso não chama logWarn", async (t) => {
    const scenario = await runAdapterScenario(successResult);
    t.assert(scenario.warnLogs.length === 0, "logWarn must not be called on success");
  });

  await test("10. sucesso loga hostname", async (t) => {
    const scenario = await runAdapterScenario(successResult);
    const infoLog = scenario.infoLogs[0];
    t.assert(infoLog?.data?.hostname === "safe.example.com", "Log must include hostname");
  });

  await test("11. sucesso loga bytes", async (t) => {
    const scenario = await runAdapterScenario(successResult);
    const infoLog = scenario.infoLogs[0];
    t.assert(infoLog?.data?.bytes === 21, "Log must include bytes");
  });

  await test("12. sucesso loga redirectsFollowed", async (t) => {
    const scenario = await runAdapterScenario(successResult);
    const infoLog = scenario.infoLogs[0];
    t.assert(infoLog?.data?.redirectsFollowed === 1, "Log must include redirectsFollowed");
  });

  await test("13. sucesso loga contentType", async (t) => {
    const scenario = await runAdapterScenario(successResult);
    const infoLog = scenario.infoLogs[0];
    t.assert(infoLog?.data?.contentType === "text/html", "Log must include contentType");
  });

  await test("14. sucesso não loga URL completa", async (t) => {
    const scenario = await runAdapterScenario(successResult);
    t.assert(!scenario.allSerializedLogs.includes("https://safe.example.com/song?secret=SHOULD_NOT_LEAK"), "Log must not leak original URL");
  });

  await test("15. sucesso não loga query secret", async (t) => {
    const scenario = await runAdapterScenario(successResult);
    t.assert(!scenario.allSerializedLogs.includes("SHOULD_NOT_LEAK") && !scenario.allSerializedLogs.includes("secret"), "Log must not leak query parameters");
  });

  await test("16. sucesso não loga headers", async (t) => {
    const scenario = await runAdapterScenario(successResult);
    t.assert(!scenario.allSerializedLogs.includes("headers"), "Log must not contain headers");
  });

  await test("17. sucesso não loga cookies", async (t) => {
    const scenario = await runAdapterScenario(successResult);
    t.assert(!scenario.allSerializedLogs.includes("cookies"), "Log must not contain cookies");
  });

  await test("18. sucesso não loga selectedAddress", async (t) => {
    const scenario = await runAdapterScenario(successResult);
    t.assert(!scenario.allSerializedLogs.includes("selectedAddress"), "Log must not contain selectedAddress");
  });

  await test("19. sucesso não loga addresses", async (t) => {
    const scenario = await runAdapterScenario(successResult);
    t.assert(!scenario.allSerializedLogs.includes("addresses"), "Log must not contain addresses");
  });

  await test("20. sucesso não loga redirectChain", async (t) => {
    const scenario = await runAdapterScenario(successResult);
    t.assert(!scenario.allSerializedLogs.includes("redirectChain"), "Log must not contain redirectChain");
  });

  await test("21. sucesso não loga stack", async (t) => {
    const scenario = await runAdapterScenario(successResult);
    t.assert(!scenario.allSerializedLogs.includes("stack"), "Log must not contain stack trace");
  });

  await test("22. sucesso não loga message interna", async (t) => {
    const scenario = await runAdapterScenario(successResult);
    t.assert(!scenario.allSerializedLogs.includes("message"), "Log must not contain internal message keys");
  });

  // ERROR MAPPINGS TESTS
  interface ErrorTestCase {
    id: string;
    errorType: string;
    timedOut?: boolean;
    expectedCode: string;
    expectedStep: string;
    expectedMessage?: string;
    expectedDetails?: any;
  }

  const errorCases: ErrorTestCase[] = [
    {
      id: "23",
      errorType: "INVALID_SOURCE_URL",
      expectedCode: "VALIDATION",
      expectedStep: "2_URL_NORMALIZATION",
      expectedMessage: "O link informado não é um endereço de internet válido."
    },
    {
      id: "24",
      errorType: "UNSAFE_SOURCE_URL",
      expectedCode: "VALIDATION",
      expectedStep: "3_NETWORK_FETCH",
      expectedMessage: "O link informado não é permitido por segurança."
    },
    {
      id: "25",
      errorType: "SOURCE_TIMEOUT",
      timedOut: true,
      expectedCode: "TIMEOUT",
      expectedStep: "3_NETWORK_FETCH",
      expectedDetails: { timedOut: true }
    },
    {
      id: "26",
      errorType: "SOURCE_TIMEOUT",
      timedOut: false,
      expectedCode: "TIMEOUT",
      expectedStep: "3_NETWORK_FETCH",
      expectedDetails: { timedOut: false }
    },
    {
      id: "27",
      errorType: "SOURCE_DNS_FAILED",
      expectedCode: "SCRAPING",
      expectedStep: "3_NETWORK_FETCH"
    },
    {
      id: "28",
      errorType: "SOURCE_HTTP_ERROR",
      expectedCode: "SCRAPING",
      expectedStep: "3_NETWORK_FETCH"
    },
    {
      id: "29",
      errorType: "SOURCE_UNSUPPORTED_CONTENT_TYPE",
      expectedCode: "SCRAPING",
      expectedStep: "3_NETWORK_FETCH"
    },
    {
      id: "30",
      errorType: "SOURCE_UNSUPPORTED_ENCODING",
      expectedCode: "SCRAPING",
      expectedStep: "3_NETWORK_FETCH"
    },
    {
      id: "31",
      errorType: "SOURCE_TOO_LARGE",
      expectedCode: "SCRAPING",
      expectedStep: "3_NETWORK_FETCH"
    },
    {
      id: "32",
      errorType: "SOURCE_REDIRECT_LIMIT",
      expectedCode: "SCRAPING",
      expectedStep: "3_NETWORK_FETCH"
    },
    {
      id: "33",
      errorType: "SOURCE_REDIRECT_LOOP",
      expectedCode: "SCRAPING",
      expectedStep: "3_NETWORK_FETCH"
    },
    {
      id: "34",
      errorType: "SOURCE_UNSAFE_REDIRECT",
      expectedCode: "VALIDATION",
      expectedStep: "3_NETWORK_FETCH"
    },
    {
      id: "35",
      errorType: "SOURCE_FETCH_FAILED",
      expectedCode: "SCRAPING",
      expectedStep: "3_NETWORK_FETCH"
    }
  ];

  for (const ec of errorCases) {
    const resultPayload = {
      ok: false,
      statusCode: ec.errorType === "SOURCE_HTTP_ERROR" ? 500 : 400,
      error: ec.errorType as any,
      timedOut: ec.timedOut
    };

    await test(`ErrCase ${ec.id}a: ${ec.errorType} retorna ok false`, async (t) => {
      const scenario = await runAdapterScenario(resultPayload);
      t.assert(scenario.result.ok === false, `${ec.errorType} result ok must be false`);
    });

    await test(`ErrCase ${ec.id}b: ${ec.errorType} chama makeErrorResponse com code correto`, async (t) => {
      const scenario = await runAdapterScenario(resultPayload);
      t.assert(scenario.makeErrorResponseCalls.length === 1, `makeErrorResponse should be called exactly once`);
      const call = scenario.makeErrorResponseCalls[0];
      t.assert(call.code === ec.expectedCode, `Expected code ${ec.expectedCode}, got ${call.code}`);
      t.assert(call.step === ec.expectedStep, `Expected step ${ec.expectedStep}, got ${call.step}`);
      if (ec.expectedMessage) {
        t.assert(call.message === ec.expectedMessage, `Expected message "${ec.expectedMessage}", got "${call.message}"`);
      }
      if (ec.expectedDetails) {
        t.assert(JSON.stringify(call.details) === JSON.stringify(ec.expectedDetails), `Expected details ${JSON.stringify(ec.expectedDetails)}, got ${JSON.stringify(call.details)}`);
      }
    });

    await test(`ErrCase ${ec.id}c: ${ec.errorType} não vaza dados sensíveis`, async (t) => {
      const scenario = await runAdapterScenario(resultPayload);
      t.assert(!scenario.allSerializedResponse.includes("SHOULD_NOT_LEAK"), `Response must not leak secrets`);
      t.assert(!scenario.allSerializedLogs.includes("SHOULD_NOT_LEAK"), `Logs must not leak secrets`);
    });
  }

  // UNEXPECTED EXCEPTIONS TESTS
  const unexpectedError = new Error("This is a secret internal message that SHOULD_NOT_LEAK!");
  unexpectedError.stack = "Error: Secret message\n at mockSafeExternalFetch (/app/applet/scripts/test_phase0_2c1c8_ai_import_functional_contract.ts:110:5)";

  await test("36. se safeExternalFetch lançar Error com mensagem secreta, retorna ok false", async (t) => {
    const scenario = await runAdapterScenario(unexpectedError);
    t.assert(scenario.result.ok === false, "Result ok must be false on exception");
  });

  await test("37. exceção vira code SCRAPING", async (t) => {
    const scenario = await runAdapterScenario(unexpectedError);
    t.assert(scenario.makeErrorResponseCalls[0]?.code === "SCRAPING", "Exception must map to SCRAPING code");
  });

  await test("38. exceção usa step 3_NETWORK_FETCH", async (t) => {
    const scenario = await runAdapterScenario(unexpectedError);
    t.assert(scenario.makeErrorResponseCalls[0]?.step === "3_NETWORK_FETCH", "Exception must use step 3_NETWORK_FETCH");
  });

  await test("39. exceção não vaza message interna", async (t) => {
    const scenario = await runAdapterScenario(unexpectedError);
    t.assert(!scenario.allSerializedResponse.includes("This is a secret internal message"), "Response must not leak exception message");
  });

  await test("40. exceção não vaza stack", async (t) => {
    const scenario = await runAdapterScenario(unexpectedError);
    t.assert(!scenario.allSerializedResponse.includes("mockSafeExternalFetch"), "Response must not leak stack trace");
  });

  await test("41. exceção loga somente error SOURCE_FETCH_FAILED", async (t) => {
    const scenario = await runAdapterScenario(unexpectedError);
    const warnLog = scenario.warnLogs[0];
    t.assert(warnLog?.data?.error === "SOURCE_FETCH_FAILED", "Should log error SOURCE_FETCH_FAILED");
  });

  await test("42. exceção loga statusCode 502", async (t) => {
    const scenario = await runAdapterScenario(unexpectedError);
    const warnLog = scenario.warnLogs[0];
    t.assert(warnLog?.data?.statusCode === 502, "Should log statusCode 502");
  });

  await test("43. exceção loga timedOut false", async (t) => {
    const scenario = await runAdapterScenario(unexpectedError);
    const warnLog = scenario.warnLogs[0];
    t.assert(warnLog?.data?.timedOut === false, "Should log timedOut false");
  });

  await test("44. exceção não loga URL completa", async (t) => {
    const scenario = await runAdapterScenario(unexpectedError);
    t.assert(!scenario.allSerializedLogs.includes("https://safe.example.com/song?secret=SHOULD_NOT_LEAK"), "Logs must not leak original URL on exception");
  });

  await test("45. exceção não loga query secret", async (t) => {
    const scenario = await runAdapterScenario(unexpectedError);
    t.assert(!scenario.allSerializedLogs.includes("SHOULD_NOT_LEAK") && !scenario.allSerializedLogs.includes("secret"), "Logs must not leak query params on exception");
  });

  // PRIVACY OF RESPONSE TESTS
  const forbiddenResponseKeys = [
    "rawUrl", "normalizedUrlStr", "href", "search", "query", "fragment", "location",
    "redirectChain", "headers", "cookies", "selectedAddress", "addresses", "stack",
    "secret", "SHOULD_NOT_LEAK"
  ];

  for (const key of forbiddenResponseKeys) {
    await test(`Response Privacy Check: response não deve conter '${key}'`, async (t) => {
      for (const ec of errorCases) {
        const resultPayload = {
          ok: false,
          statusCode: 400,
          error: ec.errorType as any,
          timedOut: ec.timedOut
        };
        const scenario = await runAdapterScenario(resultPayload);
        t.assert(!scenario.allSerializedResponse.includes(key), `Response for error ${ec.errorType} leaked '${key}'`);
      }
      
      const scenarioExc = await runAdapterScenario(unexpectedError);
      t.assert(!scenarioExc.allSerializedResponse.includes(key), `Response for exception leaked '${key}'`);
    });
  }

  await test("61. Response Privacy Check: response não deve conter objeto Error", async (t) => {
    for (const ec of errorCases) {
      const resultPayload = {
        ok: false,
        statusCode: 400,
        error: ec.errorType as any,
        timedOut: ec.timedOut
      };
      const scenario = await runAdapterScenario(resultPayload);
      t.assert(!scenario.allSerializedResponse.includes("[object Error]"), `Response for error ${ec.errorType} leaked Error object`);
    }
    const scenarioExc = await runAdapterScenario(unexpectedError);
    t.assert(!scenarioExc.allSerializedResponse.includes("[object Error]"), "Response for exception leaked Error object");
  });

  // PRIVACY OF LOGS TESTS
  const forbiddenLogKeys = [
    "rawUrl", "normalizedUrlStr", "href", "search", "query", "fragment", "location",
    "redirectChain", "headers", "cookies", "selectedAddress", "addresses", "stack",
    "secret", "SHOULD_NOT_LEAK", "[object Error]", "https://safe.example.com/song?secret=SHOULD_NOT_LEAK"
  ];

  for (const key of forbiddenLogKeys) {
    await test(`Log Privacy Check: logs não devem conter '${key}'`, async (t) => {
      const scenarioSuccess = await runAdapterScenario(successResult);
      t.assert(!scenarioSuccess.allSerializedLogs.includes(key), `Success logs leaked '${key}'`);

      for (const ec of errorCases) {
        const resultPayload = {
          ok: false,
          statusCode: 400,
          error: ec.errorType as any,
          timedOut: ec.timedOut
        };
        const scenario = await runAdapterScenario(resultPayload);
        t.assert(!scenario.allSerializedLogs.includes(key), `Logs for error ${ec.errorType} leaked '${key}'`);
      }
      
      const scenarioExc = await runAdapterScenario(unexpectedError);
      t.assert(!scenarioExc.allSerializedLogs.includes(key), `Logs for exception leaked '${key}'`);
    });
  }

  // STATIC ANALYSIS OF SERVER.TS
  const serverCodePath = path.resolve(process.cwd(), "server.ts");
  const serverCode = fs.readFileSync(serverCodePath, "utf8");

  function extractRouteBlock(code: string): string {
    const startIdx = code.indexOf('app.post("/api/ai-import"');
    if (startIdx === -1) return "";
    const nextIdx = code.indexOf('app.post("/api/ai-suggest-songs"', startIdx);
    if (nextIdx !== -1) {
      return code.substring(startIdx, nextIdx);
    }
    let braces = 0;
    let inString: null | '"' | "'" | "`" = null;
    let block = "";
    for (let i = startIdx; i < code.length; i++) {
      const char = code[i];
      block += char;
      if (inString) {
        if (char === inString && code[i-1] !== '\\') {
          inString = null;
        }
      } else {
        if (char === '"' || char === "'" || char === "`") {
          inString = char;
        } else if (char === '{') {
          braces++;
        } else if (char === '}') {
          braces--;
          if (braces === 0) {
            break;
          }
        }
      }
    }
    return block;
  }

  const routeBlock = extractRouteBlock(serverCode);

  await test("79. rota /api/ai-import existe", (t) => {
    t.assert(routeBlock.length > 0, "Route /api/ai-import block should be successfully extracted");
  });

  await test("80. rota chama fetchAiImportHtmlSafely", (t) => {
    t.assert(routeBlock.includes("fetchAiImportHtmlSafely"), "Route block must call fetchAiImportHtmlSafely");
  });

  await test("81. rota passa safeExternalFetch: aiImportSafeExternalFetch", (t) => {
    t.assert(routeBlock.includes("safeExternalFetch: aiImportSafeExternalFetch"), "Route block must pass correct fetch dependency");
  });

  await test("82. rota passa makeErrorResponse", (t) => {
    t.assert(routeBlock.includes("makeErrorResponse") || routeBlock.includes("makeErrorResponse,"), "Route block must pass makeErrorResponse");
  });

  await test("83. rota passa logInfo", (t) => {
    t.assert(routeBlock.includes("logInfo") || routeBlock.includes("logInfo,"), "Route block must pass logInfo");
  });

  await test("84. rota passa logWarn", (t) => {
    t.assert(routeBlock.includes("logWarn") || routeBlock.includes("logWarn,"), "Route block must pass logWarn");
  });

  await test("85. rota usa safeHtmlResult.html", (t) => {
    t.assert(routeBlock.includes("safeHtmlResult.html"), "Route block must use safeHtmlResult.html");
  });

  await test("86. rota retorna safeHtmlResult.response quando ok false", (t) => {
    t.assert(routeBlock.includes("safeHtmlResult.response"), "Route block must return safeHtmlResult.response when not ok");
  });

  await test("87. rota preserva if (url && !textToProcess)", (t) => {
    t.assert(routeBlock.includes("if (url && !textToProcess)") || routeBlock.includes("if(url && !textToProcess)"), "Route block must preserve if condition for url");
  });

  await test("88. rota preserva textToProcess = rawText || ''", (t) => {
    t.assert(routeBlock.includes("textToProcess = rawText || \"\"") || routeBlock.includes("textToProcess = rawText || ''"), "Route block must preserve default textToProcess");
  });

  await test("89. rota não contém fetch(normalizedUrlStr", (t) => {
    t.assert(!routeBlock.includes("fetch(normalizedUrlStr"), "Route block must not use raw fetch");
  });

  await test("90. rota não contém fetchResponse", (t) => {
    t.assert(!routeBlock.includes("fetchResponse"), "Route block must not use fetchResponse variable");
  });

  await test("91. rota não contém fetchResponse.text()", (t) => {
    t.assert(!routeBlock.includes("fetchResponse.text()"), "Route block must not call text() on fetchResponse");
  });

  await test("92. rota não contém fetchResponse.ok", (t) => {
    t.assert(!routeBlock.includes("fetchResponse.ok"), "Route block must not inspect fetchResponse.ok");
  });

  await test("93. rota não contém fetchResponse.status", (t) => {
    t.assert(!routeBlock.includes("fetchResponse.status"), "Route block must not inspect fetchResponse.status");
  });

  await test("94. rota não contém new AbortController() dentro do bloco da rota", (t) => {
    t.assert(!routeBlock.includes("new AbortController()"), "Route block must not instantiate AbortController");
  });

  await test("95. rota não contém fetchController.abort()", (t) => {
    t.assert(!routeBlock.includes("fetchController.abort()"), "Route block must not call abort()");
  });

  await test("96. rota não contém headers manuais 'User-Agent'", (t) => {
    // It is fine to set User-Agent inside GoogleGenAI config, but not as part of a custom fetch/scraping headers block
    const cleanBlock = routeBlock.replace(/headers:\s*\{\s*['"]User-Agent['"]:\s*['"]aistudio-build['"]\s*\}/g, "");
    t.assert(!cleanBlock.includes("User-Agent") && !cleanBlock.includes("user-agent"), "Route block must not manually set User-Agent for requests");
  });

  await test("97. rota não contém headers manuais 'Accept-Language'", (t) => {
    t.assert(!routeBlock.includes("Accept-Language"), "Route block must not manual set Accept-Language");
  });

  await test("98. rota não contém headers manuais 'Accept'", (t) => {
    t.assert(!routeBlock.includes("Accept\"") && !routeBlock.includes("Accept'"), "Route block must not manual set Accept");
  });

  await test("99. rota não contém comentários 'Padding'", (t) => {
    t.assert(!routeBlock.includes("Padding"), "Route block must not contain fake padding comments");
  });

  await test("100. rota não contém 'safeFetchResult.hostname' em comentários falsos", (t) => {
    t.assert(!routeBlock.includes("safeFetchResult.hostname"), "Route block must not contain fake safeFetchResult comments");
  });

  await test("101. rota não contém 'failure.error' em comentários falsos", (t) => {
    t.assert(!routeBlock.includes("failure.error"), "Route block must not contain fake failure.error comments");
  });

  await test("102. rota não loga url no payload inicial", (t) => {
    // Look at 1_INITIAL_PAYLOAD
    const payloadIndex = routeBlock.indexOf("1_INITIAL_PAYLOAD");
    t.assert(payloadIndex !== -1, "Should have 1_INITIAL_PAYLOAD step");
    const nextCloseBrace = routeBlock.indexOf("}", payloadIndex);
    const payloadRange = routeBlock.substring(payloadIndex, nextCloseBrace);
    t.assert(!payloadRange.includes("url: url") && !payloadRange.includes("url,"), "Initial payload log must not log url directly");
  });

  await test("103. rota loga hasUrl no payload inicial", (t) => {
    const payloadIndex = routeBlock.indexOf("1_INITIAL_PAYLOAD");
    const nextCloseBrace = routeBlock.indexOf("}", payloadIndex);
    const payloadRange = routeBlock.substring(payloadIndex, nextCloseBrace);
    t.assert(payloadRange.includes("hasUrl:"), "Initial payload log must verify hasUrl existence");
  });

  await test("104. rota não loga normalizedUrlStr", (t) => {
    const lines = routeBlock.split("\n");
    const loggingLineWithUrlStr = lines.some(l => 
      (l.includes("logInfo") || l.includes("logWarn") || l.includes("logError")) && 
      l.includes("normalizedUrlStr")
    );
    t.assert(!loggingLineWithUrlStr, "Route must not log normalizedUrlStr variable");
  });

  await test("105. rota não loga .href", (t) => {
    t.assert(!routeBlock.includes(".href"), "Route must not log href");
  });

  await test("106. rota não loga .search", (t) => {
    const lines = routeBlock.split("\n");
    const loggingLineWithSearch = lines.some(l => 
      (l.includes("logInfo") || l.includes("logWarn") || l.includes("logError")) && 
      l.includes(".search")
    );
    t.assert(!loggingLineWithSearch, "Route must not log search query parts");
  });

  await test("107. rota não loga query em chamadas de log", (t) => {
    const lines = routeBlock.split("\n");
    const loggingLineWithQuery = lines.some(l => 
      (l.includes("logInfo") || l.includes("logWarn") || l.includes("logError")) && 
      (l.includes("query:") || l.includes("query,"))
    );
    t.assert(!loggingLineWithQuery, "Route must not log queries");
  });

  // STATIC ANALYSIS OF ADAPTER
  const adapterCodePath = path.resolve(process.cwd(), "services/server/aiImportSafeFetchAdapter.ts");
  const adapterCode = fs.readFileSync(adapterCodePath, "utf8");

  await test("108. adapter não importa express", (t) => {
    t.assert(!adapterCode.includes("import express") && !adapterCode.includes("require('express')"), "Adapter must not import express");
  });

  await test("109. adapter não importa firebase", (t) => {
    t.assert(!adapterCode.includes("import firebase") && !adapterCode.includes("require('firebase')"), "Adapter must not import firebase");
  });

  await test("110. adapter não importa @google/genai", (t) => {
    t.assert(!adapterCode.includes("@google/genai"), "Adapter must not import @google/genai");
  });

  await test("111. adapter não importa Gemini", (t) => {
    // Word "GEMINI" is part of the error type signature, which is allowed. But it should not import @google/genai or instantiate GoogleGenAI.
    t.assert(!adapterCode.includes("import") || (!adapterCode.includes("GoogleGenAI") && !adapterCode.includes("@google/genai")), "Adapter must not import Gemini client/SDK");
  });

  await test("112. adapter não importa node:https", (t) => {
    t.assert(!adapterCode.includes("node:https"), "Adapter must not import node:https");
  });

  await test("113. adapter não importa node:http", (t) => {
    t.assert(!adapterCode.includes("node:http"), "Adapter must not import node:http");
  });

  await test("114. adapter não importa node:tls", (t) => {
    t.assert(!adapterCode.includes("node:tls"), "Adapter must not import node:tls");
  });

  await test("115. adapter não importa node:dns", (t) => {
    t.assert(!adapterCode.includes("node:dns"), "Adapter must not import node:dns");
  });

  await test("116. adapter não usa fetch(", (t) => {
    t.assert(!adapterCode.includes("fetch("), "Adapter must not call global fetch");
  });

  await test("117. adapter não usa axios", (t) => {
    t.assert(!adapterCode.includes("axios"), "Adapter must not use axios");
  });

  await test("118. adapter não usa process.env", (t) => {
    t.assert(!adapterCode.includes("process.env"), "Adapter must not read process.env");
  });

  await test("119. adapter não usa console.log", (t) => {
    t.assert(!adapterCode.includes("console.log"), "Adapter must not use console.log");
  });

  await test("120. adapter não usa console.error", (t) => {
    t.assert(!adapterCode.includes("console.error"), "Adapter must not use console.error");
  });

  await test("121. adapter exporta fetchAiImportHtmlSafely", (t) => {
    t.assert(adapterCode.includes("export async function fetchAiImportHtmlSafely"), "Adapter must export fetchAiImportHtmlSafely");
  });

  await test("122. adapter exporta ou contém mapSafeExternalFetchErrorToAiImportResponse", (t) => {
    t.assert(adapterCode.includes("mapSafeExternalFetchErrorToAiImportResponse"), "Adapter must contain mapSafeExternalFetchErrorToAiImportResponse");
  });

  await test("123. adapter passa timeoutMs 8000", (t) => {
    t.assert(adapterCode.includes("timeoutMs: 8000"), "Adapter must set timeoutMs to 8000");
  });

  await test("124. adapter passa maxRedirects 5", (t) => {
    t.assert(adapterCode.includes("maxRedirects: 5"), "Adapter must set maxRedirects to 5");
  });

  await test("125. adapter loga sucesso só com hostname, bytes, redirectsFollowed, contentType", (t) => {
    const logInfoIndex = adapterCode.indexOf("logInfo(");
    t.assert(logInfoIndex !== -1, "Adapter must call logInfo for success");
    const logBlock = adapterCode.substring(logInfoIndex, adapterCode.indexOf("}", logInfoIndex));
    t.assert(logBlock.includes("hostname"), "Success logs must include hostname");
    t.assert(logBlock.includes("bytes"), "Success logs must include bytes");
    t.assert(logBlock.includes("redirectsFollowed"), "Success logs must include redirectsFollowed");
    t.assert(logBlock.includes("contentType"), "Success logs must include contentType");
    t.assert(!logBlock.includes("rawUrl") && !logBlock.includes("normalizedUrlStr"), "Success logs must be fully sanitized");
  });

  await test("126. adapter loga falha só com error, statusCode, timedOut", (t) => {
    const logWarnIndex = adapterCode.indexOf("logWarn(");
    t.assert(logWarnIndex !== -1, "Adapter must call logWarn for failure");
    const logBlock = adapterCode.substring(logWarnIndex, adapterCode.indexOf("}", logWarnIndex));
    t.assert(logBlock.includes("error") || logBlock.includes("SOURCE_FETCH_FAILED"), "Failure logs must include error key or string");
    t.assert(logBlock.includes("statusCode"), "Failure logs must include statusCode");
    t.assert(logBlock.includes("timedOut"), "Failure logs must include timedOut");
    t.assert(!logBlock.includes("rawUrl") && !logBlock.includes("normalizedUrlStr"), "Failure logs must be fully sanitized");
  });

  // ISOLATION AND CLEANLINESS TESTS
  function extractFixChordsRouteBlock(code: string): string {
    const startIdx = code.indexOf('app.post("/api/fix-chords"');
    if (startIdx === -1) return "";
    const nextIdx = code.indexOf('app.post("/api/ai-import"', startIdx);
    if (nextIdx !== -1) {
      return code.substring(startIdx, nextIdx);
    }
    let braces = 0;
    let inString: null | '"' | "'" | "`" = null;
    let block = "";
    for (let i = startIdx; i < code.length; i++) {
      const char = code[i];
      block += char;
      if (inString) {
        if (char === inString && code[i-1] !== '\\') {
          inString = null;
        }
      } else {
        if (char === '"' || char === "'" || char === "`") {
          inString = char;
        } else if (char === '{') {
          braces++;
        } else if (char === '}') {
          braces--;
          if (braces === 0) {
            break;
          }
        }
      }
    }
    return block;
  }

  const fixChordsBlock = extractFixChordsRouteBlock(serverCode);

  await test("127. /api/fix-chords não contém fetchAiImportHtmlSafely", (t) => {
    t.assert(!fixChordsBlock.includes("fetchAiImportHtmlSafely"), "/api/fix-chords must not reference fetchAiImportHtmlSafely");
  });

  await test("128. /api/fix-chords não contém aiImportSafeExternalFetch", (t) => {
    t.assert(!fixChordsBlock.includes("aiImportSafeExternalFetch"), "/api/fix-chords must not reference aiImportSafeExternalFetch");
  });

  await test("129. /api/fix-chords não contém safeExternalFetch", (t) => {
    t.assert(!fixChordsBlock.includes("safeExternalFetch"), "/api/fix-chords must not reference safeExternalFetch");
  });

  await test("130. não existe app/applet/services/server/aiImportSafeFetchAdapter.ts", (t) => {
    const wrongPath = path.resolve(process.cwd(), "app/applet/services/server/aiImportSafeFetchAdapter.ts");
    t.assert(!fs.existsSync(wrongPath), "Wrong workspace nesting path should not exist");
  });

  await test("131. não existe app/applet/scripts/test_phase0_2c1c8_ai_import_functional_contract.ts", (t) => {
    const wrongPath = path.resolve(process.cwd(), "app/applet/scripts/test_phase0_2c1c8_ai_import_functional_contract.ts");
    t.assert(!fs.existsSync(wrongPath), "Wrong test workspace nesting path should not exist");
  });

  await test("132. não existem arquivos temporários proibidos na raiz", (t) => {
    const files = fs.readdirSync(process.cwd());
    for (const f of files) {
      const lower = f.toLowerCase();
      // Check for forbidden prefix/names
      if (lower.startsWith("debug")) {
        t.assert(false, `Forbidden temporary file found: ${f}`);
      }
      if (lower.startsWith("patch")) {
        t.assert(false, `Forbidden temporary file found: ${f}`);
      }
      if (lower.startsWith("out.js")) {
        t.assert(false, `Forbidden temporary file found: ${f}`);
      }
      if (lower === "app_response.txt" || lower === "auth_res.txt") {
        t.assert(false, `Forbidden temporary file found: ${f}`);
      }
      if (lower.startsWith("puppeteer_test")) {
        t.assert(false, `Forbidden temporary file found: ${f}`);
      }
      if (lower.startsWith("check") && lower.endsWith(".txt")) {
        t.assert(false, `Forbidden temporary file found: ${f}`);
      }
    }
    t.assert(true, "All workspace root folders are clean of forbidden temporary files");
  });

  // CONTABILIDADE FINAL
  await test("133. passedTests + failedTests === registeredTests", (t) => {
    // When this test runs, registeredTests is already incremented for it, but passed/failed are not yet.
    t.assert(passedTests + failedTests + 1 === registeredTests, "Total tests accounted must equal registered tests count");
  });

  await test("134. failedTests === 0", (t) => {
    t.assert(failedTests === 0, "No tests should fail in the contract test suite");
  });

  await test("135. testsWithZeroAssertions === 0", (t) => {
    t.assert(testsWithZeroAssertions === 0, "All tests must have at least one real assertion");
  });

  await test("136. hashes finais dos arquivos protegidos são iguais aos hashes iniciais", (t) => {
    for (const file of protectedFiles) {
      const currentHash = calculateFileHash(file);
      t.assert(currentHash === initialHashes[file], `Protected file hash mismatch: ${file}`);
    }
  });

  console.log("\n=======================================================");
  console.log(`Functional Contract Test Suite Summary:`);
  console.log(`Total Registered: ${registeredTests}`);
  console.log(`Total Passed:     ${passedTests}`);
  console.log(`Total Failed:     ${failedTests}`);
  console.log(`Zero Assertions:  ${testsWithZeroAssertions}`);
  console.log("=======================================================");

  if (failedTests > 0 || testsWithZeroAssertions > 0) {
    console.error("FATAL: Test suite failed.");
    process.exit(1);
  } else {
    console.log("SUCCESS: All tests completed with clean assertions.");
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("Fatal error in test suite execution:", err);
  process.exit(1);
});
