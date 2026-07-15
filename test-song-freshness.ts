import {
  isValidDateOnly,
  normalizeToDateOnly,
  addCalendarMonths,
  maxValidDateOnly,
  evaluateSongFreshness,
  FreshnessEvaluationResult
} from './utils/songFreshnessEvaluation';
import { Song } from './types';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

// Simple deeply recursive freeze helper to test immutability
function deepFreeze<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  Object.freeze(obj);
  Object.getOwnPropertyNames(obj).forEach((prop) => {
    const val = (obj as any)[prop];
    if (val !== null && (typeof val === 'object' || typeof val === 'function') && !Object.isFrozen(val)) {
      deepFreeze(val);
    }
  });
  return obj;
}

const runTests = () => {
  console.info("============== STARTING FRESHNESS PHASE 6A TEST SUITE ==============");
  let passedCount = 0;

  const runTest = (name: string, fn: () => void) => {
    try {
      fn();
      console.info(`✓ PASSED: ${name}`);
      passedCount++;
    } catch (e: any) {
      console.error(`✗ FAILED: ${name}`);
      console.error(e.message || e);
      process.exit(1);
    }
  };

  // TestCase 1: Música nova automática ainda dentro do prazo.
  runTest("1. Música nova automática ainda dentro do prazo", () => {
    const song: Partial<Song> = {
      createdAt: "2026-01-01T12:00:00Z",
      freshness: { status: 'new', source: 'auto' }
    };
    const res = evaluateSongFreshness(song, "2026-05-01");
    assert(res.shouldUpdate === false, "Should not update yet");
    assert(res.reason === "not_expired", "Reason should be not_expired");
    assert(res.expirationDate === "2026-07-01", "Expiration date should be 2026-07-01");
  });

  // TestCase 2: Música nova automática exatamente no vencimento.
  runTest("2. Música nova automática exatamente no vencimento", () => {
    const song: Partial<Song> = {
      createdAt: "2026-01-12",
      freshness: { status: 'new', source: 'auto' }
    };
    const res = evaluateSongFreshness(song, "2026-07-12");
    assert(res.shouldUpdate === true, "Should trigger update exactly on day of expiration");
    assert(res.reason === "expired_new", "Reason should be expired_new");
    assert(res.nextStatus === "old", "nextStatus should be old");
    assert(res.nextSource === "auto", "nextSource should be auto");
  });

  // TestCase 3: Música nova automática depois do vencimento.
  runTest("3. Música nova automática depois do vencimento", () => {
    const song: Partial<Song> = {
      createdAt: "2025-10-01",
      freshness: { status: 'new', source: 'auto' }
    };
    const res = evaluateSongFreshness(song, "2026-06-12");
    assert(res.shouldUpdate === true, "Should update after expiration");
    assert(res.reason === "expired_new", "Reason should be expired_new");
  });

  // TestCase 4: Música nova manual com manualResetAt.
  runTest("4. Música nova manual com manualResetAt", () => {
    const song: Partial<Song> = {
      createdAt: "2025-01-01",
      freshness: { status: 'new', source: 'manual', manualResetAt: "2026-02-15" }
    };
    // 2026-02-15 + 6m = 2026-08-15
    const before = evaluateSongFreshness(song, "2026-06-01");
    const exact = evaluateSongFreshness(song, "2026-08-15");
    const after = evaluateSongFreshness(song, "2026-08-16");

    assert(before.shouldUpdate === false && before.reason === 'not_expired', "Before expiry should be not_expired");
    assert(exact.shouldUpdate === true && exact.reason === 'expired_new', "Exact expiry should be expired_new");
    assert(after.shouldUpdate === true && after.reason === 'expired_new', "After expiry should be expired_new");
  });

  // TestCase 5: Música default manual com reset recente.
  runTest("5. Música default manual com reset recente", () => {
    const song: Partial<Song> = {
      createdAt: "2025-01-01",
      freshness: { status: 'default', source: 'manual', manualResetAt: "2026-05-10" }
    };
    const res = evaluateSongFreshness(song, "2026-06-12");
    assert(res.shouldUpdate === false, "Should not update");
    assert(res.reason === "not_expired", "Reason is not_expired");
  });

  // TestCase 6: Música default manual vencida.
  runTest("6. Música default manual vencida", () => {
    const song: Partial<Song> = {
      createdAt: "2025-01-01",
      freshness: { status: 'default', source: 'manual', manualResetAt: "2025-11-20" }
    };
    const res = evaluateSongFreshness(song, "2026-06-12");
    assert(res.shouldUpdate === true, "Should update");
    assert(res.reason === "expired_default", "Reason is expired_default");
    assert(res.nextStatus === 'old', "Transit to old");
    assert(res.nextSource === 'auto', "Transit to auto source");
  });

  // TestCase 7: Música old manual antes e depois do prazo.
  runTest("7. Música old manual antes e depois do prazo", () => {
    const song: Partial<Song> = {
      createdAt: "2025-01-01",
      freshness: { status: 'old', source: 'manual', manualResetAt: "2026-05-01" }
    };
    const before = evaluateSongFreshness(song, "2026-06-01");
    const after = evaluateSongFreshness(song, "2026-12-31");

    assert(before.shouldUpdate === false && before.reason === 'manual_old_preserved', "Before expiry should keep manual_old");
    assert(after.shouldUpdate === false && after.reason === 'manual_old_preserved', "After expiry should keep manual_old");
  });

  // TestCase 8: Música old manual com escala futura.
  runTest("8. Música old manual com escala futura", () => {
    const song: Partial<Song> = {
      createdAt: "2025-01-01",
      lastScheduledAt: "2026-10-10",
      freshness: { status: 'old', source: 'manual' }
    };
    const res = evaluateSongFreshness(song, "2026-06-12");
    assert(res.shouldUpdate === false, "No update");
    assert(res.reason === "manual_old_preserved", "manual_old_preserved takes direct precedence over future scale rule");
  });

  // TestCase 9: Música old automática.
  runTest("9. Música old automática", () => {
    const song: Partial<Song> = {
      createdAt: "2025-01-01",
      freshness: { status: 'old', source: 'auto' }
    };
    const res = evaluateSongFreshness(song, "2026-06-12");
    assert(res.shouldUpdate === false, "No update");
    assert(res.reason === "already_old", "already_old is returned");
  });

  // TestCase 10: Música com escala futura.
  runTest("10. Música com escala futura", () => {
    const song: Partial<Song> = {
      createdAt: "2025-01-01",
      lastScheduledAt: "2026-08-20",
      freshness: { status: 'new', source: 'auto' }
    };
    const res = evaluateSongFreshness(song, "2026-06-12");
    assert(res.shouldUpdate === false, "Must protect song");
    assert(res.reason === "future_schedule_active", "Reason must be future_schedule_active");
  });

  // TestCase 11: Música com escala marcada para hoje.
  runTest("11. Música com escala marcada para hoje", () => {
    const song: Partial<Song> = {
      createdAt: "2025-01-01",
      lastScheduledAt: "2026-06-12",
      freshness: { status: 'new', source: 'auto' }
    };
    const res = evaluateSongFreshness(song, "2026-06-12");
    assert(res.shouldUpdate === false, "Should not update on today event schedule because today matches lastScheduledAt, which means today is reference date, raising expiry to 6 months in the future");
    assert(res.reason === "not_expired", "Reason should be not_expired");
    assert(res.expirationDate === "2026-12-12", "Expires 6 months after today");
  });

  // TestCase 12: lastScheduledAt mais recente que manualResetAt.
  runTest("12. lastScheduledAt mais recente que manualResetAt", () => {
    const song: Partial<Song> = {
      createdAt: "2025-01-01",
      freshness: { status: 'new', source: 'manual', manualResetAt: "2025-03-01" },
      lastScheduledAt: "2025-11-15"
    };
    // Max is 2025-11-15. 2025-11-15 + 6m = 2026-05-15
    const res = evaluateSongFreshness(song, "2026-05-14");
    assert(res.shouldUpdate === false, "Not expired yet");
    assert(res.expirationDate === "2026-05-15", "Expected correct expiration based on the lastScheduledAt max date");
  });

  // TestCase 13: manualResetAt mais recente que lastScheduledAt.
  runTest("13. manualResetAt mais recente que lastScheduledAt", () => {
    const song: Partial<Song> = {
      createdAt: "2025-01-01",
      freshness: { status: 'new', source: 'manual', manualResetAt: "2025-12-05" },
      lastScheduledAt: "2025-11-15"
    };
    // Max is 2025-12-05. 2025-12-05 + 6m = 2026-06-05
    const res = evaluateSongFreshness(song, "2026-06-12");
    assert(res.shouldUpdate === true, "Should be expired");
    assert(res.reason === "expired_new", "Expired since it is a new/manual status");
  });

  // TestCase 14: Música sem createdAt, mas com manualResetAt.
  runTest("14. Música sem createdAt, mas com manualResetAt", () => {
    const song: Partial<Song> = {
      freshness: { status: 'default', source: 'manual', manualResetAt: "2025-12-01" }
    };
    const res = evaluateSongFreshness(song, "2026-06-12");
    assert(res.shouldUpdate === true, "Should expire without createdAt");
    assert(res.referenceDate === "2025-12-01", "Should use manualResetAt as ref");
  });

  // TestCase 15: Música sem nenhuma data confiável.
  runTest("15. Música sem nenhuma data confiável", () => {
    const song: Partial<Song> = {
      freshness: { status: 'new', source: 'auto' }
    };
    const res = evaluateSongFreshness(song, "2026-06-12");
    assert(res.shouldUpdate === false, "No update");
    assert(res.reason === "missing_reference_date", "Missing reference date prevents change");
  });

  // TestCase 16: Música com data inválida.
  runTest("16. Música com data inválida", () => {
    const song: Partial<Song> = {
      createdAt: "not-a-date",
      freshness: { status: 'new', source: 'auto' }
    };
    const res = evaluateSongFreshness(song, "2026-06-12");
    assert(res.shouldUpdate === false, "No update");
    assert(res.reason === "missing_reference_date", "Invalid reference dates fall back to missing");
  });

  // TestCase 17: Música legada com isNew = true.
  runTest("17. Música legada com isNew = true", () => {
    const song: Partial<Song> = {
      createdAt: "2025-12-10",
      isNew: true
    };
    // 2025-12-10 + 6m = 2026-06-10
    const res = evaluateSongFreshness(song, "2026-06-12");
    assert(res.shouldUpdate === true, "Should degrade to old after 6m elapsed");
    assert(res.reason === "expired_new", "Reason matches expired_new due to legacy isNew mapping");
    assert(res.nextStatus === "old", "Next status is old");
  });

  // TestCase 18: Música sem freshness e sem isNew.
  runTest("18. Música sem freshness e sem isNew", () => {
    const song: Partial<Song> = {
      createdAt: "2025-12-10"
    };
    // 2025-12-10 + 6m = 2026-06-10
    const resBefore = evaluateSongFreshness(song, "2026-06-01");
    const resAfter = evaluateSongFreshness(song, "2026-06-12");

    assert(resBefore.shouldUpdate === false && resBefore.reason === 'not_expired', "Not expired");
    assert(resAfter.shouldUpdate === true && resAfter.reason === 'expired_default', "Expired default");
  });

  // TestCase 19: Data 31 de agosto adicionando seis meses.
  runTest("19. Data 31 de agosto adicionando seis meses (leap-year clamping)", () => {
    const aug31 = "2026-08-31";
    const res = addCalendarMonths(aug31, 6);
    assert(res === "2027-02-28", `Expected 2027-02-28, got ${res}`);
  });

  // TestCase 20: Ano bissexto.
  runTest("20. Ano bissexto (February leap year checking)", () => {
    const aug31Leap = "2027-08-31";
    const res = addCalendarMonths(aug31Leap, 6);
    assert(res === "2028-02-29", `Expected 2028-02-29 for leap year 2028, got ${res}`);
  });

  // TestCase 21: Entrada ISO completa convertida para date-only.
  runTest("21. Entrada ISO completa convertida para date-only", () => {
    const norm = normalizeToDateOnly("2026-06-12T15:54:59-07:00");
    assert(norm === "2026-06-12", `Expected 2026-06-12, got ${norm}`);
  });

  // TestCase 22: Entrada date-only preservada.
  runTest("22. Entrada date-only preservada", () => {
    const norm = normalizeToDateOnly("1995-12-17");
    assert(norm === "1995-12-17", `Expected 1995-12-17, got ${norm}`);
  });

  // TestCase 23: Resultado idempotente para música já Antiga automática.
  runTest("23. Resultado idempotente para música já Antiga automática", () => {
    const song: Partial<Song> = {
      createdAt: "2010-01-01",
      freshness: { status: 'old', source: 'auto' }
    };
    const res = evaluateSongFreshness(song, "2026-06-12");
    assert(res.shouldUpdate === false, "Already old, shouldUpdate must be false");
    assert(res.reason === "already_old", "Reason must be already_old");
  });

  // TestCase 24: Garantia de que nenhuma função escreve ou muta o objeto recebido.
  runTest("24. Garantia de imutabilidade absolute", () => {
    const song: Partial<Song> = {
      createdAt: "2025-01-05",
      isNew: true,
      freshness: {
        status: 'new',
        source: 'manual',
        manualResetAt: "2025-02-10"
      }
    };
    
    // Deep freeze is applied to the object to guarantee any mutation attempt will throw RuntimeError
    deepFreeze(song);

    try {
      evaluateSongFreshness(song, "2026-06-12");
    } catch (e: any) {
      assert(false, `Mutation occurred: ${e.message}`);
    }
  });

  console.info(`================ ALL ${passedCount}/24 TESTS PASSED SUCCESSFULY ================`);
};

runTests();
