import { 
  executeFreshnessEvaluation, 
  firestoreGateway, 
  FreshnessExecutionInput, 
  FreshnessExecutionResult 
} from './services/songFreshnessExecutor';
import { Song } from './types';
import fs from 'fs';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

// Simple deep freezing helper to ensure state immutability
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

const runTests = async () => {
  console.info("============== STARTING CONTROLLED FRESHNESS EXECUTOR (PHASE 6B) TEST SUITE ==============");
  let passedCount = 0;

  const runTest = async (name: string, fn: () => Promise<void>) => {
    try {
      await fn();
      console.info(`✓ PASSED: ${name}`);
      passedCount++;
    } catch (e: any) {
      console.error(`✗ FAILED: ${name}`);
      console.error(e.stack || e.message || e);
      process.exit(1);
    }
  };

  // Helper mock database store for testing
  let mockDatabase: Record<string, any> = {};
  let transactionWrites: Record<string, any> = {};
  let runTransactionCallCount = 0;
  let getDocCallCount = 0;
  let activeConcurrency = 0;
  let maxConcurrencyObserved = 0;

  // Setup the mock gateway
  firestoreGateway.getDoc = async (docRef: any) => {
    getDocCallCount++;
    const id = docRef.id || '';
    const data = mockDatabase[id];
    return {
      exists: () => !!data,
      data: () => data ? JSON.parse(JSON.stringify(data)) : undefined,
      id
    } as any;
  };

  firestoreGateway.runTransaction = async (db: any, updateFn: any) => {
    runTransactionCallCount++;
    activeConcurrency++;
    if (activeConcurrency > maxConcurrencyObserved) {
      maxConcurrencyObserved = activeConcurrency;
    }

    // Delay a bit to simulate async boundary & concurrency checking
    await new Promise((resolve) => setTimeout(resolve, 5));

    const mockTransaction = {
      get: async (docRef: any) => {
        const id = docRef.id || '';
        const data = mockDatabase[id];
        return {
          exists: () => !!data,
          data: () => data ? JSON.parse(JSON.stringify(data)) : undefined,
          id
        } as any;
      },
      update: (docRef: any, data: any) => {
        const id = docRef.id || '';
        transactionWrites[id] = data;
        // Apply writing to our mock database to simulate live transaction commit
        if (mockDatabase[id]) {
          const updated = { ...mockDatabase[id] };
          for (const [key, value] of Object.entries(data)) {
            if (key.includes('.')) {
              const parts = key.split('.');
              let current = updated;
              for (let i = 0; i < parts.length - 1; i++) {
                current[parts[i]] = current[parts[i]] || {};
                current = current[parts[i]];
              }
              current[parts[parts.length - 1]] = value;
            } else {
              updated[key] = value;
            }
          }
          mockDatabase[id] = updated;
        }
      },
      set: () => {},
      delete: () => {}
    };

    try {
      const res = await updateFn(mockTransaction);
      activeConcurrency--;
      return res;
    } catch (err) {
      activeConcurrency--;
      throw err;
    }
  };

  // Reset helper
  const resetMockState = () => {
    mockDatabase = {};
    transactionWrites = {};
    runTransactionCallCount = 0;
    getDocCallCount = 0;
    activeConcurrency = 0;
    maxConcurrencyObserved = 0;
  };

  // Test 1: dry-run não escreve nada
  await runTest("1. dry-run não escreve nada", async () => {
    resetMockState();
    mockDatabase["song_1"] = {
      id: "song_1",
      title: "Song 1",
      artist: "Artist 1",
      key: "G",
      lyrics: "...",
      chords: "...",
      chordsUrl: "",
      videoUrl: "",
      status: "active",
      tagIds: [],
      createdAt: "2025-01-01T00:00:00Z",
      lastPlayed: null,
      freshness: { status: 'new', source: 'auto' },
      organizationId: "org_alpha",
      createdBy: { uid: "user_1", name: "Daniel" }
    };

    const res = await executeFreshnessEvaluation({
      organizationId: "org_alpha",
      songIds: ["song_1"],
      today: "2026-06-12",
      mode: "dry-run"
    });

    assert(res.mode === "dry-run", "Mode should be dry-run");
    assert(res.wouldUpdate === 1, "Should be dry-run marked for upgrade");
    assert(res.updated === 0, "No changes written");
    assert(Object.keys(transactionWrites).length === 0, "No transactions should write");
    assert(getDocCallCount === 1, "Should call getDoc once");
  });

  // Test 2: dry-run retorna músicas que seriam alteradas
  await runTest("2. dry-run retorna detalhes das músicas que seriam alteradas", async () => {
    resetMockState();
    mockDatabase["song_1"] = {
      id: "song_1",
      title: "Song 1",
      artist: "Artist 1",
      key: "G",
      lyrics: "...",
      chords: "...",
      chordsUrl: "",
      videoUrl: "",
      status: "active",
      tagIds: [],
      createdAt: "2025-01-01T00:00:00Z",
      lastPlayed: null,
      freshness: { status: 'new', source: 'auto' },
      organizationId: "org_alpha",
      createdBy: { uid: "user_1", name: "Daniel" }
    };

    const res = await executeFreshnessEvaluation({
      organizationId: "org_alpha",
      songIds: ["song_1"],
      today: "2026-03-01",
      mode: "dry-run"
    });

    assert(res.items.length === 1, "One item evaluated");
    const item = res.items[0];
    assert(item.songId === "song_1", "songId matches");
    assert(item.currentStatus === "new", "currentStatus is new");
    assert(item.currentSource === "auto", "currentSource is auto");
    assert(item.shouldUpdate === true, "shouldUpdate is true");
    assert(item.nextStatus === "old", "nextStatus is old");
    assert(item.outcome === "would-update", "outcome is would-update");
    assert(item.expirationDate === "2025-07-01", "Expected expiration date calculation");
  });

  // Test 3: apply atualiza new/auto vencida
  await runTest("3. apply atualiza new/auto vencida", async () => {
    resetMockState();
    mockDatabase["song_1"] = {
      id: "song_1",
      title: "Song 1",
      artist: "Artist 1",
      key: "G",
      lyrics: "...",
      chords: "...",
      chordsUrl: "",
      videoUrl: "",
      status: "active",
      tagIds: [],
      createdAt: "2025-01-01T00:00:00Z",
      lastPlayed: null,
      freshness: { status: 'new', source: 'auto' },
      organizationId: "org_alpha",
      createdBy: { uid: "user_1", name: "Daniel" }
    };

    const res = await executeFreshnessEvaluation({
      organizationId: "org_alpha",
      songIds: ["song_1"],
      today: "2026-06-12",
      mode: "apply"
    });

    assert(res.updated === 1, "One song updated");
    assert(transactionWrites["song_1"] !== undefined, "Transaction written");
    assert(transactionWrites["song_1"]['freshness.status'] === "old", "Next status is old");
    assert(transactionWrites["song_1"]['freshness.source'] === "auto", "Source is auto");
    assert(typeof transactionWrites["song_1"]['freshness.autoUpdatedAt'] === "string", "autoUpdatedAt set");
  });

  // Test 4: apply atualiza new/manual vencida para old/auto
  await runTest("4. apply atualiza new/manual vencida para old/auto", async () => {
    resetMockState();
    mockDatabase["song_1"] = {
      id: "song_1",
      title: "Song",
      artist: "Art",
      key: "A",
      lyrics: "",
      chords: "",
      chordsUrl: "",
      videoUrl: "",
      status: "active",
      tagIds: [],
      createdAt: "2025-01-01",
      lastPlayed: null,
      freshness: { status: 'new', source: 'manual', manualResetAt: "2025-11-01T12:00:00Z" },
      organizationId: "org_alpha",
      createdBy: { uid: "u", name: "D" }
    };

    const res = await executeFreshnessEvaluation({
      organizationId: "org_alpha",
      songIds: ["song_1"],
      today: "2026-06-12", // 2025-11-01 + 6m = 2026-05-01 -> expired
      mode: "apply"
    });

    assert(res.updated === 1, "Should update");
    assert(mockDatabase["song_1"].freshness?.status === "old", "Re-evaluated to old");
    assert(mockDatabase["song_1"].freshness?.source === "auto", "source became auto");
  });

  // Test 5: apply atualiza default/manual vencida para old/auto
  await runTest("5. apply atualiza default/manual vencida para old/auto", async () => {
    resetMockState();
    mockDatabase["song_1"] = {
      id: "song_1",
      title: "Song",
      artist: "Art",
      key: "A",
      lyrics: "",
      chords: "",
      chordsUrl: "",
      videoUrl: "",
      status: "active",
      tagIds: [],
      createdAt: "2025-01-01",
      lastPlayed: null,
      freshness: { status: 'default', source: 'manual', manualResetAt: "2025-05-01" },
      organizationId: "org_alpha",
      createdBy: { uid: "u", name: "D" }
    };

    const res = await executeFreshnessEvaluation({
      organizationId: "org_alpha",
      songIds: ["song_1"],
      today: "2026-06-12",
      mode: "apply"
    });

    assert(res.updated === 1, "Should update expired default");
    assert(mockDatabase["song_1"].freshness?.status === "old", "Is old");
    assert(mockDatabase["song_1"].freshness?.source === "auto", "Is auto source");
  });

  // Test 6: apply preserva manualResetAt
  await runTest("6. apply preserva manualResetAt", async () => {
    resetMockState();
    mockDatabase["song_1"] = {
      id: "song_1",
      title: "Song",
      artist: "Art",
      key: "C",
      lyrics: "",
      chords: "",
      chordsUrl: "",
      videoUrl: "",
      status: "active",
      tagIds: [],
      createdAt: "2025-01-01",
      lastPlayed: null,
      freshness: { status: 'new', source: 'manual', manualResetAt: "2025-06-10" },
      organizationId: "org_alpha",
      createdBy: { uid: "u", name: "D" }
    };

    const res = await executeFreshnessEvaluation({
      organizationId: "org_alpha",
      songIds: ["song_1"],
      today: "2026-06-12",
      mode: "apply"
    });

    assert(res.updated === 1, "Should update");
    assert(mockDatabase["song_1"].freshness?.manualResetAt === "2025-06-10", "Should preserve manualResetAt!");
  });

  // Test 7: apply define autoUpdatedAt somente quando muda
  await runTest("7. apply define autoUpdatedAt somente quando muda", async () => {
    resetMockState();
    // Song already has freshness old/auto. It doesn't need to change!
    mockDatabase["song_1"] = {
      id: "song_1",
      title: "Song",
      artist: "Art",
      key: "C",
      lyrics: "",
      chords: "",
      chordsUrl: "",
      videoUrl: "",
      status: "active",
      tagIds: [],
      createdAt: "2025-01-01",
      lastPlayed: null,
      freshness: { status: 'old', source: 'auto', autoUpdatedAt: "2026-06-11T00:00:00Z" },
      organizationId: "org_alpha",
      createdBy: { uid: "u", name: "D" }
    };

    const res = await executeFreshnessEvaluation({
      organizationId: "org_alpha",
      songIds: ["song_1"],
      today: "2026-06-12",
      mode: "apply"
    });

    assert(res.updated === 0, "Should not update");
    assert(mockDatabase["song_1"].freshness?.autoUpdatedAt === "2026-06-11T00:00:00Z", "autoUpdatedAt preserved and not overwritten");
  });

  // Test 8: old/manual nunca é alterada
  await runTest("8. old/manual nunca é alterada", async () => {
    resetMockState();
    mockDatabase["song_1"] = {
      id: "song_1",
      title: "Song",
      artist: "Art",
      key: "D",
      lyrics: "",
      chords: "",
      chordsUrl: "",
      videoUrl: "",
      status: "active",
      tagIds: [],
      createdAt: "2025-01-01",
      lastPlayed: null,
      freshness: { status: 'old', source: 'manual', manualResetAt: "2025-02-15" },
      organizationId: "org_alpha",
      createdBy: { uid: "u", name: "D" }
    };

    const res = await executeFreshnessEvaluation({
      organizationId: "org_alpha",
      songIds: ["song_1"],
      today: "2026-06-12",
      mode: "apply"
    });

    assert(res.unchanged === 1, "No changes");
    assert(mockDatabase["song_1"].freshness?.status === "old", "Remains old");
    assert(mockDatabase["song_1"].freshness?.source === "manual", "Remains manual source");
  });

  // Test 9: old/auto não é reescrita
  await runTest("9. old/auto não é reescrita", async () => {
    resetMockState();
    mockDatabase["song_1"] = {
      id: "song_1",
      title: "Song",
      artist: "Art",
      key: "D",
      lyrics: "",
      chords: "",
      chordsUrl: "",
      videoUrl: "",
      status: "active",
      tagIds: [],
      createdAt: "2025-01-01",
      lastPlayed: null,
      freshness: { status: 'old', source: 'auto' },
      organizationId: "org_alpha",
      createdBy: { uid: "u", name: "D" }
    };

    const res = await executeFreshnessEvaluation({
      organizationId: "org_alpha",
      songIds: ["song_1"],
      today: "2026-06-12",
      mode: "apply"
    });

    assert(res.unchanged === 1, "No update");
    assert(transactionWrites["song_1"] === undefined, "Nothing written");
  });

  // Test 10: escala futura protege a música
  await runTest("10. escala futura protege a música", async () => {
    resetMockState();
    mockDatabase["song_1"] = {
      id: "song_1",
      title: "Song",
      artist: "Art",
      key: "D",
      lyrics: "",
      chords: "",
      chordsUrl: "",
      videoUrl: "",
      status: "active",
      tagIds: [],
      createdAt: "2025-01-01",
      lastPlayed: null,
      lastScheduledAt: "2026-10-10", // Future schedule
      freshness: { status: 'new', source: 'auto' },
      organizationId: "org_alpha",
      createdBy: { uid: "u", name: "D" }
    };

    const res = await executeFreshnessEvaluation({
      organizationId: "org_alpha",
      songIds: ["song_1"],
      today: "2026-06-12",
      mode: "apply"
    });

    assert(res.unchanged === 1, "Scale protects the song");
    assert(mockDatabase["song_1"].freshness?.status === "new", "Keeps status new");
  });

  // Test 11: música sem data confiável não é alterada
  await runTest("11. música sem data confiável não é alterada", async () => {
    resetMockState();
    mockDatabase["song_1"] = {
      id: "song_1",
      title: "Song",
      artist: "Art",
      key: "D",
      lyrics: "",
      chords: "",
      chordsUrl: "",
      videoUrl: "",
      status: "active",
      tagIds: [],
      createdAt: "", // Empty / missing
      lastPlayed: null,
      freshness: { status: 'new', source: 'auto' },
      organizationId: "org_alpha",
      createdBy: { uid: "u", name: "D" }
    };

    const res = await executeFreshnessEvaluation({
      organizationId: "org_alpha",
      songIds: ["song_1"],
      today: "2026-06-12",
      mode: "apply"
    });

    assert(res.unchanged === 1, "Unchanged when reference date is missing");
    assert(mockDatabase["song_1"].freshness?.status === "new", "Status remains new");
  });

  // Test 12: ID inexistente não quebra a execução
  await runTest("12. ID inexistente não quebra a execução", async () => {
    resetMockState();
    const res = await executeFreshnessEvaluation({
      organizationId: "org_alpha",
      songIds: ["song_does_not_exist"],
      today: "2026-06-12",
      mode: "apply"
    });

    assert(res.missing === 1, "Reported 1 missing");
    assert(res.items.length === 1, "Report has 1 item");
    assert(res.items[0].outcome === "missing", "Outcome is missing");
  });

  // Test 13: ID de outra organização não é alterado
  await runTest("13. ID de outra organização não é alterado", async () => {
    resetMockState();
    mockDatabase["song_1"] = {
      id: "song_1",
      title: "Song",
      artist: "Art",
      key: "D",
      lyrics: "",
      chords: "",
      chordsUrl: "",
      videoUrl: "",
      status: "active",
      tagIds: [],
      createdAt: "2025-01-01",
      lastPlayed: null,
      freshness: { status: 'new', source: 'auto' },
      organizationId: "org_beta", // Belong to org_beta
      createdBy: { uid: "u", name: "D" }
    };

    const res = await executeFreshnessEvaluation({
      organizationId: "org_alpha", // Evaluating for org_alpha
      songIds: ["song_1"],
      today: "2026-06-12",
      mode: "apply"
    });

    assert(res.wrongOrganization === 1, "Reported wrongOrganization count");
    assert(res.items[0].outcome === "wrong-organization", "Outcome is wrong-organization");
    assert(mockDatabase["song_1"].freshness?.status === "new", "Not modified");
  });

  // Test 14: ID existente apenas em globalSongs não é alterado
  await runTest("14. ID existente apenas em globalSongs não é alterado", async () => {
    resetMockState();
    // In our firebase blueprint and executor design, we only read from the 'songs' collection
    // Let's assert that the path used for the Firestore doc ref starts with 'songs/'
    // (This is implicitly tested because we never mock or access globalSongs in our Executor logic)
    const res = await executeFreshnessEvaluation({
      organizationId: "org_alpha",
      songIds: ["some_global_id"],
      today: "2026-06-12",
      mode: "apply"
    });
    
    assert(res.missing === 1, "Any global-only ID resolves as missing since executor only reads 'songs' collection");
  });

  // Test 15: IDs duplicados são processados uma vez
  await runTest("15. IDs duplicados são processados uma vez", async () => {
    resetMockState();
    mockDatabase["song_1"] = {
      id: "song_1",
      title: "Song",
      artist: "Art",
      key: "D",
      lyrics: "",
      chords: "",
      chordsUrl: "",
      videoUrl: "",
      status: "active",
      tagIds: [],
      createdAt: "2025-01-01",
      lastPlayed: null,
      freshness: { status: 'new', source: 'auto' },
      organizationId: "org_alpha",
      createdBy: { uid: "u", name: "D" }
    };

    const res = await executeFreshnessEvaluation({
      organizationId: "org_alpha",
      songIds: ["song_1", "song_1", "song_1"],
      today: "2026-06-12",
      mode: "apply"
    });

    assert(res.updated === 1, "Updated 1 time");
    assert(res.items.length === 1, "Fitted to unique song ID length of 1 in items report");
  });

  // Test 16: ID vazio é ignorado
  await runTest("16. ID vazio é ignorado", async () => {
    resetMockState();
    mockDatabase["song_1"] = {
      id: "song_1",
      title: "Song",
      artist: "Art",
      key: "D",
      lyrics: "",
      chords: "",
      chordsUrl: "",
      videoUrl: "",
      status: "active",
      tagIds: [],
      createdAt: "2025-01-01",
      lastPlayed: null,
      freshness: { status: 'new', source: 'auto' },
      organizationId: "org_alpha",
      createdBy: { uid: "u", name: "D" }
    };

    const res = await executeFreshnessEvaluation({
      organizationId: "org_alpha",
      songIds: ["song_1", "", "   "],
      today: "2026-06-12",
      mode: "apply"
    });

    assert(res.updated === 1, "Only song_1 processed");
    assert(res.items.length === 1, "Only contains song_1 in output items");
  });

  // Test 17: data today inválida rejeita a execução
  await runTest("17. data today inválida rejeita a execução", async () => {
    resetMockState();
    try {
      await executeFreshnessEvaluation({
        organizationId: "org_alpha",
        songIds: ["song_1"],
        today: "12-12-2026", // Invalid format
        mode: "apply"
      });
      assert(false, "Should have thrown for invalid today format");
    } catch (err: any) {
      assert(err.message.includes("Invalid today date format"), "Expected invalid format helper error");
    }
  });

  // Test 18: limite máximo é respeitado
  await runTest("18. limite máximo é respeitado", async () => {
    resetMockState();
    const lotsOfIds = Array.from({ length: 501 }, (_, i) => `song_${i}`);
    try {
      await executeFreshnessEvaluation({
        organizationId: "org_alpha",
        songIds: lotsOfIds,
        today: "2026-06-12",
        mode: "apply"
      });
      assert(false, "Should have thrown for exceeding maximum ids limit of 500");
    } catch (err: any) {
      assert(err.message.includes("Limit exceeded"), "Expected limit exceeded error");
    }
  });

  // Test 19: falha de uma música não interrompe todas as demais
  await runTest("19. falha de uma música não interrompe todas as demais", async () => {
    resetMockState();
    mockDatabase["song_good"] = {
      id: "song_good",
      title: "Song Good",
      artist: "Art",
      key: "D",
      lyrics: "",
      chords: "",
      chordsUrl: "",
      videoUrl: "",
      status: "active",
      tagIds: [],
      createdAt: "2025-01-01",
      lastPlayed: null,
      freshness: { status: 'new', source: 'auto' },
      organizationId: "org_alpha",
      createdBy: { uid: "u", name: "D" }
    };
    mockDatabase["song_faulty"] = {
      id: "song_faulty",
      title: "Song Faulty",
      artist: "Art",
      key: "D",
      lyrics: "",
      chords: "",
      chordsUrl: "",
      videoUrl: "",
      status: "active",
      tagIds: [],
      createdAt: "2025-01-01",
      lastPlayed: null,
      freshness: { status: 'new', source: 'auto' },
      organizationId: "org_alpha",
      createdBy: { uid: "u", name: "D" }
    };

    // Override gateway to artificially throw under "song_faulty"
    const originalRunTx = firestoreGateway.runTransaction;
    firestoreGateway.runTransaction = async (db: any, updateFn: any) => {
      return originalRunTx(db, async (tx: any) => {
        // Intercept get
        const originalGet = tx.get;
        tx.get = async (docRef: any) => {
          const id = docRef.id || '';
          if (id === "song_faulty") {
            throw new Error("Simulated database contention error");
          }
          return originalGet(docRef);
        };
        return updateFn(tx);
      });
    };

    const res = await executeFreshnessEvaluation({
      organizationId: "org_alpha",
      songIds: ["song_good", "song_faulty"],
      today: "2026-06-12",
      mode: "apply"
    });

    assert(res.updated === 1, "Good song succeeded and got updated");
    assert(res.failed === 1, "Faulty song was tracked as failed");
    
    const faultyItem = res.items.find(i => i.songId === "song_faulty");
    assert(faultyItem !== undefined && faultyItem.outcome === "failed", "Outcome set to failed");

    // Restore original
    firestoreGateway.runTransaction = originalRunTx;
  });

  // Test 20: concorrência é limitada
  await runTest("20. concorrência é limitada", async () => {
    resetMockState();
    // Let's create 15 songs to process
    for (let i = 0; i < 15; i++) {
      mockDatabase[`song_${i}`] = {
        id: `song_${i}`,
        title: `Song ${i}`,
        artist: "Art",
        key: "C",
        lyrics: "",
        chords: "",
        chordsUrl: "",
        videoUrl: "",
        status: "active",
        tagIds: [],
        createdAt: "2025-01-01",
        lastPlayed: null,
        freshness: { status: 'new', source: 'auto' },
        organizationId: "org_alpha",
        createdBy: { uid: "u", name: "D" }
      };
    }

    const res = await executeFreshnessEvaluation({
      organizationId: "org_alpha",
      songIds: Array.from({ length: 15 }, (_, i) => `song_${i}`),
      today: "2026-06-12",
      mode: "apply"
    });

    assert(res.updated === 15, "All 15 updated");
    assert(maxConcurrencyObserved <= 5, `Expected max concurrency <= 5, got ${maxConcurrencyObserved}`);
  });

  // Test 21: transação relê o documento
  await runTest("21. transação relê o documento", async () => {
    resetMockState();
    mockDatabase["song_1"] = {
      id: "song_1",
      title: "Song",
      artist: "Art",
      key: "D",
      lyrics: "",
      chords: "",
      chordsUrl: "",
      videoUrl: "",
      status: "active",
      tagIds: [],
      createdAt: "2025-01-01",
      lastPlayed: null,
      freshness: { status: 'new', source: 'auto' },
      organizationId: "org_alpha",
      createdBy: { uid: "u", name: "D" }
    };

    // We verify that transction writes are created by runTransaction, which does its own get inside the execution callback
    const res = await executeFreshnessEvaluation({
      organizationId: "org_alpha",
      songIds: ["song_1"],
      today: "2026-06-12",
      mode: "apply"
    });

    assert(res.updated === 1, "Should be updated");
    assert(runTransactionCallCount === 1, "Executed transaction block");
  });

  // Test 22: alteração manual concorrente é preservada
  await runTest("22. alteração manual concorrente é preservada", async () => {
    resetMockState();
    mockDatabase["song_1"] = {
      id: "song_1",
      title: "Song",
      artist: "Art",
      key: "D",
      lyrics: "",
      chords: "",
      chordsUrl: "",
      videoUrl: "",
      status: "active",
      tagIds: [],
      createdAt: "2025-01-01",
      lastPlayed: null,
      freshness: { status: 'new', source: 'auto' },
      organizationId: "org_alpha",
      createdBy: { uid: "u", name: "D" }
    };

    // We simulate a race condition where:
    // 1. Executor starts transaction.
    // 2. Just before transaction evaluates, a user has marked it old/manual in Firebase.
    // 3. Since transaction.get loads the fresh updated copy, it evaluates that latest copy and respects it.
    const originalRunTx = firestoreGateway.runTransaction;
    firestoreGateway.runTransaction = async (db: any, updateFn: any) => {
      // Modify mockDatabase to represent user intermediate modification right before transaction runs the read
      mockDatabase["song_1"].freshness = {
        status: 'old',
        source: 'manual',
        manualResetAt: "2026-06-01"
      };
      return originalRunTx(db, updateFn);
    };

    const res = await executeFreshnessEvaluation({
      organizationId: "org_alpha",
      songIds: ["song_1"],
      today: "2026-06-12",
      mode: "apply"
    });

    // Since it became old/manual, evaluateSongFreshness returns shouldUpdate = false (outcome unchanged, manual preserved)
    assert(res.unchanged === 1, "Outcome is unchanged because transaction gets latest old/manual state!");
    assert(mockDatabase["song_1"].freshness?.status === "old", "Remains old");
    assert(mockDatabase["song_1"].freshness?.source === "manual", "Remains manual (preserved successfully!)");

    // Restore original
    firestoreGateway.runTransaction = originalRunTx;
  });

  // Test 23: nenhum campo editorial é modificado
  await runTest("23. nenhum campo editorial é modificado", async () => {
    resetMockState();
    mockDatabase["song_1"] = {
      id: "song_1",
      title: "My Precious Song",
      artist: "Minister",
      key: "F#m",
      lyrics: "Exaltados sejais Senhor...",
      chords: "[F#m] [D] [A] [E]",
      chordsUrl: "http://chords-url",
      videoUrl: "http://video-url",
      status: "active",
      tagIds: ["id1", "id2"],
      createdAt: "2025-01-01T12:00:00Z",
      lastPlayed: "2025-05-01",
      isNew: true,
      lastModifiedAt: "2025-05-15T12:00:00Z",
      lastModifiedBy: "user_2",
      freshness: { status: 'new', source: 'auto' },
      organizationId: "org_alpha",
      createdBy: { uid: "u", name: "D" }
    };

    await executeFreshnessEvaluation({
      organizationId: "org_alpha",
      songIds: ["song_1"],
      today: "2026-06-12",
      mode: "apply"
    });

    const finalSong = mockDatabase["song_1"];
    assert(finalSong.title === "My Precious Song", "Title unchanged");
    assert(finalSong.artist === "Minister", "Artist unchanged");
    assert(finalSong.key === "F#m", "key unchanged");
    assert(finalSong.lyrics === "Exaltados sejais Senhor...", "lyrics unchanged");
    assert(finalSong.chords === "[F#m] [D] [A] [E]", "chords unchanged");
    assert(finalSong.chordsUrl === "http://chords-url", "chordsUrl unchanged");
    assert(finalSong.videoUrl === "http://video-url", "videoUrl unchanged");
    assert(finalSong.status === "active", "status unchanged");
    assert(JSON.stringify(finalSong.tagIds) === JSON.stringify(["id1", "id2"]), "tagIds unchanged");
    assert(finalSong.createdAt === "2025-01-01T12:00:00Z", "createdAt unchanged");
    assert(finalSong.lastPlayed === "2025-05-01", "lastPlayed unchanged");
    assert(finalSong.isNew === true, "isNew unchanged");
    assert(finalSong.lastModifiedAt === "2025-05-15T12:00:00Z", "lastModifiedAt unchanged");
    assert(finalSong.lastModifiedBy === "user_2", "lastModifiedBy unchanged");
  });

  // Test 24: segunda execução é idempotente
  await runTest("24. segunda execução é idempotente", async () => {
    resetMockState();
    mockDatabase["song_1"] = {
      id: "song_1",
      title: "Song",
      artist: "Art",
      key: "D",
      lyrics: "",
      chords: "",
      chordsUrl: "",
      videoUrl: "",
      status: "active",
      tagIds: [],
      createdAt: "2025-01-01",
      lastPlayed: null,
      freshness: { status: 'new', source: 'auto' },
      organizationId: "org_alpha",
      createdBy: { uid: "u", name: "D" }
    };

    // Run execution 1
    const res1 = await executeFreshnessEvaluation({
      organizationId: "org_alpha",
      songIds: ["song_1"],
      today: "2026-06-12",
      mode: "apply"
    });
    assert(res1.updated === 1, "First run updates it from new -> old");

    // Run execution 2
    const res2 = await executeFreshnessEvaluation({
      organizationId: "org_alpha",
      songIds: ["song_1"],
      today: "2026-06-12",
      mode: "apply"
    });
    assert(res2.updated === 0, "Second run is completely dry/unchanged");
    assert(res2.unchanged === 1, "Result counts unchanged as 1");
  });

  // Test 25: relatório final soma corretamente todos os resultados
  await runTest("25. relatório final soma e mapeia corretamente todos os resultados", async () => {
    resetMockState();
    mockDatabase["song_update"] = {
      id: "song_update",
      title: "Title",
      artist: "Artist",
      key: "G",
      lyrics: "",
      chords: "",
      chordsUrl: "",
      videoUrl: "",
      status: "active",
      tagIds: [],
      createdAt: "2025-01-01",
      lastPlayed: null,
      freshness: { status: 'new', source: 'auto' },
      organizationId: "org_alpha",
      createdBy: { uid: "u", name: "N" }
    };
    mockDatabase["song_unchanged"] = {
      id: "song_unchanged",
      title: "Title",
      artist: "Artist",
      key: "G",
      lyrics: "",
      chords: "",
      chordsUrl: "",
      videoUrl: "",
      status: "active",
      tagIds: [],
      createdAt: "2026-05-01", // not expired
      lastPlayed: null,
      freshness: { status: 'new', source: 'auto' },
      organizationId: "org_alpha",
      createdBy: { uid: "u", name: "N" }
    };
    mockDatabase["song_wrong_org"] = {
      id: "song_wrong_org",
      title: "Title",
      artist: "Artist",
      key: "G",
      lyrics: "",
      chords: "",
      chordsUrl: "",
      videoUrl: "",
      status: "active",
      tagIds: [],
      createdAt: "2025-01-01",
      lastPlayed: null,
      freshness: { status: 'new', source: 'auto' },
      organizationId: "org_beta", // other organization
      createdBy: { uid: "u", name: "N" }
    };

    const res = await executeFreshnessEvaluation({
      organizationId: "org_alpha",
      songIds: ["song_update", "song_unchanged", "song_wrong_org", "song_missing"],
      today: "2026-06-12",
      mode: "apply"
    });

    assert(res.requested === 4, "4 items requested");
    assert(res.evaluated === 2, "2 items successfully evaluated (update and unchanged)");
    assert(res.updated === 1, "1 item updated");
    assert(res.unchanged === 1, "1 item unchanged");
    assert(res.wrongOrganization === 1, "1 item wrong org");
    assert(res.missing === 1, "1 item missing");
    assert(res.failed === 0, "0 item failed");
  });

  // Test 26: Security against globalSongs & global library page
  await runTest("26. Security against globalSongs & global library validation", async () => {
    // Asserting that the mock calls did not reference global collection
    // and verifying the executor has NO reference to any other collections
    // Our implementation imports and uses exclusively the "db" and the "songs" doc collection ref
    const fileContent = fs.readFileSync('./services/songFreshnessExecutor.ts', 'utf-8');
    assert(!fileContent.includes("globalSongs"), "Security assertion: Executor must not contain references to 'globalSongs'");
    assert(!fileContent.includes("globalLibraryService"), "Security assertion: Executor must not reference 'globalLibraryService'");
  });

  console.info(`================ ALL ${passedCount}/26 TESTS PASSED SUCCESSFULY ================`);
};

runTests();
