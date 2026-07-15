import assert from 'assert';
import path from 'path';
import fs from 'fs';
import { createFixChordsHandler } from '../services/server/fixChordsHandler.js';

let registered = 0;
let passed = 0;
let failed = 0;
let currentTestAssertions = 0;

const assertHelper = {
  ok(value: any, message?: string) {
    currentTestAssertions++;
    assert.ok(value, message);
  },
  strictEqual(actual: any, expected: any, message?: string) {
    currentTestAssertions++;
    assert.strictEqual(actual, expected, message);
  },
  deepStrictEqual(actual: any, expected: any, message?: string) {
    currentTestAssertions++;
    assert.deepStrictEqual(actual, expected, message);
  },
  notStrictEqual(actual: any, expected: any, message?: string) {
    currentTestAssertions++;
    assert.notStrictEqual(actual, expected, message);
  },
  match(value: string, regExp: RegExp, message?: string) {
    currentTestAssertions++;
    assert.match(value, regExp, message);
  }
};

async function test(name: string, fn: (a: typeof assertHelper) => Promise<void> | void) {
  registered++;
  currentTestAssertions = 0;
  try {
    await fn(assertHelper);
    if (currentTestAssertions === 0) {
      throw new Error("No assertions made in test");
    }
    passed++;
    console.log(`[PASS] ${name}`);
  } catch (error) {
    failed++;
    console.error(`[FAIL] ${name}`, error);
  }
}

class FakeRateLimiter {
  acquireCalls = 0;
  releaseCalls = 0;
  lastInput: any = null;
  shouldAllow = true;

  acquire(input: any) {
    this.acquireCalls++;
    this.lastInput = input;
    if (!this.shouldAllow) {
      return { ok: false, statusCode: 429, error: "AI_RATE_LIMITED" };
    }
    let released = false;
    return {
      ok: true,
      release: () => {
        if (released) return;
        released = true;
        this.releaseCalls++;
      }
    };
  }
}

class FakeClock {
  scheduledCallback: (() => void) | null = null;
  scheduledDelay: number | null = null;
  cancelCalls = 0;

  scheduleTimeout = (callback: () => void, delay: number) => {
    this.scheduledCallback = callback;
    this.scheduledDelay = delay;
    return "timer-handle";
  };

  cancelTimeout = (handle: unknown) => {
    assertHelper.strictEqual(handle, "timer-handle");
    this.cancelCalls++;
  };
}

const mockLogger = {
  logs: [] as any[],
  info: (...args: any[]) => mockLogger.logs.push({ level: 'info', args }),
  error: (...args: any[]) => mockLogger.logs.push({ level: 'error', args }),
  warn: (...args: any[]) => mockLogger.logs.push({ level: 'warn', args }),
  clear: () => { mockLogger.logs = []; }
};

const depsBase = {
  dbInstance: {
    collection: () => ({
      doc: () => ({
        get: async () => ({ 
          exists: true, 
          data: () => ({ 
            status: 'active', 
            organizationRole: 'owner', 
            apps: { 
              musicscale: { 
                status: 'active', 
                features: { aiStructuring: true, aiImport: true } 
              } 
            } 
          }) 
        }),
        collection: () => ({
          doc: () => ({
            get: async () => ({ exists: true, data: () => ({ status: 'active', organizationRole: 'owner' }) })
          })
        })
      })
    })
  },
  authInstance: {
    verifyIdToken: async (tk: string) => {
      if (tk === 'manage_chords_tk') return { uid: 'manage_chords_uid' };
      if (tk === 'bad_tk') throw new Error('invalid');
      return { uid: 'other' };
    }
  },
  rateLimiter: new FakeRateLimiter() as any,
  apiKey: 'fake-api-key',
  logger: mockLogger,
  generateContent: async () => ({ text: 'C' })
};

function createReq(overrides = {}) {
  return { headers: {}, body: {}, ...overrides };
}

function createRes() {
  const res: any = { _status: 200, _json: null, headersSent: false };
  res.status = (s: number) => { res._status = s; return res; };
  res.json = (j: any) => { res._json = j; res.headersSent = true; return res; };
  return res;
}

async function runTest() {
  await test("1. sem Authorization -> 401", async (a) => {
    const handler = createFixChordsHandler(depsBase);
    const req = createReq({ body: { organizationId: 'org123', chords: 'C' } });
    const res = createRes();
    await handler(req, res);
    a.strictEqual(res._status, 401);
  });

  await test("2. token inválido -> 401", async (a) => {
    const handler = createFixChordsHandler(depsBase);
    const req = createReq({ headers: { authorization: 'Bearer bad_tk' }, body: { organizationId: 'org123', chords: 'C' } });
    const res = createRes();
    await handler(req, res);
    a.strictEqual(res._status, 401);
  });

  await test("3. chords ausente -> 422", async (a) => {
    const handler = createFixChordsHandler(depsBase);
    const req = createReq({ headers: { authorization: 'Bearer manage_chords_tk' }, body: { organizationId: 'org123' } });
    const res = createRes();
    await handler(req, res);
    a.strictEqual(res._status, 422);
  });

  await test("4. chords acima de 60.000 -> 422", async (a) => {
    const handler = createFixChordsHandler(depsBase);
    const req = createReq({ headers: { authorization: 'Bearer manage_chords_tk' }, body: { organizationId: 'org123', chords: 'C'.repeat(60001) } });
    const res = createRes();
    await handler(req, res);
    a.strictEqual(res._status, 422);
  });

  await test("5. instructions acima de 2.000 -> 422", async (a) => {
    const handler = createFixChordsHandler(depsBase);
    const req = createReq({ headers: { authorization: 'Bearer manage_chords_tk' }, body: { organizationId: 'org123', chords: 'C', instructions: 'A'.repeat(2001) } });
    const res = createRes();
    await handler(req, res);
    a.strictEqual(res._status, 422);
  });

  await test("6. payload inválido não chama rate limiter", async (a) => {
    const fakeLimiter = new FakeRateLimiter();
    const handler = createFixChordsHandler({ ...depsBase, rateLimiter: fakeLimiter as any });
    const req = createReq({ headers: { authorization: 'Bearer manage_chords_tk' }, body: { organizationId: 'org123', chords: '' } });
    const res = createRes();
    await handler(req, res);
    a.strictEqual(res._status, 422);
    a.strictEqual(fakeLimiter.acquireCalls, 0);
  });

  await test("7. chave ausente não consome rate limit e retorna 503", async (a) => {
    const fakeLimiter = new FakeRateLimiter();
    const handler = createFixChordsHandler({ ...depsBase, apiKey: '', rateLimiter: fakeLimiter as any });
    const req = createReq({ headers: { authorization: 'Bearer manage_chords_tk' }, body: { organizationId: 'org123', chords: 'C' } });
    const res = createRes();
    await handler(req, res);
    a.strictEqual(res._status, 503);
    a.strictEqual(fakeLimiter.acquireCalls, 0);
  });

  await test("8. rate limit negado -> 429", async (a) => {
    const fakeLimiter = new FakeRateLimiter();
    fakeLimiter.shouldAllow = false;
    let providerCalls = 0;
    const handler = createFixChordsHandler({ 
      ...depsBase, 
      rateLimiter: fakeLimiter as any,
      generateContent: async () => { providerCalls++; return { text: 'C' }; }
    });
    const req = createReq({ headers: { authorization: 'Bearer manage_chords_tk' }, body: { organizationId: 'org123', chords: 'C' } });
    const res = createRes();
    await handler(req, res);
    a.strictEqual(res._status, 429);
    a.strictEqual(res._json?.error, 'AI_RATE_LIMITED');
    a.strictEqual(fakeLimiter.acquireCalls, 1);
    a.strictEqual(providerCalls, 0);
  });

  await test("9. sucesso chama provider uma única vez, libera slot e retorna fixedChords", async (a) => {
    const fakeLimiter = new FakeRateLimiter();
    let providerCalls = 0;
    const handler = createFixChordsHandler({ 
      ...depsBase, 
      rateLimiter: fakeLimiter as any,
      generateContent: async () => { providerCalls++; return { text: 'C#m' }; }
    });
    const req = createReq({ headers: { authorization: 'Bearer manage_chords_tk' }, body: { organizationId: 'org123', chords: 'C' } });
    const res = createRes();
    await handler(req, res);
    a.strictEqual(res._status, 200);
    a.strictEqual(res._json?.fixedChords, 'C#m');
    a.ok(!res._json?.error);
    a.strictEqual(providerCalls, 1);
    a.strictEqual(fakeLimiter.acquireCalls, 1);
    a.strictEqual(fakeLimiter.releaseCalls, 1);
  });

  await test("10. erro do provider libera slot e cancela timer", async (a) => {
    const fakeLimiter = new FakeRateLimiter();
    const clock = new FakeClock();
    mockLogger.clear();
    const handler = createFixChordsHandler({ 
      ...depsBase, 
      rateLimiter: fakeLimiter as any,
      scheduleTimeout: clock.scheduleTimeout,
      cancelTimeout: clock.cancelTimeout,
      generateContent: async () => { throw new Error('SECRET_ERROR_MSG'); }
    });
    const req = createReq({ headers: { authorization: 'Bearer manage_chords_tk' }, body: { organizationId: 'org123', chords: 'C' } });
    const res = createRes();
    await handler(req, res);
    a.strictEqual(res._status, 503);
    a.strictEqual(res._json?.error, 'AI_PROVIDER_UNAVAILABLE');
    a.strictEqual(fakeLimiter.acquireCalls, 1);
    a.strictEqual(fakeLimiter.releaseCalls, 1);
    a.strictEqual(clock.cancelCalls, 1);
    const logs = mockLogger.logs.map(l => JSON.stringify(l.args)).join(' ');
    a.ok(!logs.includes('SECRET_ERROR_MSG'));
    a.ok(!logs.includes('stack'));
  });

  await test("11. timeout aborta a chamada e libera slot", async (a) => {
    const fakeLimiter = new FakeRateLimiter();
    const clock = new FakeClock();
    let capturedSignal: AbortSignal | null = null;
    const handler = createFixChordsHandler({ 
      ...depsBase, 
      rateLimiter: fakeLimiter as any,
      scheduleTimeout: clock.scheduleTimeout,
      cancelTimeout: clock.cancelTimeout,
      generateContent: async (p) => {
        capturedSignal = p.config?.abortSignal || null;
        return new Promise((_, reject) => {
          if (capturedSignal) {
            capturedSignal.addEventListener('abort', () => {
              const err = new Error('abort');
              err.name = 'AbortError';
              reject(err);
            });
          }
        });
      }
    });
    const req = createReq({ headers: { authorization: 'Bearer manage_chords_tk' }, body: { organizationId: 'org123', chords: 'C' } });
    const res = createRes();
    const p = handler(req, res);
    // yield event loop to let auth complete
    await new Promise(r => setTimeout(r, 10));
    a.strictEqual(clock.scheduledDelay, 30000);
    if (clock.scheduledCallback) clock.scheduledCallback();
    await p;
    a.strictEqual(res._status, 504);
    a.strictEqual(res._json?.error, 'AI_PROVIDER_TIMEOUT');
    a.strictEqual(capturedSignal?.aborted, true);
    a.strictEqual(fakeLimiter.acquireCalls, 1);
    a.strictEqual(fakeLimiter.releaseCalls, 1);
    a.strictEqual(clock.cancelCalls, 1);
  });

  await test("12. resposta vazia retorna 502, cancela timer e libera slot", async (a) => {
    const fakeLimiter = new FakeRateLimiter();
    const clock = new FakeClock();
    const handler = createFixChordsHandler({ 
      ...depsBase, 
      rateLimiter: fakeLimiter as any,
      scheduleTimeout: clock.scheduleTimeout,
      cancelTimeout: clock.cancelTimeout,
      generateContent: async () => ({ text: '' })
    });
    const req = createReq({ headers: { authorization: 'Bearer manage_chords_tk' }, body: { organizationId: 'org123', chords: 'C' } });
    const res = createRes();
    await handler(req, res);
    a.strictEqual(res._status, 502);
    a.strictEqual(res._json?.error, 'AI_PROVIDER_INVALID_RESPONSE');
    a.strictEqual(fakeLimiter.acquireCalls, 1);
    a.strictEqual(fakeLimiter.releaseCalls, 1);
    a.strictEqual(clock.cancelCalls, 1);
  });

  await test("13. erro inesperado retorna 500", async (a) => {
    const fakeLimiter = new FakeRateLimiter();
    const badLogger = { ...mockLogger, info: () => { throw new Error('boom'); } };
    const handler = createFixChordsHandler({ 
      ...depsBase, 
      rateLimiter: fakeLimiter as any,
      logger: badLogger
    });
    const req = createReq({ headers: { authorization: 'Bearer manage_chords_tk' }, body: { organizationId: 'org123', chords: 'C' } });
    const res = createRes();
    await handler(req, res);
    a.strictEqual(res._status, 500);
    a.strictEqual(res._json?.error, 'INTERNAL_AI_ERROR');
    a.strictEqual(fakeLimiter.releaseCalls, 1);
  });

  await test("14. logs, correlationId e ausência de segredos", async (a) => {
    mockLogger.clear();
    let uuidCalls = 0;
    const fakeLimiter = new FakeRateLimiter();
    const handler = createFixChordsHandler({ 
      ...depsBase, 
      rateLimiter: fakeLimiter as any,
      randomUUID: () => { uuidCalls++; return 'correlation-test-id'; }
    });
    const req = createReq({ headers: { authorization: 'Bearer manage_chords_tk' }, body: { organizationId: 'org123', chords: 'SECRET_CHORDS', instructions: 'SECRET_INST' } });
    const res = createRes();
    await handler(req, res);
    a.strictEqual(res._status, 200);
    a.strictEqual(uuidCalls, 1);
    const logs = mockLogger.logs.map(l => JSON.stringify(l.args)).join(' ');
    a.ok(logs.includes('correlation-test-id'));
    a.ok(!logs.includes('SECRET_CHORDS'));
    a.ok(!logs.includes('SECRET_INST'));
    a.ok(!logs.includes('Bearer'));
    a.ok(!logs.includes('manage_chords_tk'));
    a.ok(!res._json?.correlationId);
  });

  await test("15. prompt segue regras estritas", async (a) => {
    let capturedPrompt = '';
    const fakeLimiter = new FakeRateLimiter();
    const handler = createFixChordsHandler({ 
      ...depsBase, 
      rateLimiter: fakeLimiter as any,
      generateContent: async (p) => { 
        capturedPrompt = p.contents[0].parts[0].text; 
        return { text: 'C' }; 
      } 
    });
    const req = createReq({ headers: { authorization: 'Bearer manage_chords_tk' }, body: { organizationId: 'org123', chords: 'C\nG', instructions: 'EXTRA_INST' } });
    const res = createRes();
    await handler(req, res);
    a.ok(capturedPrompt.includes('\n'));
    a.ok(capturedPrompt.includes('1. Remova lixo'));
    a.ok(capturedPrompt.includes('2. É estritamente necessário'));
    a.ok(capturedPrompt.includes('3. Mantenha a letra'));
    a.ok(capturedPrompt.includes('4. Ajuste acordes deslocados'));
    a.ok(capturedPrompt.includes('5. Se houver seções instrumentais'));
    a.ok(capturedPrompt.includes('EXTRA_INST'));
    a.ok(capturedPrompt.includes('C\nG'));
    a.ok(capturedPrompt.endsWith('C\nG'));
    a.strictEqual(fakeLimiter.acquireCalls, 1);
    a.strictEqual(fakeLimiter.releaseCalls, 1);
  });

  await test("16. integridade estática do server.ts", async (a) => {
    const serverPath = path.resolve(process.cwd(), 'server.ts');
    const content = fs.readFileSync(serverPath, 'utf-8');
    const fixChordsMatches = content.match(/app\.post\(['"]\/api\/fix-chords['"]/g) || [];
    a.strictEqual(fixChordsMatches.length, 1);
    const aiImportMatches = content.match(/app\.post\(['"]\/api\/ai-import['"]/g) || [];
    a.strictEqual(aiImportMatches.length, 1);
    const fixChordsIdx = content.indexOf('/api/fix-chords');
    const aiImportIdx = content.indexOf('/api/ai-import');
    a.ok(fixChordsIdx < aiImportIdx);
    const aiImportSub = content.substring(aiImportIdx);
    a.ok(aiImportSub.includes('preProcessSongText'));
    a.ok(aiImportSub.includes('cleanChordsText'));
    a.ok(aiImportSub.includes('stripTablatureArtifacts'));
    a.ok(aiImportSub.includes('removeChordOnlyLinesFromLyrics'));
    a.ok(aiImportSub.includes('validateNoChordLinesInLyrics'));
    a.ok(aiImportSub.includes('usedAi'));
    a.ok(aiImportSub.includes('processingTimeMs'));
    a.ok(aiImportSub.includes('result'));
    a.ok(aiImportSub.includes('song'));
  });

  await test("17. higiene: ausência de lixo, console.log, propriedades secretas", async (a) => {
    const files = fs.readdirSync(process.cwd());
    const badFiles = [
      'append_test.cjs', 'debug_prompt.cjs', 'debug_test.cjs', 'dummy.ts', 
      'fix_fake.cjs', 'fix_final.cjs', 'fix_test.cjs', 'fix_test2.cjs', 
      'fix_test3.cjs', 'fix_test4.cjs', 'fix_test5.cjs', 'reset_rl.cjs'
    , 'fix.js', 'fix.cjs'];
    for (const f of badFiles) {
      a.ok(!files.includes(f), `File ${f} should not exist`);
    }
    
    for (const f of files) {
      const isBadPattern = /^debug.*\.(js|cjs)$/.test(f) ||
                           /^patch.*\.(js|cjs)$/.test(f) ||
                           /^update.*\.(js|cjs)$/.test(f) ||
                           /^check.*\.txt$/.test(f);
      a.ok(!isBadPattern, `File ${f} should not exist`);
    }
    a.ok(!fs.existsSync(path.resolve(process.cwd(), 'app/applet/services/server/fixChordsHandler.ts')));
    
    const serverTs = fs.readFileSync(path.resolve(process.cwd(), 'server.ts'), 'utf-8');
    const aiSecurityImportMatch = serverTs.match(
      /import\s*\{([^}]+)\}\s*from\s*["']\.\/services\/server\/aiRequestSecurity\.js["']/
    );
    a.ok(aiSecurityImportMatch, "server.ts deve importar de aiRequestSecurity.js");
    a.ok(aiSecurityImportMatch[1].includes("InMemoryAiRateLimiter"), "server.ts deve importar InMemoryAiRateLimiter");
    a.ok(serverTs.includes("const fixChordsRateLimiter = new InMemoryAiRateLimiter()"));
    a.ok(serverTs.includes("rateLimiter: fixChordsRateLimiter"));
    a.ok(!serverTs.includes('\\u0053ecurity'));

    const handlerCode = fs.readFileSync(path.resolve(process.cwd(), 'services/server/fixChordsHandler.ts'), 'utf-8');
    a.ok(!handlerCode.includes('export { InMemoryAiRateLimiter }'));
    a.ok(!handlerCode.includes('err.message'));
    a.ok(!handlerCode.includes('error.message'));
    a.ok(!handlerCode.includes('String(error)'));
    a.ok(!handlerCode.includes('console.log'));
  });

    await test("18. análise estática do consumidor frontend", async (a) => {
    const modalPath = path.resolve(process.cwd(), 'components/songs/ChordsViewerModal.tsx');
    const content = fs.readFileSync(modalPath, 'utf-8');
    
    // 1. O componente continua usando useAuth;
    a.ok(content.includes('useAuth()'));
    
    // 2. Extrai effectiveOrganizationId;
    const useAuthMatch = content.match(/const \{.*?effectiveOrganizationId.*?\}\s*=\s*useAuth\(\)/);
    a.ok(useAuthMatch !== null);
    
    // Extrair ou localizar o bloco de handleAIAjuste
    const handleStart = content.indexOf('const handleAIAjuste = async');
    const handleEnd = content.indexOf('if (!isOpen || !song) return null;', handleStart);
    const handleContent = content.substring(handleStart, handleEnd);
    
    // 3. exige user antes do fetch;
    // 4. exige effectiveOrganizationId antes do fetch;
    a.ok(handleContent.includes('!user') || handleContent.includes('user === undefined'));
    a.ok(handleContent.includes('!effectiveOrganizationId'));
    
    // 5. chama user.getIdToken();
    a.ok(handleContent.includes('user.getIdToken()'));
    
    // 6. possui header Authorization;
    a.ok(handleContent.includes('"Authorization"'));
    
    // 7. usa Bearer com o token;
    a.ok(handleContent.includes('Bearer '));
    a.ok(handleContent.includes('token'));
    
    // 8. envia organizationId no body;
    a.ok(handleContent.includes('organizationId:'));
    
    // 9. organizationId usa effectiveOrganizationId;
    a.ok(handleContent.includes('organizationId: effectiveOrganizationId'));
    
    // 10. envia chords;
    // 11. envia instructions;
    a.ok(handleContent.includes('chords: sourceChords'));
    a.ok(handleContent.includes('instructions: prompt'));
    
    // 12. não envia userId;
    a.ok(!handleContent.includes('userId:'));
    
    // 13. continua lendo data.fixedChords;
    a.ok(handleContent.includes('data.fixedChords'));
    
    // 14. continua chamando onSave;
    a.ok(handleContent.includes('onSave({'));
    
    // 15. não foi redesenhado nem teve estrutura geral substituída.
    a.ok(content.includes('return createPortal('));
    a.ok(content.includes('fixed inset-0 z-[120]'));
  });

console.log(`\nResults: ${passed} passed, ${failed} failed, ${registered} total`);
  process.exitCode = failed > 0 ? 1 : 0;
}

runTest();
