import { createSafeExternalDnsResolver, SafeExternalDnsResolverOptions } from "../services/server/safeExternalDnsResolver.js";
import { readFileSync, existsSync, readdirSync } from "fs";
import { join } from "path";
import { createHash } from "crypto";

const FILES = [
  "index.html",
  "index.tsx",
  "components/AppErrorBoundary.tsx",
  "App.tsx",
  "server.ts",
  "services/server/safeExternalUrlPolicy.ts",
  "services/server/aiRequestSecurity.ts",
  "services/server/fixChordsHandler.ts",
  "scripts/test_phase0_2a_ecosystem_auth.ts",
  "scripts/test_phase0_2b_organization_security.ts",
  "scripts/test_phase0_2c1a_ai_authorization.ts",
  "scripts/test_phase0_2c1b_fix_chords_security.ts",
  "scripts/test_phase0_2c1c1_safe_external_url_policy.ts",
  "package.json",
  "package-lock.json"
];

const initialHashes = new Map<string, string>();
for (const file of FILES) {
  const fullPath = join(process.cwd(), file);
  if (!existsSync(fullPath)) throw new Error(`Arquivo protegido não existe: ${file}`);
  const hash = createHash("sha256").update(readFileSync(fullPath)).digest("hex");
  if (hash.length !== 64) throw new Error(`Hash inválido para ${file}`);
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

    strictEqual(
      actual: unknown,
      expected: unknown,
      message?: string
    ) {
      assertionCount++;

      if (actual !== expected) {
        throw new Error(
          `${message || "Equality failed"}: ${String(actual)} !== ${String(expected)}`
        );
      }
    },

    deepStrictEqual(
      actual: unknown,
      expected: unknown,
      message?: string
    ) {
      assertionCount++;

      const actualJson = JSON.stringify(actual);
      const expectedJson = JSON.stringify(expected);

      if (actualJson !== expectedJson) {
        throw new Error(
          `${message || "Deep equality failed"}: ${actualJson} !== ${expectedJson}`
        );
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
  } catch (error) {
    failed++;

    const safeMessage =
      error instanceof Error
        ? error.message
        : "Unknown test failure";

    console.error(`[FAIL] ${name}`);
    console.error(`       ${safeMessage}`);
  }
}

const E = (code: string) => {
  const err = new Error(code);
  (err as any).code = code;
  return err;
};

class MockAbortController {
  private controller = new AbortController();
  public signal = this.controller.signal;
  public listeners: any[] = [];
  constructor() {
    const add = this.signal.addEventListener.bind(this.signal);
    const rm = this.signal.removeEventListener.bind(this.signal);
    this.signal.addEventListener = (type: string, l: any, opt?: any) => { this.listeners.push(l); add(type, l, opt); };
    this.signal.removeEventListener = (type: string, l: any, opt?: any) => { this.listeners = this.listeners.filter(x => x !== l); rm(type, l, opt); };
  }
  abort() { this.controller.abort(); }
}

function createMockResolver() {
  let r4: any = () => Promise.resolve([]), r6: any = () => Promise.resolve([]);
  let r4Calls = 0, r6Calls = 0;
  let r4Resolve: any, r4Reject: any, r6Resolve: any, r6Reject: any;
  const deps: SafeExternalDnsResolverOptions = {
    resolve4: async (h) => { r4Calls++; return r4(h); },
    resolve6: async (h) => { r6Calls++; return r6(h); }
  };
  return {
    deps,
    get resolve4Calls() { return r4Calls; },
    get resolve6Calls() { return r6Calls; },
    set4Result: (val: any) => { r4 = () => val instanceof Error ? Promise.reject(val) : Promise.resolve(val); },
    set6Result: (val: any) => { r6 = () => val instanceof Error ? Promise.reject(val) : Promise.resolve(val); },
    make4Promise: () => { r4 = () => new Promise((res, rej) => { r4Resolve = res; r4Reject = rej; }); },
    make6Promise: () => { r6 = () => new Promise((res, rej) => { r6Resolve = res; r6Reject = rej; }); },
    trigger4: (val: any) => val instanceof Error ? r4Reject(val) : r4Resolve(val),
    trigger6: (val: any) => val instanceof Error ? r6Reject(val) : r6Resolve(val)
  };
}

(async () => {
  // CORREÇÃO 4 - arquivos protegidos existem e possuem hashes iniciais válidos
  await test("1. arquivos protegidos existem e possuem hashes iniciais válidos", async (assert) => {
    for (const f of FILES) {
      const fullPath = join(process.cwd(), f);
      assert.ok(existsSync(fullPath), `Arquivo protegido não existe: ${f}`);
      const h = createHash("sha256").update(readFileSync(fullPath)).digest("hex");
      assert.ok(h, `Hash do arquivo ${f} está ausente`);
      assert.strictEqual(h.length, 64, `Hash do arquivo ${f} não possui 64 caracteres`);
      assert.ok(/^[0-9a-f]{64}$/.test(h), `Hash do arquivo ${f} não é hexadecimal válido`);
      const initialHash = initialHashes.get(f);
      assert.ok(initialHash, `Hash inicial de ${f} está ausente`);
      assert.strictEqual(h, initialHash, `Hash inicial mudou de valor para ${f}`);
    }
  });

  await test("2. higiene sem dependência de horário.", async (assert) => {
    const forbidden = [
      "app/applet/services/server/safeExternalDnsResolver.ts",
      "app/applet/scripts/test_phase0_2c1c2_safe_external_dns_resolver.ts",
      "debug-test21.ts", "test-ip.ts", "test-ip2.ts", "test-ip3.ts", "test-normalize.ts", "test-normalize2.ts"
    ];
    for (const f of forbidden) assert.ok(!existsSync(join(process.cwd(), f)), `Existe proibido: ${f}`);
    
    const ALLOWED = new Set([
      "fix_hover.cjs", "fix_mixblend.cjs", "fix_ai_modal.cjs", "fix_toast_perf.cjs",
      "fix_dashboard_perf2.cjs", "fix_ts2.cjs", "fix_hover.js", "update9.ts",
      "update2.ts", "fix_dashboard_perf.cjs", "fix_ai_modal2.cjs", "fix_rules.cjs",
      "update7.ts", "fix_contexts_toast.cjs", "update.ts", "fix_share2.cjs",
      "fix_script.ts", "update_flag.ts", "update4.ts", "update6.ts",
      "update8_rules.ts", "fix_share_ui.cjs", "fix_reprocess.cjs", "update3.ts",
      "update5.ts", "fix_all_blurs.cjs", "fix_share.cjs", "fix_ts.cjs"
    ]);
    const bad = readdirSync(process.cwd()).filter(f => 
      (f.startsWith("debug") || f.startsWith("patch") || f.startsWith("fix") || f.startsWith("update") || f.startsWith("check")) && !ALLOWED.has(f)
    );
    assert.strictEqual(bad.length, 0, `Lixo encontrado: ${bad.join(", ")}`);
  });

  // CORREÇÃO 2 - Helpers devem retornar Promise
  async function testRejectInput(name: string, input: any): Promise<void> {
    await test(name, async (assert) => {
      const m = createMockResolver();
      const res = await createSafeExternalDnsResolver(m.deps)(input);
      assert.strictEqual(res.ok, false);
      assert.strictEqual((res as any).statusCode, 502);
      assert.strictEqual((res as any).error, "SOURCE_DNS_FAILED");
      assert.strictEqual(m.resolve4Calls, 0);
      assert.strictEqual(m.resolve6Calls, 0);
    });
  }

  await testRejectInput("3. entrada undefined.", undefined);
  await testRejectInput("4. entrada null.", null);
  await testRejectInput("5. entrada número.", 123 as any);
  await testRejectInput("6. entrada objeto.", {} as any);
  await testRejectInput("7. entrada string vazia.", "");
  await testRejectInput("8. entrada somente whitespace.", "   \t\n\r ");
  await testRejectInput("9. entrada com protocolo.", "http://example.com");
  await testRejectInput("10. entrada com barra.", "example.com/path");
  await testRejectInput("11. entrada com query.", "example.com?query=1");
  await testRejectInput("12. entrada com fragment.", "example.com#hash");
  await testRejectInput("13. entrada com porta.", "example.com:8080");
  await testRejectInput("14. entrada com @.", "user@example.com");
  await testRejectInput("15. entrada com espaço interno.", "exa mple.com");
  await testRejectInput("16. entrada com tab interno.", "exa\tmple.com");
  await testRejectInput("17. entrada com quebra de linha interna.", "exa\nmple.com");
  await testRejectInput("18. entrada com carriage return interno.", "exa\rmple.com");

  await test("19. entrada com maiúsculas vira lowercase.", async (assert) => {
    const m = createMockResolver(); m.set4Result(["8.8.8.8"]);
    const res = await createSafeExternalDnsResolver(m.deps)("ExAmPlE.CoM");
    assert.strictEqual(res.ok, true);
    assert.strictEqual((res as any).hostname, "example.com");
  });

  await test("20. entrada com ponto final ao término é normalizada.", async (assert) => {
    const m = createMockResolver(); m.set4Result(["8.8.8.8"]);
    const res = await createSafeExternalDnsResolver(m.deps)("example.com.");
    assert.strictEqual(res.ok, true);
    assert.strictEqual((res as any).hostname, "example.com");
  });

  // CORREÇÃO 2 - Helpers devem retornar Promise
  async function testRejectIp(name: string, ip: string): Promise<void> {
    await test(name, async (assert) => {
      const m = createMockResolver();
      const res = await createSafeExternalDnsResolver(m.deps)(ip);
      assert.strictEqual(res.ok, false);
      assert.strictEqual((res as any).statusCode, 403);
      assert.strictEqual((res as any).error, "UNSAFE_SOURCE_URL");
      assert.strictEqual(m.resolve4Calls, 0);
      assert.strictEqual(m.resolve6Calls, 0);
    });
  }

  async function testAcceptIp(name: string, ip: string, expectedFamily: 4 | 6): Promise<void> {
    await test(name, async (assert) => {
      const m = createMockResolver();
      const res = await createSafeExternalDnsResolver(m.deps)(ip);
      assert.strictEqual(res.ok, true);
      assert.strictEqual((res as any).addresses.length, 1);
      const cleanIp = ip.trim().toLowerCase().replace('[', '').replace(']', '');
      assert.strictEqual((res as any).addresses[0].address, cleanIp);
      assert.strictEqual((res as any).addresses[0].family, expectedFamily);
      assert.strictEqual(m.resolve4Calls, 0);
      assert.strictEqual(m.resolve6Calls, 0);
    });
  }

  await testAcceptIp("21. IPv4 público direto não consulta DNS.", "8.8.8.8", 4);
  await testRejectIp("22. IPv4 privado direto é rejeitado.", "127.0.0.1");
  await testAcceptIp("23. IPv6 público direto não consulta DNS.", "2001:4860:4860::8888", 6);
  await testRejectIp("24. IPv6 privado direto é rejeitado.", "::1");
  await testRejectIp("25. IPv4-mapped privado é rejeitado.", "::ffff:127.0.0.1");
  await testRejectIp("26. IPv4-compatible privado é rejeitado.", "::127.0.0.1");
  
  await test("27. IPv4-mapped público é aceito como family 6.", async (assert) => {
    const m = createMockResolver();
    const res = await createSafeExternalDnsResolver(m.deps)("::ffff:8.8.8.8");
    assert.strictEqual(res.ok, true);
    assert.strictEqual((res as any).addresses.length, 1);
    assert.strictEqual((res as any).addresses[0].address, "::ffff:808:808");
    assert.strictEqual((res as any).addresses[0].family, 6);
  });

  await test("28. IPv4-compatible público é aceito como family 6.", async (assert) => {
    const m = createMockResolver();
    const res = await createSafeExternalDnsResolver(m.deps)("::8.8.8.8");
    assert.strictEqual(res.ok, true);
    assert.strictEqual((res as any).addresses.length, 1);
    assert.strictEqual((res as any).addresses[0].address, "::808:808");
    assert.strictEqual((res as any).addresses[0].family, 6);
  });

  await test("29. selectedAddress é sempre o primeiro endereço retornado.", async (assert) => {
    const res = await createSafeExternalDnsResolver(createMockResolver().deps)("8.8.8.8");
    assert.strictEqual(res.ok, true);
    assert.strictEqual((res as any).selectedAddress, (res as any).addresses[0]);
  });

  await test("30. hostname normalizado para IP literal.", async (assert) => {
    const res = await createSafeExternalDnsResolver(createMockResolver().deps)("  [2001:4860:4860::8888]  ");
    assert.strictEqual(res.ok, true);
    assert.strictEqual((res as any).hostname, "2001:4860:4860::8888");
  });

  await test("31. somente A público retorna sucesso.", async (assert) => {
    const m = createMockResolver(); m.set4Result(["8.8.8.8"]); m.set6Result([]);
    const res = await createSafeExternalDnsResolver(m.deps)("example.com");
    assert.strictEqual(res.ok, true);
    assert.strictEqual((res as any).addresses.length, 1);
    assert.strictEqual((res as any).addresses[0].family, 4);
  });

  await test("32. somente AAAA público retorna sucesso.", async (assert) => {
    const m = createMockResolver(); m.set4Result([]); m.set6Result(["2001:4860:4860::8888"]);
    const res = await createSafeExternalDnsResolver(m.deps)("example.com");
    assert.strictEqual(res.ok, true);
    assert.strictEqual((res as any).addresses.length, 1);
    assert.strictEqual((res as any).addresses[0].family, 6);
  });

  await test("33. ambos A e AAAA públicos retornam sucesso.", async (assert) => {
    const m = createMockResolver(); m.set4Result(["8.8.8.8"]); m.set6Result(["2001:4860:4860::8888"]);
    const res = await createSafeExternalDnsResolver(m.deps)("example.com");
    assert.strictEqual(res.ok, true);
    assert.strictEqual((res as any).addresses.length, 2);
  });

  await test("34. ENODATA em A com AAAA público é aceito.", async (assert) => {
    const m = createMockResolver(); m.set4Result(E("ENODATA")); m.set6Result(["2001:4860:4860::8888"]);
    const res = await createSafeExternalDnsResolver(m.deps)("example.com");
    assert.strictEqual(res.ok, true);
    assert.strictEqual((res as any).addresses.length, 1);
  });

  await test("35. ENOTFOUND em AAAA com A público é aceito.", async (assert) => {
    const m = createMockResolver(); m.set4Result(["8.8.8.8"]); m.set6Result(E("ENOTFOUND"));
    const res = await createSafeExternalDnsResolver(m.deps)("example.com");
    assert.strictEqual(res.ok, true);
    assert.strictEqual((res as any).addresses.length, 1);
  });

  await test("36. EAI_NONAME em uma família com outra válida é aceito.", async (assert) => {
    const m = createMockResolver(); m.set4Result(["8.8.8.8"]); m.set6Result(E("EAI_NONAME"));
    const res = await createSafeExternalDnsResolver(m.deps)("example.com");
    assert.strictEqual(res.ok, true);
    assert.strictEqual((res as any).addresses.length, 1);
  });

  await test("37. ambas as famílias retornando vazio rejeita.", async (assert) => {
    const m = createMockResolver(); m.set4Result([]); m.set6Result([]);
    const res = await createSafeExternalDnsResolver(m.deps)("example.com");
    assert.strictEqual(res.ok, false);
    assert.strictEqual((res as any).statusCode, 502);
  });

  await test("38. ENOTFOUND em ambas as famílias rejeita.", async (assert) => {
    const m = createMockResolver(); m.set4Result(E("ENOTFOUND")); m.set6Result(E("ENOTFOUND"));
    const res = await createSafeExternalDnsResolver(m.deps)("example.com");
    assert.strictEqual(res.ok, false);
    assert.strictEqual((res as any).statusCode, 502);
  });

  await test("39. erro técnico em A rejeita mesmo com AAAA público.", async (assert) => {
    const m = createMockResolver(); m.set4Result(E("SERVFAIL")); m.set6Result(["2001:4860:4860::8888"]);
    const res = await createSafeExternalDnsResolver(m.deps)("example.com");
    assert.strictEqual(res.ok, false);
    assert.strictEqual((res as any).statusCode, 502);
  });

  await test("40. erro técnico em AAAA rejeita mesmo com A público.", async (assert) => {
    const m = createMockResolver(); m.set4Result(["8.8.8.8"]); m.set6Result(E("SERVFAIL"));
    const res = await createSafeExternalDnsResolver(m.deps)("example.com");
    assert.strictEqual(res.ok, false);
    assert.strictEqual((res as any).statusCode, 502);
  });

  await test("41. retorno não array de resolve4 é tratado como erro.", async (assert) => {
    const m = createMockResolver(); m.set4Result("8.8.8.8" as any); m.set6Result([]);
    const res = await createSafeExternalDnsResolver(m.deps)("example.com");
    assert.strictEqual(res.ok, false);
    assert.strictEqual((res as any).statusCode, 502);
  });

  await test("42. retorno não array de resolve6 é tratado como erro.", async (assert) => {
    const m = createMockResolver(); m.set4Result([]); m.set6Result("2001:4860:4860::8888" as any);
    const res = await createSafeExternalDnsResolver(m.deps)("example.com");
    assert.strictEqual(res.ok, false);
    assert.strictEqual((res as any).statusCode, 502);
  });

  await test("43. item não string em resolve4 rejeita.", async (assert) => {
    const m = createMockResolver(); m.set4Result([123 as any]); m.set6Result([]);
    const res = await createSafeExternalDnsResolver(m.deps)("example.com");
    assert.strictEqual(res.ok, false);
    assert.strictEqual((res as any).statusCode, 502);
  });

  await test("44. item não string em resolve6 rejeita.", async (assert) => {
    const m = createMockResolver(); m.set4Result([]); m.set6Result([{} as any]);
    const res = await createSafeExternalDnsResolver(m.deps)("example.com");
    assert.strictEqual(res.ok, false);
    assert.strictEqual((res as any).statusCode, 502);
  });

  await test("45. item vazio em resolve4 rejeita.", async (assert) => {
    const m = createMockResolver(); m.set4Result([""]); m.set6Result([]);
    const res = await createSafeExternalDnsResolver(m.deps)("example.com");
    assert.strictEqual(res.ok, false);
    assert.strictEqual((res as any).statusCode, 502);
  });

  await test("46. item inválido (não IP) em resolve4 rejeita.", async (assert) => {
    const m = createMockResolver(); m.set4Result(["not-an-ip"]); m.set6Result([]);
    const res = await createSafeExternalDnsResolver(m.deps)("example.com");
    assert.strictEqual(res.ok, false);
    assert.strictEqual((res as any).statusCode, 502);
  });

  await test("47. endereço IPv4 recebido por resolve6 rejeita.", async (assert) => {
    const m = createMockResolver(); m.set4Result([]); m.set6Result(["8.8.8.8"]);
    const res = await createSafeExternalDnsResolver(m.deps)("example.com");
    assert.strictEqual(res.ok, false);
    assert.strictEqual((res as any).statusCode, 502);
  });

  await test("48. endereço IPv6 recebido por resolve4 rejeita.", async (assert) => {
    const m = createMockResolver(); m.set4Result(["2001:4860:4860::8888"]); m.set6Result([]);
    const res = await createSafeExternalDnsResolver(m.deps)("example.com");
    assert.strictEqual(res.ok, false);
    assert.strictEqual((res as any).statusCode, 502);
  });

  await test("49. exatamente 32 endereços total é permitido.", async (assert) => {
    const m = createMockResolver(); m.set4Result(Array.from({ length: 32 }, (_, i) => `8.8.8.${i}`)); m.set6Result([]);
    const res = await createSafeExternalDnsResolver(m.deps)("example.com");
    assert.strictEqual(res.ok, true);
    assert.strictEqual((res as any).addresses.length, 32);
  });

  await test("50. 33 endereços total é rejeitado.", async (assert) => {
    const m = createMockResolver(); m.set4Result(Array.from({ length: 33 }, (_, i) => `8.8.8.${i}`)); m.set6Result([]);
    const res = await createSafeExternalDnsResolver(m.deps)("example.com");
    assert.strictEqual(res.ok, false);
    assert.strictEqual((res as any).statusCode, 502);
  });

  await test("51. A público + A privado rejeita todo o host.", async (assert) => {
    const m = createMockResolver(); m.set4Result(["8.8.8.8", "127.0.0.1"]); m.set6Result([]);
    const res = await createSafeExternalDnsResolver(m.deps)("example.com");
    assert.strictEqual(res.ok, false);
    assert.strictEqual((res as any).statusCode, 403);
  });

  await test("52. A público + AAAA privado rejeita todo o host.", async (assert) => {
    const m = createMockResolver(); m.set4Result(["8.8.8.8"]); m.set6Result(["::1"]);
    const res = await createSafeExternalDnsResolver(m.deps)("example.com");
    assert.strictEqual(res.ok, false);
    assert.strictEqual((res as any).statusCode, 403);
  });

  await test("53. AAAA público + IPv4-mapped privado rejeita.", async (assert) => {
    const m = createMockResolver(); m.set4Result([]); m.set6Result(["2001:4860:4860::8888", "::ffff:127.0.0.1"]);
    const res = await createSafeExternalDnsResolver(m.deps)("example.com");
    assert.strictEqual(res.ok, false);
    assert.strictEqual((res as any).statusCode, 403);
  });

  await test("54. endereço inseguro na última posição também rejeita.", async (assert) => {
    const m = createMockResolver(); m.set4Result(["8.8.8.8", "8.8.4.4"]); m.set6Result(["2001:4860:4860::8888", "::1"]);
    const res = await createSafeExternalDnsResolver(m.deps)("example.com");
    assert.strictEqual(res.ok, false);
    assert.strictEqual((res as any).statusCode, 403);
  });

  await test("55. erro não contém lista parcial de endereços.", async (assert) => {
    const m = createMockResolver(); m.set4Result(["8.8.8.8", "127.0.0.1"]);
    const res = await createSafeExternalDnsResolver(m.deps)("example.com");
    assert.strictEqual(res.ok, false); assert.strictEqual((res as any).addresses, undefined);
  });

  await test("56. nenhum resultado parcial se houver falha.", async (assert) => {
    const m = createMockResolver(); m.set4Result(["127.0.0.1", "8.8.8.8"]);
    const res = await createSafeExternalDnsResolver(m.deps)("example.com");
    assert.strictEqual(res.ok, false); assert.strictEqual((res as any).selectedAddress, undefined);
  });

  await test("57. todos os endereços são processados.", async (assert) => {
    const m = createMockResolver(); m.set4Result(["8.8.8.8", "192.168.1.1"]);
    const res = await createSafeExternalDnsResolver(m.deps)("example.com");
    assert.strictEqual(res.ok, false);
    assert.strictEqual((res as any).statusCode, 403);
  });

  await test("58. todos os IPs precisam ser seguros.", async (assert) => {
    const m = createMockResolver(); m.set4Result(["8.8.8.8"]); m.set6Result(["fc00::1"]);
    const res = await createSafeExternalDnsResolver(m.deps)("example.com");
    assert.strictEqual(res.ok, false);
    assert.strictEqual((res as any).statusCode, 403);
  });

  await test("59. IPv4 duplicado é deduplicado.", async (assert) => {
    const m = createMockResolver(); m.set4Result(["8.8.8.8", "8.8.8.8", "8.8.4.4", "8.8.8.8"]);
    const res = await createSafeExternalDnsResolver(m.deps)("example.com");
    assert.strictEqual(res.ok, true);
    assert.strictEqual((res as any).addresses.length, 2);
  });

  await test("60. IPv6 duplicado é deduplicado.", async (assert) => {
    const m = createMockResolver(); m.set6Result(["2001:4860:4860::8888", "2001:4860:4860::8888"]);
    const res = await createSafeExternalDnsResolver(m.deps)("example.com");
    assert.strictEqual(res.ok, true);
    assert.strictEqual((res as any).addresses.length, 1);
  });

  await test("61. IPv6 expandido e comprimido são deduplicados.", async (assert) => {
    const m = createMockResolver(); m.set6Result(["2001:4860:4860::8888", "2001:4860:4860:0000:0000:0000:0000:8888", "2001:4860:4860:0:0:0:0:8888"]);
    const res = await createSafeExternalDnsResolver(m.deps)("example.com");
    assert.strictEqual(res.ok, true);
    assert.strictEqual((res as any).addresses.length, 1);
  });

  await test("62. família 4 vem antes de família 6 na ordenação.", async (assert) => {
    const m = createMockResolver(); m.set4Result(["8.8.8.8"]); m.set6Result(["2001:4860:4860::8888"]);
    const res = await createSafeExternalDnsResolver(m.deps)("example.com");
    assert.strictEqual(res.ok, true);
    assert.strictEqual((res as any).addresses[0].family, 4);
    assert.strictEqual((res as any).addresses[1].family, 6);
  });

  await test("63. endereços IPv4 são ordenados.", async (assert) => {
    const m = createMockResolver(); m.set4Result(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);
    const res = await createSafeExternalDnsResolver(m.deps)("example.com");
    assert.strictEqual(res.ok, true);
    assert.strictEqual((res as any).addresses[0].address, "1.1.1.1");
  });

  await test("64. endereços IPv6 são ordenados.", async (assert) => {
    const m = createMockResolver(); m.set6Result(["2606:4700:4700::1111", "2001:4860:4860::8888"]);
    const res = await createSafeExternalDnsResolver(m.deps)("example.com");
    assert.strictEqual(res.ok, true);
    assert.strictEqual((res as any).addresses[0].address, "2001:4860:4860::8888");
  });

  await test("65. selectedAddress é o primeiro do array ordenado.", async (assert) => {
    const m = createMockResolver(); m.set4Result(["8.8.8.8", "1.1.1.1"]);
    const res = await createSafeExternalDnsResolver(m.deps)("example.com");
    assert.strictEqual(res.ok, true);
    assert.strictEqual((res as any).selectedAddress.address, "1.1.1.1");
  });

  await test("66. mesma seleção para ordens diferentes.", async (assert) => {
    const m1 = createMockResolver(); m1.set4Result(["8.8.8.8", "1.1.1.1"]);
    const res1 = await createSafeExternalDnsResolver(m1.deps)("example.com");
    const m2 = createMockResolver(); m2.set4Result(["1.1.1.1", "8.8.8.8"]);
    const res2 = await createSafeExternalDnsResolver(m2.deps)("example.com");
    assert.deepStrictEqual(res1, res2);
  });

  await test("67. resolve4 e resolve6 são concorrentes e aguardam ambos.", async (assert) => {
    const m = createMockResolver(); m.make4Promise(); m.make6Promise();
    const promise = createSafeExternalDnsResolver(m.deps)("example.com");
    await Promise.resolve();
    assert.strictEqual(m.resolve4Calls, 1); assert.strictEqual(m.resolve6Calls, 1);
    m.trigger4(["8.8.8.8"]); m.trigger6(["2001:4860:4860::8888"]);
    const res = await promise; assert.strictEqual(res.ok, true);
    assert.strictEqual((res as any).addresses.length, 2);
  });

  await test("68. resolve4 e resolve6 iniciam juntos.", async (assert) => {
    const m = createMockResolver(); m.make4Promise(); m.make6Promise();
    const promise = createSafeExternalDnsResolver(m.deps)("example.com");
    await Promise.resolve();
    assert.strictEqual(m.resolve4Calls, 1); assert.strictEqual(m.resolve6Calls, 1);
    m.trigger4([]); m.trigger6(["2001:4860:4860::8888"]);
    const res = await promise; assert.strictEqual(res.ok, true);
  });

  await test("69. abort retorna 504 enquanto as consultas DNS permanecem tratadas", async (assert) => {
    const m = createMockResolver(); m.make4Promise(); m.make6Promise();
    const ctrl = new MockAbortController();
    const promise = createSafeExternalDnsResolver(m.deps)("example.com", { signal: ctrl.signal });
    await Promise.resolve();
    assert.strictEqual(m.resolve4Calls, 1);
    assert.strictEqual(m.resolve6Calls, 1);
    
    ctrl.abort();
    const res = await promise;
    
    assert.strictEqual(res.ok, false);
    assert.strictEqual((res as any).statusCode, 504);
    assert.strictEqual((res as any).error, "SOURCE_TIMEOUT");
    
    assert.strictEqual(m.resolve4Calls, 1);
    assert.strictEqual(m.resolve6Calls, 1);
    
    m.trigger4(["8.8.8.8"]);
    m.trigger6(["2001:4860:4860::8888"]);
  });

  await test("70. signal já abortado não chama DNS.", async (assert) => {
    const m = createMockResolver(); const ctrl = new MockAbortController(); ctrl.abort();
    const res = await createSafeExternalDnsResolver(m.deps)("example.com", { signal: ctrl.signal });
    assert.strictEqual(res.ok, false); assert.strictEqual(m.resolve4Calls, 0);
  });

  await test("71. signal já abortado retorna 504 SOURCE_TIMEOUT.", async (assert) => {
    const m = createMockResolver(); const ctrl = new MockAbortController(); ctrl.abort();
    const res = await createSafeExternalDnsResolver(m.deps)("example.com", { signal: ctrl.signal });
    assert.strictEqual(res.ok, false);
    assert.strictEqual((res as any).statusCode, 504);
    assert.strictEqual((res as any).error, "SOURCE_TIMEOUT");
  });

  await test("72. abort durante DNS retorna 504.", async (assert) => {
    const m = createMockResolver(); m.make4Promise(); m.make6Promise(); const ctrl = new MockAbortController();
    const p = createSafeExternalDnsResolver(m.deps)("example.com", { signal: ctrl.signal });
    await Promise.resolve(); ctrl.abort();
    const res = await p; assert.strictEqual(res.ok, false);
    assert.strictEqual((res as any).statusCode, 504);
  });

  await test("73. resultado tardio não substitui timeout.", async (assert) => {
    const m = createMockResolver(); m.make4Promise(); m.make6Promise(); const ctrl = new MockAbortController();
    const p = createSafeExternalDnsResolver(m.deps)("example.com", { signal: ctrl.signal });
    await Promise.resolve(); ctrl.abort();
    m.trigger4(["8.8.8.8"]); m.trigger6(["2001:4860:4860::8888"]);
    const res = await p; assert.strictEqual(res.ok, false);
    assert.strictEqual((res as any).statusCode, 504);
  });

  await test("74. rejeição tardia não gera unhandledRejection.", async (assert) => {
    let unhandled = 0; const listener = () => { unhandled++; };
    process.on("unhandledRejection", listener);
    try {
      const m = createMockResolver(); m.make4Promise(); m.make6Promise(); const ctrl = new MockAbortController();
      const p = createSafeExternalDnsResolver(m.deps)("example.com", { signal: ctrl.signal });
      await Promise.resolve(); ctrl.abort(); await p;
      m.trigger4(E("SERVFAIL")); m.trigger6(E("SERVFAIL"));
      await new Promise(r => process.nextTick(r));
      assert.strictEqual(unhandled, 0);
    } finally {
      process.removeListener("unhandledRejection", listener);
    }
  });

  await test("75. listener removido após sucesso.", async (assert) => {
    const m = createMockResolver(); m.set4Result(["8.8.8.8"]); const ctrl = new MockAbortController();
    await createSafeExternalDnsResolver(m.deps)("example.com", { signal: ctrl.signal });
    assert.strictEqual(ctrl.listeners.length, 0);
  });

  await test("76. listener removido após erro.", async (assert) => {
    const m = createMockResolver(); m.set4Result(E("SERVFAIL")); const ctrl = new MockAbortController();
    await createSafeExternalDnsResolver(m.deps)("example.com", { signal: ctrl.signal });
    assert.strictEqual(ctrl.listeners.length, 0);
  });

  await test("77. listener removido após abort.", async (assert) => {
    const m = createMockResolver(); m.make4Promise(); const ctrl = new MockAbortController();
    const p = createSafeExternalDnsResolver(m.deps)("example.com", { signal: ctrl.signal });
    await Promise.resolve(); ctrl.abort(); await p;
    assert.strictEqual(ctrl.listeners.length, 0);
  });

  await test("78. corrida no addEventListener com abort imediato.", async (assert) => {
    const m = createMockResolver(); m.make4Promise(); m.make6Promise(); const ctrl = new MockAbortController();
    const origAdd = ctrl.signal.addEventListener.bind(ctrl.signal);
    ctrl.signal.addEventListener = (evt, listener) => {
      origAdd(evt, listener);
      ctrl.abort();
    };
    const res = await createSafeExternalDnsResolver(m.deps)("example.com", { signal: ctrl.signal });
    assert.strictEqual(res.ok, false);
    assert.strictEqual((res as any).statusCode, 504);
    assert.strictEqual(ctrl.listeners.length, 0);
  });

  await test("79. nenhuma exceção escapa ao chamador.", async (assert) => {
    const m = createMockResolver(); m.deps.resolve4 = () => { throw new Error("CRASH"); };
    const res = await createSafeExternalDnsResolver(m.deps)("example.com");
    assert.strictEqual(res.ok, false);
    assert.strictEqual((res as any).statusCode, 502);
  });

  await test("80. privacidade completa dos erros (entrada inválida e erro de DNS).", async (assert) => {
    const res1 = await createSafeExternalDnsResolver()(null);
    assert.strictEqual(res1.ok, false);
    assert.strictEqual("message" in res1, false);
    assert.strictEqual("stack" in res1, false);
    assert.strictEqual("addresses" in res1, false);
    assert.strictEqual("selectedAddress" in res1, false);
    assert.strictEqual("hostname" in res1, false);

    const m = createMockResolver();
    m.set4Result(E("SERVFAIL"));
    m.set6Result(E("SERVFAIL"));
    const res2 = await createSafeExternalDnsResolver(m.deps)("example.com");
    assert.strictEqual(res2.ok, false);
    assert.strictEqual("message" in res2, false);
    assert.strictEqual("stack" in res2, false);
    assert.strictEqual("addresses" in res2, false);
    assert.strictEqual("selectedAddress" in res2, false);
    assert.strictEqual("hostname" in res2, false);
  });

  await test("81. resolvedor não contém console, logger ou dependências de rede e APIs proibidas.", async (assert) => {
    const content = readFileSync(join(process.cwd(), "services/server/safeExternalDnsResolver.ts"), "utf-8");
    const lowerContent = content.toLowerCase();

    assert.ok(!content.includes("console.log"), "Contém console.log");
    assert.ok(!content.includes("console.error"), "Contém console.error");
    assert.ok(!content.includes("console.warn"), "Contém console.warn");
    assert.ok(!content.includes("logger"), "Contém logger");
    assert.ok(!content.includes("node:https"), "Contém node:https");
    assert.ok(!content.includes("node:http"), "Contém node:http");
    assert.ok(!content.includes("node:tls"), "Contém node:tls");
    assert.ok(!content.includes("fetch("), "Contém fetch(");
    assert.ok(!content.includes("node-fetch"), "Contém node-fetch");
    assert.ok(!content.includes("axios"), "Contém axios");
    assert.ok(!content.includes("setTimeout"), "Contém setTimeout");
    assert.ok(!content.includes("setInterval"), "Contém setInterval");
    assert.ok(!content.includes("process.env"), "Contém process.env");
    assert.ok(!lowerContent.includes("firebase"), "Contém firebase");
    assert.ok(!lowerContent.includes("@google/genai"), "Contém @google/genai");
    assert.ok(!lowerContent.includes("gemini"), "Contém gemini");
  });

  await test("82. server.ts não importa resolvedor e possui rota única.", async (assert) => {
    const content = readFileSync(join(process.cwd(), "server.ts"), "utf-8");
    assert.ok(!content.includes("safeExternalDnsResolver"), "Imports resolvedor.");
    const matches = content.match(/app\.post\(\s*['"]\/api\/ai-import['"]/g);
    assert.strictEqual(matches && matches.length, 1, "Não possui rota única.");
  });

  await test("83. rota /api/ai-import possui todas as validações e campos.", async (assert) => {
    const content = readFileSync(join(process.cwd(), "server.ts"), "utf-8");
    let start = content.indexOf('app.post("/api/ai-import"');
    if (start === -1) start = content.indexOf("app.post('/api/ai-import'");
    assert.ok(start !== -1, "Início não encontrado.");
    const rem = content.slice(start);
    const m = rem.slice(25).match(/app\.(post|get|put|delete|use|listen)/);
    const end = m && m.index ? m.index + 25 : rem.length;
    const block = rem.slice(0, end);
    assert.ok(block.includes("preProcessSongText") && block.includes("cleanChordsText") && block.includes("stripTablatureArtifacts") && block.includes("removeChordOnlyLinesFromLyrics") && block.includes("validateNoChordLinesInLyrics") && block.includes("usedAi") && block.includes("processingTimeMs"));
  });

  await test("84. conformidade do escopo de arquivos.", async (assert) => {
    assert.ok(existsSync(join(process.cwd(), "services/server/safeExternalDnsResolver.ts")));
    assert.ok(existsSync(join(process.cwd(), "scripts/test_phase0_2c1c2_safe_external_dns_resolver.ts")));
    assert.ok(!existsSync(join(process.cwd(), "app/applet/services/server/safeExternalDnsResolver.ts")));
    assert.ok(!existsSync(join(process.cwd(), "app/applet/scripts/test_phase0_2c1c2_safe_external_dns_resolver.ts")));
    for (const temp of ["debug-test21.ts", "test-ip.ts", "test-ip2.ts", "test-ip3.ts", "test-normalize.ts", "test-normalize2.ts"]) {
      assert.ok(!existsSync(join(process.cwd(), temp)), `Existe temporário: ${temp}`);
    }
  });

  await test("85. todas as chamadas de teste na suíte usam await.", async (assert) => {
    const selfContent = readFileSync(join(process.cwd(), "scripts/test_phase0_2c1c2_safe_external_dns_resolver.ts"), "utf-8");
    const lines = selfContent.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const testKey = "te" + "st" + "(";
      const rejectInputKey = "te" + "stRejectInput" + "(";
      const rejectIpKey = "te" + "stRejectIp" + "(";
      const acceptIpKey = "te" + "stAcceptIp" + "(";

      if (
        (line.includes(testKey) && !line.includes(".test(") && !line.startsWith("async f" + "unction te" + "st(") && !line.includes("selfContent") && !line.includes("Key")) ||
        (line.includes(rejectInputKey) && !line.startsWith("async f" + "unction te" + "stRejectInput(")) ||
        (line.includes(rejectIpKey) && !line.startsWith("async f" + "unction te" + "stRejectIp(")) ||
        (line.includes(acceptIpKey) && !line.startsWith("async f" + "unction te" + "stAcceptIp("))
      ) {
        if (line.startsWith("//") || line.includes("selfContent") || line.includes("Key")) {
          continue;
        }
        assert.ok(line.startsWith("await "), `Linha ${i + 1} chamou teste sem await: ${line}`);
      }
    }
  });

  await test("86. integridade final dos arquivos protegidos", async (assert) => {
    for (const f of FILES) {
      const fullPath = join(process.cwd(), f);
      assert.ok(existsSync(fullPath), `Arquivo protegido continua não existindo ao final: ${f}`);
      const h = createHash("sha256").update(readFileSync(fullPath)).digest("hex");
      assert.ok(h, `Hash final do arquivo ${f} está ausente`);
      assert.strictEqual(h.length, 64, `Hash final de ${f} não possui 64 caracteres`);
      assert.ok(/^[0-9a-f]{64}$/.test(h), `Hash final do arquivo ${f} não é hexadecimal válido`);
      
      const initial = initialHashes.get(f);
      assert.ok(initial, `Hash inicial para ${f} não encontrado no mapa`);
      assert.strictEqual(h, initial, `Arquivo protegido foi modificado: ${f}`);
    }
  });

  await test("87. contabilidade de testes", async (assert) => {
    assert.strictEqual(passed + failed, registered - 1, "Inconsistência na contabilidade de testes");
  });

  console.log(`\nTests passed: ${passed}`);
  console.log(`Tests failed: ${failed}`);
  console.log(`Total tests: ${registered}`);
  if (passed + failed !== registered) {
    console.error("Test accounting mismatch");
    process.exitCode = 1;
  } else if (failed > 0) {
    process.exitCode = 1;
  }
})();
