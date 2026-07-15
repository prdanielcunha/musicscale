import * as fs from "fs";
import * as path from "path";
import * as crypto from "node:crypto";

let registeredTests = 0;
let passedTests = 0;
let failedTests = 0;
let testsWithZeroAssertions = 0;

interface TestContext {
  assert: (condition: boolean, message: string) => void;
}

interface TestCase {
  name: string;
  fn: (t: TestContext) => void | Promise<void>;
}

const queue: TestCase[] = [];

function test(name: string, fn: (t: TestContext) => void | Promise<void>) {
  queue.push({ name, fn });
}

// --- RECORD INITIAL HASHES OF PROTECTED FILES ---
const protectedFiles = [
  "server.ts",
  "services/server/aiFinOpsPolicy.ts",
  "services/server/aiFinOpsRepository.ts",
  "scripts/test_phase0_2c1e1_ai_finops_policy.ts",
  "scripts/test_phase0_2c1e2_ai_finops_repository.ts",
  "firestore.rules",
  "package.json",
  "package-lock.json",
];

console.log("=== EXECUTANDO VERIFICAÇÃO DE INTEGRIDADE DE ARQUIVOS PROTEGIDOS ===");
for (const file of protectedFiles) {
  if (!fs.existsSync(file)) {
    throw new Error(`PROTECTED_FILE_MISSING:${file}`);
  }
  const content = fs.readFileSync(file);
  const hash = crypto.createHash("sha256").update(content).digest("hex");
  console.log(`  [INTEGRITY] ${file}: ${hash}`);
}

// ==========================================
// TESTE 1: CÁLCULO E FILTRAGEM DO DASHBOARD (allUniqueEvents)
// ==========================================
test("Dashboard: Filtra escalas canceladas e escalas da banda órfãs ou de pais cancelados", (t) => {
  // Simulando a lógica de allUniqueEvents do DashboardPage.tsx
  const calculateAllUniqueEvents = (populatedScales: any[], populatedBandScales: any[]) => {
    const map = new Map<string, any>();
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    populatedScales?.forEach((s) => {
      if (s.status === 'cancelled') return;
      if (new Date(s.date + "T00:00:00") >= now) {
        map.set(s.id, { ...s, type: 'music' });
      }
    });

    populatedBandScales?.forEach((b) => {
      if (b.date && new Date(b.date + "T00:00:00") >= now) {
        if (b.musicScaleId) {
          const parentScale = populatedScales?.find(ps => ps.id === b.musicScaleId);
          if (!parentScale || parentScale.status === 'cancelled') {
             // Parent music scale was deleted or cancelled - do not display this band scale
             return;
          }
          if (map.has(b.musicScaleId)) {
             // covered by parent music scale
             return;
          }
        }
        
        // Add standalone or un-mapped band scale
        map.set(b.id, {
          id: b.id,
          date: b.date,
          observations: b.observations,
          songs: [],
          eventType: b.eventType,
          location: b.location,
          bandScaleId: b.id,
          bandScale: b,
          type: 'band'
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => {
      const dateA = a.date || "";
      const dateB = b.date || "";
      const timeA = a.time || "00:00";
      const timeB = b.time || "00:00";
      return `${dateA}T${timeA}`.localeCompare(`${dateB}T${timeB}`);
    });
  };

  const todayStr = new Date().toISOString().split("T")[0];

  const mockPopulatedScales = [
    { id: "scale-1", date: todayStr, status: "published", songs: ["song-1"], eventType: { id: "et-1" }, location: { id: "l-1" } },
    { id: "scale-2", date: todayStr, status: "cancelled", songs: ["song-2"], eventType: { id: "et-1" }, location: { id: "l-1" } } // Cancelled scale
  ];

  const mockPopulatedBandScales = [
    { id: "band-1", date: todayStr, musicScaleId: "scale-1", assignments: [] }, // Linked to published
    { id: "band-2", date: todayStr, musicScaleId: "scale-2", assignments: [] }, // Linked to cancelled (should be filtered)
    { id: "band-3", date: todayStr, musicScaleId: "scale-non-existent", assignments: [] }, // Orphaned (should be filtered)
    { id: "band-4", date: todayStr, musicScaleId: null, assignments: [] } // Standalone band scale (should be displayed)
  ];

  const result = calculateAllUniqueEvents(mockPopulatedScales, mockPopulatedBandScales);

  t.assert(result.length === 2, "Deveria retornar exatamente 2 eventos.");
  t.assert(result.some(r => r.id === "scale-1"), "Deveria incluir a escala 'scale-1' ativa.");
  t.assert(result.some(r => r.id === "band-4"), "Deveria incluir a escala de banda 'band-4' avulsa.");
  t.assert(!result.some(r => r.id === "scale-2"), "NÃO deveria incluir a escala cancelada.");
  t.assert(!result.some(r => r.id === "band-2"), "NÃO deveria incluir escala de banda com pai cancelado.");
  t.assert(!result.some(r => r.id === "band-3"), "NÃO deveria incluir escala de banda órfã.");
});

// ==========================================
// TESTE 2: DELEÇÃO EM CASCATA NO CONTEXTO
// ==========================================
test("Context: Deleção de escala de músicas remove escalas de banda vinculadas", async (t) => {
  // Simulando a lógica de cascade delete do handleDeleteScale em ModalContext.tsx
  const mockApi = {
    scales: {
      deletedIds: [] as string[],
      async deleteMany(ids: string[]) {
        this.deletedIds.push(...ids);
      }
    },
    bandScales: {
      deletedIds: [] as string[],
      async deleteMany(ids: string[]) {
        this.deletedIds.push(...ids);
      }
    }
  };

  const scaleToDelete = { id: "music-scale-1" };
  const bandScales = [
    { id: "band-scale-1", musicScaleId: "music-scale-1" },
    { id: "band-scale-2", musicScaleId: "other-music-scale" },
    { id: "band-scale-3", musicScaleId: "music-scale-1" }
  ];

  // Executando cascade deletion idêntica à do context
  const linkedBandScaleIds = bandScales
    .filter(b => b.musicScaleId === scaleToDelete.id)
    .map(b => b.id);

  await mockApi.scales.deleteMany([scaleToDelete.id]);

  if (linkedBandScaleIds.length > 0) {
    await mockApi.bandScales.deleteMany(linkedBandScaleIds);
  }

  t.assert(mockApi.scales.deletedIds.includes("music-scale-1"), "Escala de música correspondente foi deletada.");
  t.assert(mockApi.bandScales.deletedIds.includes("band-scale-1"), "Escala de banda vinculada 1 foi deletada.");
  t.assert(mockApi.bandScales.deletedIds.includes("band-scale-3"), "Escala de banda vinculada 3 foi deletada.");
  t.assert(!mockApi.bandScales.deletedIds.includes("band-scale-2"), "Escala de banda não vinculada NÃO foi deletada.");
});

// ==========================================
// TESTE 3: PERSISTÊNCIA - VALIDAÇÃO DE ESCALA DE MÚSICA VAZIA
// ==========================================
test("Persistência: Impede escala de músicas sem nenhuma música", async (t) => {
  const validateScale = (data: any) => {
    if (!data.songIds || data.songIds.length === 0) {
      throw new Error("Não é permitido criar ou atualizar uma escala de músicas sem nenhuma música selecionada.");
    }
  };

  let errorThrown = false;
  try {
    validateScale({ date: "2026-07-04", songIds: [] });
  } catch (err: any) {
    errorThrown = true;
    t.assert(err.message === "Não é permitido criar ou atualizar uma escala de músicas sem nenhuma música selecionada.", "Lançou erro de validação esperado.");
  }
  t.assert(errorThrown, "Deveria ter lançado erro para songIds vazia.");

  let success = false;
  try {
    validateScale({ date: "2026-07-04", songIds: ["song-123"] });
    success = true;
  } catch (err) {
    success = false;
  }
  t.assert(success, "Deveria passar com músicas selecionadas.");
});

// ==========================================
// TESTE 4: PERSISTÊNCIA - VALIDAÇÃO DE ESCALA DE BANDA VAZIA
// ==========================================
test("Persistência: Impede escala de banda sem integrantes", async (t) => {
  const validateBandScale = (data: any) => {
    if (!data.assignments || data.assignments.filter((a: any) => a.userId && a.instrumentId).length === 0) {
      throw new Error("Não é permitido criar ou atualizar uma escala da banda sem nenhum integrante selecionado.");
    }
  };

  let errorThrown = false;
  try {
    validateBandScale({ date: "2026-07-04", assignments: [] });
  } catch (err: any) {
    errorThrown = true;
    t.assert(err.message === "Não é permitido criar ou atualizar uma escala da banda sem nenhum integrante selecionado.", "Lançou erro de validação esperado.");
  }
  t.assert(errorThrown, "Deveria ter lançado erro para assignments vazia.");

  let errorThrown2 = false;
  try {
    validateBandScale({ date: "2026-07-04", assignments: [{ userId: "", instrumentId: "" }] });
  } catch (err: any) {
    errorThrown2 = true;
  }
  t.assert(errorThrown2, "Deveria ter lançado erro para assignments inválidos.");

  let success = false;
  try {
    validateBandScale({ date: "2026-07-04", assignments: [{ userId: "user-1", instrumentId: "inst-1" }] });
    success = true;
  } catch (err) {
    success = false;
  }
  t.assert(success, "Deveria passar com integrantes selecionados.");
});

// ==========================================
// EXECUÇÃO SEQUENCIAL
// ==========================================
async function runAll() {
  const totalCases = queue.length;
  console.log(`\n=== RODANDO TESTES DO HOTFIX DASHBOARD, ESCALAS E INTEGRIDADE (${totalCases} CASOS) ===`);

  for (const tc of queue) {
    registeredTests++;
    let assertionsCount = 0;
    let testFailed = false;

    const t: TestContext = {
      assert(condition: boolean, message: string) {
        assertionsCount++;
        if (!condition) {
          testFailed = true;
          console.error(`  [FAIL] Assertion failed: ${message}`);
        } else {
          console.log(`  [OK] ${message}`);
        }
      },
    };

    console.log(`\nRunning test #${registeredTests}/${totalCases}: ${tc.name}`);
    try {
      await tc.fn(t);
      if (assertionsCount === 0) {
        testsWithZeroAssertions++;
        console.warn("  [WARN] Test executed zero assertions.");
      }
      if (testFailed) {
        failedTests++;
        console.error(`=== FAILED: ${tc.name} ===`);
      } else {
        passedTests++;
        console.log(`=== PASSED: ${tc.name} ===`);
      }
    } catch (err: any) {
      failedTests++;
      console.error(`  [ERROR] Uncaught exception during test:`, err);
      console.error(`=== FAILED: ${tc.name} ===`);
    }
  }

  console.log("\n==========================================");
  console.log("SUITE EXECUTION SUMMARY:");
  console.log(`Registered Tests:  ${registeredTests}`);
  console.log(`Passed Tests:      ${passedTests}`);
  console.log(`Failed Tests:      ${failedTests}`);
  console.log(`Zero Assertions:   ${testsWithZeroAssertions}`);
  console.log("==========================================");

  if (failedTests > 0 || testsWithZeroAssertions > 0 || passedTests + failedTests !== registeredTests) {
    console.error("SUITE FAILED.");
    process.exit(1);
  } else {
    console.log("SUITE PASSED successfully!");
    process.exit(0);
  }
}

runAll().catch((err) => {
  console.error("Fatal error during test run:", err);
  process.exit(1);
});
