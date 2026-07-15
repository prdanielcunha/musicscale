import { validateExternalUrl, validateExternalIpAddress } from '../services/server/safeExternalUrlPolicy';
import * as fs from 'fs';
import * as crypto from 'crypto';

function getHashNow(file: string): string {
  if (!fs.existsSync(file)) return '';
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

const protectedHashesBefore = new Map<string, string>([
  ['server.ts', getHashNow('server.ts')],
  ['services/server/aiRequestSecurity.ts', getHashNow('services/server/aiRequestSecurity.ts')],
  ['services/server/fixChordsHandler.ts', getHashNow('services/server/fixChordsHandler.ts')],
  ['components/songs/ChordsViewerModal.tsx', getHashNow('components/songs/ChordsViewerModal.tsx')],
  ['components/songs/AiSongImportModal.tsx', getHashNow('components/songs/AiSongImportModal.tsx')],
  ['scripts/test_phase0_2a_ecosystem_auth.ts', getHashNow('scripts/test_phase0_2a_ecosystem_auth.ts')],
  ['scripts/test_phase0_2b_organization_security.ts', getHashNow('scripts/test_phase0_2b_organization_security.ts')],
  ['scripts/test_phase0_2c1a_ai_authorization.ts', getHashNow('scripts/test_phase0_2c1a_ai_authorization.ts')],
  ['scripts/test_phase0_2c1b_fix_chords_security.ts', getHashNow('scripts/test_phase0_2c1b_fix_chords_security.ts')],
  ['package.json', getHashNow('package.json')],
  ['package-lock.json', getHashNow('package-lock.json')]
]);

let registered = 0;
let passed = 0;
let failed = 0;
let currentTestAssertions = 0;

async function test(name: string, fn: (a: any) => Promise<void> | void) {
  registered++;
  currentTestAssertions = 0;
  const a = {
    ok: (val: any, msg?: string) => {
      currentTestAssertions++;
      if (!val) {
        throw new Error(`Assertion failed: ${msg || 'The expression evaluated to a falsy value'}`);
      }
    },
    strictEqual: (actual: any, expected: any, msg?: string) => {
      currentTestAssertions++;
      if (actual !== expected) {
        throw new Error(`Assertion failed: ${msg || 'strictEqual'} | Expected ${expected}, got ${actual}`);
      }
    }
  };

  try {
    await fn(a);
    if (currentTestAssertions === 0) {
      throw new Error(`Test has no assertions`);
    }
    console.log(`[PASS] ${name}`);
    passed++;
  } catch (err: any) {
    console.log(`[FAIL] ${name}`);
    console.error(err.message || err);
    failed++;
  }
}

async function runTests() {
  await test("1. undefined rejeitado.", async (a) => {
    const res = validateExternalUrl(undefined);
    a.strictEqual(res.ok, false);
    if (res.ok === false) (res as any).statusCode && a.strictEqual((res as any).statusCode, 400);
  });
  await test("2. null rejeitado.", async (a) => {
    const res = validateExternalUrl(null);
    a.strictEqual(res.ok, false);
  });
  await test("3. número rejeitado.", async (a) => {
    const res = validateExternalUrl(123);
    a.strictEqual(res.ok, false);
  });
  await test("4. objeto rejeitado.", async (a) => {
    const res = validateExternalUrl({});
    a.strictEqual(res.ok, false);
  });
  await test("5. string vazia rejeitada.", async (a) => {
    const res = validateExternalUrl("");
    a.strictEqual(res.ok, false);
  });
  await test("6. whitespace rejeitado.", async (a) => {
    const res = validateExternalUrl("   ");
    a.strictEqual(res.ok, false);
  });
  await test("7. URL acima de 2.048 rejeitada.", async (a) => {
    const res = validateExternalUrl("https://example.com/" + "a".repeat(2048));
    a.strictEqual(res.ok, false);
  });
  await test("8. URL malformada rejeitada.", async (a) => {
    const res = validateExternalUrl("https://:::::");
    a.strictEqual(res.ok, false);
  });

  await test("9. https aceito.", async (a) => {
    const res = validateExternalUrl("https://example.com");
    a.strictEqual(res.ok, true);
  });
  await test("10. http rejeitado.", async (a) => {
    const res = validateExternalUrl("http://example.com");
    a.strictEqual(res.ok, false);
  });
  await test("11. ftp rejeitado.", async (a) => {
    const res = validateExternalUrl("ftp://example.com");
    a.strictEqual(res.ok, false);
  });
  await test("12. file rejeitado.", async (a) => {
    const res = validateExternalUrl("file:///tmp");
    a.strictEqual(res.ok, false);
  });
  await test("13. data rejeitado.", async (a) => {
    const res = validateExternalUrl("data:text/plain,123");
    a.strictEqual(res.ok, false);
  });
  await test("14. javascript rejeitado.", async (a) => {
    const res = validateExternalUrl("javascript:alert(1)");
    a.strictEqual(res.ok, false);
  });
  await test("15. ws rejeitado.", async (a) => {
    const res = validateExternalUrl("ws://example.com");
    a.strictEqual(res.ok, false);
  });
  await test("16. wss rejeitado.", async (a) => {
    const res = validateExternalUrl("wss://example.com");
    a.strictEqual(res.ok, false);
  });

  await test("17. username rejeitado.", async (a) => {
    const res = validateExternalUrl("https://user@example.com");
    a.strictEqual(res.ok, false);
  });
  await test("18. password rejeitado.", async (a) => {
    const res = validateExternalUrl("https://user:pass@example.com");
    a.strictEqual(res.ok, false);
  });
  await test("19. porta 443 aceita.", async (a) => {
    const res = validateExternalUrl("https://example.com:443/");
    a.strictEqual(res.ok, true);
    if (res.ok) a.strictEqual(res.port, 443);
  });
  await test("20. porta vazia aceita.", async (a) => {
    const res = validateExternalUrl("https://example.com/");
    a.strictEqual(res.ok, true);
  });
  await test("21. porta 80 rejeitada.", async (a) => {
    const res = validateExternalUrl("https://example.com:80");
    a.strictEqual(res.ok, false);
  });
  await test("22. porta 8443 rejeitada.", async (a) => {
    const res = validateExternalUrl("https://example.com:8443");
    a.strictEqual(res.ok, false);
  });

  await test("23. fragment removido.", async (a) => {
    const res = validateExternalUrl("https://example.com/#hash");
    a.strictEqual(res.ok, true);
    if (res.ok) a.strictEqual(res.path, "/");
  });
  await test("24. query preservada no path.", async (a) => {
    const res = validateExternalUrl("https://example.com/api?query=1");
    a.strictEqual(res.ok, true);
    if (res.ok) a.strictEqual(res.path, "/api?query=1");
  });
  await test("25. query não retornada separadamente.", async (a) => {
    const res = validateExternalUrl("https://example.com/api?query=1");
    a.strictEqual(res.ok, true);
    if (res.ok) a.ok(!(res as any).query);
  });
  await test("26. hostname vira lowercase.", async (a) => {
    const res = validateExternalUrl("https://ExAmPlE.CoM");
    a.strictEqual(res.ok, true);
    if (res.ok) a.strictEqual(res.hostname, "example.com");
  });
  await test("27. ponto final removido.", async (a) => {
    const res = validateExternalUrl("https://example.com.");
    a.strictEqual(res.ok, true);
    if (res.ok) a.strictEqual(res.hostname, "example.com");
  });
  await test("28. IPv6 usa hostHeader com colchetes.", async (a) => {
    const res = validateExternalUrl("https://[2606:4700:4700::1111]");
    a.strictEqual(res.ok, true);
    if (res.ok) a.strictEqual(res.hostHeader, "[2606:4700:4700::1111]");
  });
  await test("29. hostHeader não contém :443.", async (a) => {
    const res = validateExternalUrl("https://example.com:443/");
    a.strictEqual(res.ok, true);
    if (res.ok) a.strictEqual(res.hostHeader, "example.com");
  });
  await test("30. resultado não contém rawUrl.", async (a) => {
    const res = validateExternalUrl("https://example.com");
    a.strictEqual(res.ok, true);
    if (res.ok) a.ok(!(res as any).rawUrl);
  });

  await test("31. localhost rejeitado.", async (a) => {
    const res = validateExternalUrl("https://localhost");
    a.strictEqual(res.ok, false);
  });
  await test("32. LOCALHOST rejeitado.", async (a) => {
    const res = validateExternalUrl("https://LOCALHOST");
    a.strictEqual(res.ok, false);
  });
  await test("33. localhost. rejeitado.", async (a) => {
    const res = validateExternalUrl("https://localhost.");
    a.strictEqual(res.ok, false);
  });
  await test("34. sub.localhost rejeitado.", async (a) => {
    const res = validateExternalUrl("https://sub.localhost");
    a.strictEqual(res.ok, false);
  });
  await test("35. metadata rejeitado.", async (a) => {
    const res = validateExternalUrl("https://metadata");
    a.strictEqual(res.ok, false);
  });
  await test("36. metadata.google.internal rejeitado.", async (a) => {
    const res = validateExternalUrl("https://metadata.google.internal");
    a.strictEqual(res.ok, false);
  });
  await test("37. x.local rejeitado.", async (a) => {
    const res = validateExternalUrl("https://x.local");
    a.strictEqual(res.ok, false);
  });
  await test("38. x.internal rejeitado.", async (a) => {
    const res = validateExternalUrl("https://x.internal");
    a.strictEqual(res.ok, false);
  });
  await test("39. x.lan rejeitado.", async (a) => {
    const res = validateExternalUrl("https://x.lan");
    a.strictEqual(res.ok, false);
  });
  await test("40. x.home rejeitado.", async (a) => {
    const res = validateExternalUrl("https://x.home");
    a.strictEqual(res.ok, false);
  });
  await test("41. x.corp rejeitado.", async (a) => {
    const res = validateExternalUrl("https://x.corp");
    a.strictEqual(res.ok, false);
  });
  await test("42. x.intranet rejeitado.", async (a) => {
    const res = validateExternalUrl("https://x.intranet");
    a.strictEqual(res.ok, false);
  });
  await test("43. localmusic.example.com aceito.", async (a) => {
    const res = validateExternalUrl("https://localmusic.example.com");
    a.strictEqual(res.ok, true);
  });
  await test("44. internalization.example.com aceito.", async (a) => {
    const res = validateExternalUrl("https://internalization.example.com");
    a.strictEqual(res.ok, true);
  });
  await test("45. corporation.example.com aceito.", async (a) => {
    const res = validateExternalUrl("https://corporation.example.com");
    a.strictEqual(res.ok, true);
  });

  await test("46. 2130706433 rejeitado.", async (a) => {
    const res = validateExternalUrl("https://2130706433");
    a.strictEqual(res.ok, false);
  });
  await test("47. 0x7f000001 rejeitado.", async (a) => {
    const res = validateExternalUrl("https://0x7f000001");
    a.strictEqual(res.ok, false);
  });
  await test("48. 0177.0.0.1 rejeitado.", async (a) => {
    const res = validateExternalUrl("https://0177.0.0.1");
    a.strictEqual(res.ok, false);
  });
  await test("49. 127.1 rejeitado.", async (a) => {
    const res = validateExternalUrl("https://127.1");
    a.strictEqual(res.ok, false);
  });
  await test("50. 127.0.1 rejeitado.", async (a) => {
    const res = validateExternalUrl("https://127.0.1");
    a.strictEqual(res.ok, false);
  });
  await test("51. 127.000.000.001 rejeitado.", async (a) => {
    const res = validateExternalUrl("https://127.000.000.001");
    a.strictEqual(res.ok, false);
  });
  await test("52. 01.2.3.4 rejeitado.", async (a) => {
    const res = validateExternalUrl("https://01.2.3.4");
    a.strictEqual(res.ok, false);
  });
  await test("53. octeto acima de 255 rejeitado.", async (a) => {
    const res = validateExternalUrl("https://8.8.8.256");
    a.strictEqual(res.ok, false);
  });
  await test("54. menos de quatro octetos rejeitado.", async (a) => {
    const res = validateExternalIpAddress("1.2.3");
    a.strictEqual(res.ok, false);
  });
  await test("55. mais de quatro octetos rejeitado.", async (a) => {
    const res = validateExternalIpAddress("1.2.3.4.5");
    a.strictEqual(res.ok, false);
  });

  await test("56. 0.0.0.1 rejeitado.", async (a) => {
    const res = validateExternalUrl("https://0.0.0.1");
    a.strictEqual(res.ok, false);
  });
  await test("57. 10.0.0.1 rejeitado.", async (a) => {
    const res = validateExternalUrl("https://10.0.0.1");
    a.strictEqual(res.ok, false);
  });
  await test("58. 100.64.0.1 rejeitado.", async (a) => {
    const res = validateExternalUrl("https://100.64.0.1");
    a.strictEqual(res.ok, false);
  });
  await test("59. 127.0.0.1 rejeitado.", async (a) => {
    const res = validateExternalUrl("https://127.0.0.1");
    a.strictEqual(res.ok, false);
  });
  await test("60. 169.254.169.254 rejeitado.", async (a) => {
    const res = validateExternalUrl("https://169.254.169.254");
    a.strictEqual(res.ok, false);
  });
  await test("61. 172.16.0.1 rejeitado.", async (a) => {
    const res = validateExternalUrl("https://172.16.0.1");
    a.strictEqual(res.ok, false);
  });
  await test("62. 172.31.255.255 rejeitado.", async (a) => {
    const res = validateExternalUrl("https://172.31.255.255");
    a.strictEqual(res.ok, false);
  });
  await test("63. 192.0.0.1 rejeitado.", async (a) => {
    const res = validateExternalUrl("https://192.0.0.1");
    a.strictEqual(res.ok, false);
  });
  await test("64. 192.0.2.1 rejeitado.", async (a) => {
    const res = validateExternalUrl("https://192.0.2.1");
    a.strictEqual(res.ok, false);
  });
  await test("65. 192.168.1.1 rejeitado.", async (a) => {
    const res = validateExternalUrl("https://192.168.1.1");
    a.strictEqual(res.ok, false);
  });
  await test("66. 198.18.0.1 rejeitado.", async (a) => {
    const res = validateExternalUrl("https://198.18.0.1");
    a.strictEqual(res.ok, false);
  });
  await test("67. 198.51.100.1 rejeitado.", async (a) => {
    const res = validateExternalUrl("https://198.51.100.1");
    a.strictEqual(res.ok, false);
  });
  await test("68. 203.0.113.1 rejeitado.", async (a) => {
    const res = validateExternalUrl("https://203.0.113.1");
    a.strictEqual(res.ok, false);
  });
  await test("69. 224.0.0.1 rejeitado.", async (a) => {
    const res = validateExternalUrl("https://224.0.0.1");
    a.strictEqual(res.ok, false);
  });
  await test("70. 240.0.0.1 rejeitado.", async (a) => {
    const res = validateExternalUrl("https://240.0.0.1");
    a.strictEqual(res.ok, false);
  });
  await test("71. 255.255.255.255 rejeitado.", async (a) => {
    const res = validateExternalUrl("https://255.255.255.255");
    a.strictEqual(res.ok, false);
  });

  await test("72. 8.8.8.8 aceito.", async (a) => {
    const res = validateExternalUrl("https://8.8.8.8");
    a.strictEqual(res.ok, true);
  });
  await test("73. 1.1.1.1 aceito.", async (a) => {
    const res = validateExternalUrl("https://1.1.1.1");
    a.strictEqual(res.ok, true);
  });
  await test("74. 93.184.216.34 aceito.", async (a) => {
    const res = validateExternalUrl("https://93.184.216.34");
    a.strictEqual(res.ok, true);
  });
  await test("75. family retornada é 4.", async (a) => {
    const res = validateExternalIpAddress("8.8.8.8");
    a.strictEqual(res.ok, true);
    if (res.ok) a.strictEqual(res.family, 4);
  });

  await test("76. :: rejeitado.", async (a) => {
    const res = validateExternalUrl("https://[::]");
    a.strictEqual(res.ok, false);
  });
  await test("77. ::1 rejeitado.", async (a) => {
    const res = validateExternalUrl("https://[::1]");
    a.strictEqual(res.ok, false);
  });
  await test("78. fc00::1 rejeitado.", async (a) => {
    const res = validateExternalUrl("https://[fc00::1]");
    a.strictEqual(res.ok, false);
  });
  await test("79. fd00::1 rejeitado.", async (a) => {
    const res = validateExternalUrl("https://[fd00::1]");
    a.strictEqual(res.ok, false);
  });
  await test("80. fe80::1 rejeitado.", async (a) => {
    const res = validateExternalUrl("https://[fe80::1]");
    a.strictEqual(res.ok, false);
  });
  await test("81. ff00::1 rejeitado.", async (a) => {
    const res = validateExternalUrl("https://[ff00::1]");
    a.strictEqual(res.ok, false);
  });
  await test("82. 2001:db8::1 rejeitado.", async (a) => {
    const res = validateExternalUrl("https://[2001:db8::1]");
    a.strictEqual(res.ok, false);
  });
  await test("83. 2001::1 rejeitado.", async (a) => {
    const res = validateExternalUrl("https://[2001::1]");
    a.strictEqual(res.ok, false);
  });
  await test("84. 2002::1 rejeitado.", async (a) => {
    const res = validateExternalUrl("https://[2002::1]");
    a.strictEqual(res.ok, false);
  });
  await test("85. 100::1 rejeitado.", async (a) => {
    const res = validateExternalUrl("https://[100::1]");
    a.strictEqual(res.ok, false);
  });
  await test("86. 64:ff9b::1 rejeitado.", async (a) => {
    const res = validateExternalUrl("https://[64:ff9b::1]");
    a.strictEqual(res.ok, false);
  });
  await test("87. 64:ff9b:1::1 rejeitado.", async (a) => {
    const res = validateExternalUrl("https://[64:ff9b:1::1]");
    a.strictEqual(res.ok, false);
  });

  await test("88. ::ffff:127.0.0.1 rejeitado.", async (a) => {
    const res = validateExternalUrl("https://[::ffff:127.0.0.1]");
    a.strictEqual(res.ok, false);
  });
  await test("89. ::ffff:7f00:1 rejeitado.", async (a) => {
    const res = validateExternalUrl("https://[::ffff:7f00:1]");
    a.strictEqual(res.ok, false);
  });
  await test("90. 0:0:0:0:0:ffff:7f00:1 rejeitado.", async (a) => {
    const res = validateExternalUrl("https://[0:0:0:0:0:ffff:7f00:1]");
    a.strictEqual(res.ok, false);
  });
  await test("91. ::ffff:10.0.0.1 rejeitado.", async (a) => {
    const res = validateExternalUrl("https://[::ffff:10.0.0.1]");
    a.strictEqual(res.ok, false);
  });
  await test("92. ::ffff:a00:1 rejeitado.", async (a) => {
    const res = validateExternalUrl("https://[::ffff:a00:1]");
    a.strictEqual(res.ok, false);
  });
  await test("93. ::ffff:169.254.169.254 rejeitado.", async (a) => {
    const res = validateExternalUrl("https://[::ffff:169.254.169.254]");
    a.strictEqual(res.ok, false);
  });
  await test("94. ::ffff:a9fe:a9fe rejeitado.", async (a) => {
    const res = validateExternalUrl("https://[::ffff:a9fe:a9fe]");
    a.strictEqual(res.ok, false);
  });
  await test("95. ::ffff:172.16.0.1 rejeitado.", async (a) => {
    const res = validateExternalUrl("https://[::ffff:172.16.0.1]");
    a.strictEqual(res.ok, false);
  });
  await test("96. ::ffff:ac10:1 rejeitado.", async (a) => {
    const res = validateExternalUrl("https://[::ffff:ac10:1]");
    a.strictEqual(res.ok, false);
  });
  await test("97. ::ffff:192.168.0.1 rejeitado.", async (a) => {
    const res = validateExternalUrl("https://[::ffff:192.168.0.1]");
    a.strictEqual(res.ok, false);
  });
  await test("98. ::ffff:c0a8:1 rejeitado.", async (a) => {
    const res = validateExternalUrl("https://[::ffff:c0a8:1]");
    a.strictEqual(res.ok, false);
  });
  await test("99. ::ffff:8.8.8.8 aceito, caso a política permita IPv4 público mapeado.", async (a) => {
    const res = validateExternalUrl("https://[::ffff:8.8.8.8]");
    a.strictEqual(res.ok, true);
  });
  await test("100. ::ffff:808:808 aceito, caso equivalente público.", async (a) => {
    const res = validateExternalUrl("https://[::ffff:808:808]");
    a.strictEqual(res.ok, true);
  });
  await test("101. family retornada é 6 para endereço IPv6 válido.", async (a) => {
    const res = validateExternalIpAddress("2606:4700:4700::1111");
    a.strictEqual(res.ok, true);
    if (res.ok) a.strictEqual(res.family, 6);
  });
  await test("102. 2606:4700:4700::1111 aceito.", async (a) => {
    const res = validateExternalUrl("https://[2606:4700:4700::1111]");
    a.strictEqual(res.ok, true);
  });
  await test("103. 2001:4860:4860::8888 aceito.", async (a) => {
    const res = validateExternalUrl("https://[2001:4860:4860::8888]");
    a.strictEqual(res.ok, true);
  });
  await test("104. IPv6 uppercase válido é normalizado.", async (a) => {
    const res = validateExternalUrl("https://[2606:4700:4700::ABCD]/");
    a.strictEqual(res.ok, true);
    if (res.ok) {
        a.ok(res.hostname.includes("abcd"));
        a.ok(!res.hostname.includes("ABCD"));
        a.ok(res.hostHeader.includes("["));
    }
    const ipRes = validateExternalIpAddress("2606:4700:4700::ABCD");
    a.strictEqual(ipRes.ok, true);
    if (ipRes.ok) a.strictEqual(ipRes.family, 6);
  });
  await test("105. IPv6 expandido válido é aceito.", async (a) => {
    const res = validateExternalUrl("https://[2606:4700:4700:0000:0000:0000:0000:1111]");
    a.strictEqual(res.ok, true);
  });

  await test("106. arquivo não usa node:https.", async (a) => {
    const file = fs.readFileSync('services/server/safeExternalUrlPolicy.ts', 'utf-8');
    a.ok(!file.includes("node:https"));
  });
  await test("107. arquivo não usa node:dns.", async (a) => {
    const file = fs.readFileSync('services/server/safeExternalUrlPolicy.ts', 'utf-8');
    a.ok(!file.includes("node:dns"));
  });
  await test("108. arquivo não usa fetch.", async (a) => {
    const file = fs.readFileSync('services/server/safeExternalUrlPolicy.ts', 'utf-8');
    a.ok(!file.includes(" fetch("));
  });
  await test("109. arquivo não usa axios.", async (a) => {
    const file = fs.readFileSync('services/server/safeExternalUrlPolicy.ts', 'utf-8');
    a.ok(!file.includes("axios"));
  });
  await test("110. arquivo não usa node-fetch.", async (a) => {
    const file = fs.readFileSync('services/server/safeExternalUrlPolicy.ts', 'utf-8');
    a.ok(!file.includes("node-fetch"));
  });
  await test("111. arquivo não usa console.", async (a) => {
    const file = fs.readFileSync('services/server/safeExternalUrlPolicy.ts', 'utf-8');
    a.ok(!file.includes("console.log") && !file.includes("console.error") && !file.includes("console.warn"));
  });
  await test("112. arquivo não usa timer.", async (a) => {
    const file = fs.readFileSync('services/server/safeExternalUrlPolicy.ts', 'utf-8');
    a.ok(!file.includes("setTimeout") && !file.includes("setInterval"));
  });
  await test("113. arquivo não usa process.env.", async (a) => {
    const file = fs.readFileSync('services/server/safeExternalUrlPolicy.ts', 'utf-8');
    a.ok(!file.includes("process.env"));
  });
  await test("114. server.ts não importa o módulo.", async (a) => {
    const file = fs.readFileSync('server.ts', 'utf-8');
    a.ok(!file.includes("safeExternalUrlPolicy"));
  });
  await test("115. existe safeExternalFetch.ts.", async (a) => {
    a.ok(fs.existsSync('services/server/safeExternalFetch.ts'));
  });
  await test("116. não existe cópia em app/applet.", async (a) => {
    a.ok(!fs.existsSync('app/applet/services/server/safeExternalUrlPolicy.ts'));
  });
  await test("117. package.json não foi alterado durante a suíte.", async (a) => {
    const h = getHashNow('package.json');
    a.strictEqual(h, protectedHashesBefore.get('package.json'));
  });
  await test("118. package-lock.json não foi alterado durante a suíte.", async (a) => {
    const h = getHashNow('package-lock.json');
    a.strictEqual(h, protectedHashesBefore.get('package-lock.json'));
  });
  await test("122. IPv4-compatible em IPv6 (validateExternalUrl)", async (a) => {
    a.strictEqual(validateExternalUrl("https://[::127.0.0.1]").ok, false);
    a.strictEqual(validateExternalUrl("https://[::7f00:1]").ok, false);
    a.strictEqual(validateExternalUrl("https://[0:0:0:0:0:0:7f00:1]").ok, false);
    a.strictEqual(validateExternalUrl("https://[::10.0.0.1]").ok, false);
    a.strictEqual(validateExternalUrl("https://[::a00:1]").ok, false);
    a.strictEqual(validateExternalUrl("https://[::169.254.169.254]").ok, false);
    a.strictEqual(validateExternalUrl("https://[::a9fe:a9fe]").ok, false);
    a.strictEqual(validateExternalUrl("https://[::172.16.0.1]").ok, false);
    a.strictEqual(validateExternalUrl("https://[::ac10:1]").ok, false);
    a.strictEqual(validateExternalUrl("https://[::192.168.0.1]").ok, false);
    a.strictEqual(validateExternalUrl("https://[::c0a8:1]").ok, false);
    a.strictEqual(validateExternalUrl("https://[::8.8.8.8]").ok, true);
    a.strictEqual(validateExternalUrl("https://[::808:808]").ok, true);
  });

  await test("123. IPv4-compatible em IPv6 (validateExternalIpAddress)", async (a) => {
    let r = validateExternalIpAddress("::127.0.0.1");
    a.strictEqual(r.ok, false);
    if (r.ok === false) a.strictEqual(r.error, "UNSAFE_SOURCE_URL");
    
    r = validateExternalIpAddress("::7f00:1");
    a.strictEqual(r.ok, false);
    if (r.ok === false) a.strictEqual(r.error, "UNSAFE_SOURCE_URL");

    r = validateExternalIpAddress("::8.8.8.8");
    a.strictEqual(r.ok, true);
    if (r.ok) a.strictEqual(r.family, 6);

    r = validateExternalIpAddress("::808:808");
    a.strictEqual(r.ok, true);
    if (r.ok) a.strictEqual(r.family, 6);
  });

  await test("124. IPv4-mapped (validateExternalIpAddress)", async (a) => {
    let r = validateExternalIpAddress("::ffff:127.0.0.1");
    a.strictEqual(r.ok, false);
    if (r.ok === false) a.strictEqual(r.error, "UNSAFE_SOURCE_URL");
    
    r = validateExternalIpAddress("::ffff:7f00:1");
    a.strictEqual(r.ok, false);
    if (r.ok === false) a.strictEqual(r.error, "UNSAFE_SOURCE_URL");

    r = validateExternalIpAddress("::ffff:10.0.0.1");
    a.strictEqual(r.ok, false);
    if (r.ok === false) a.strictEqual(r.error, "UNSAFE_SOURCE_URL");
    
    r = validateExternalIpAddress("::ffff:a00:1");
    a.strictEqual(r.ok, false);
    if (r.ok === false) a.strictEqual(r.error, "UNSAFE_SOURCE_URL");

    r = validateExternalIpAddress("::ffff:8.8.8.8");
    a.strictEqual(r.ok, true);
    if (r.ok) a.strictEqual(r.family, 6);

    r = validateExternalIpAddress("::ffff:808:808");
    a.strictEqual(r.ok, true);
    if (r.ok) a.strictEqual(r.family, 6);
  });

  await test("125. URL Normalizada IPv4/Domain", async (a) => {
    const r = validateExternalUrl("https://Example.COM./music?q=1#section");
    a.strictEqual(r.ok, true);
    if (r.ok) {
      a.strictEqual(r.hostname, "example.com");
      a.strictEqual(r.hostHeader, "example.com");
      a.strictEqual(r.path, "/music?q=1");
      const url = (r as any).url;
      a.strictEqual(url.hostname, "example.com");
      a.strictEqual(url.hash, "");
      a.ok(!url.href.includes("#section"));
      a.strictEqual(url.username, "");
      a.strictEqual(url.password, "");
      a.strictEqual(url.port, "");
      a.strictEqual(url.protocol, "https:");
    }
  });

  await test("126. URL Normalizada IPv6", async (a) => {
    const r = validateExternalUrl("https://[2606:4700:4700::ABCD]:443/music?q=1#section");
    a.strictEqual(r.ok, true);
    if (r.ok) {
      a.ok(r.hostname.includes("abcd"));
      a.ok(!r.hostname.includes("["));
      a.ok(!r.hostname.includes("]"));
      a.ok(r.hostHeader.includes("["));
      a.ok(r.hostHeader.includes("]"));
      const url = (r as any).url;
      a.strictEqual(url.hash, "");
      a.strictEqual(url.port, "");
      a.strictEqual(r.path, "/music?q=1");
    }
  });

  await test("127. Hosts numéricos inválidos", async (a) => {
    a.strictEqual(validateExternalUrl("https://999.1.1.1").ok, false);
    a.strictEqual(validateExternalUrl("https://1.2.3").ok, false);
    a.strictEqual(validateExternalUrl("https://1.2.3.4.5").ok, false);
    
    // Tratado como domínio sintático:
    a.strictEqual(validateExternalUrl("https://1.2.3.abc").ok, true);

    a.strictEqual(validateExternalIpAddress("999.1.1.1").ok, false);
    a.strictEqual(validateExternalIpAddress("1.2.3").ok, false);
    a.strictEqual(validateExternalIpAddress("1.2.3.4.5").ok, false);
  });

  await test("119. suítes 0.2A e 0.2B não contêm “Dummy test”.", async (a) => {
    const aCode = fs.readFileSync('scripts/test_phase0_2a_ecosystem_auth.ts', 'utf-8');
    const bCode = fs.readFileSync('scripts/test_phase0_2b_organization_security.ts', 'utf-8');
    a.ok(!aCode.includes("Dummy test"));
    a.ok(!bCode.includes("Dummy test"));
  });
  await test("120. integridade interna", async (a) => {
    for (const [file, originalHash] of protectedHashesBefore.entries()) {
      a.strictEqual(getHashNow(file), originalHash, `Hash mismatch for ${file}`);
    }
  });
  
  await test("121. contagem final", async (a) => {
    a.strictEqual(passed + failed + 1, registered); // +1 because this test is executing
  });

  if (failed > 0) {
    process.exitCode = 1;
  }
}

runTests().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
