import fs from "fs";
import path from "path";
import { resolveScaleDurationMinutes, convertScaleToCalendarEvent } from "../utils/calendar";

let registeredTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, message: string) {
  registeredTests++;
  if (condition) {
    passedTests++;
    console.log(`[PASS] ${message}`);
  } else {
    failedTests++;
    console.error(`[FAIL] ${message}`);
  }
}

// Helper to check file existence
function fileExists(filePath: string): boolean {
  return fs.existsSync(path.resolve(filePath));
}

// Helper to read file content
function readFile(filePath: string): string {
  return fs.readFileSync(path.resolve(filePath), "utf8");
}

console.log("Iniciando testes herméticos de duração da escala...");

// 1. DYNAMIC TESTS of resolveScaleDurationMinutes
try {
  assert(resolveScaleDurationMinutes(undefined) === 120, "resolveScaleDurationMinutes(undefined) === 120");
  assert(resolveScaleDurationMinutes(null) === 120, "resolveScaleDurationMinutes(null) === 120");
  assert(resolveScaleDurationMinutes(0) === 120, "resolveScaleDurationMinutes(0) === 120");
  assert(resolveScaleDurationMinutes(-10) === 120, "resolveScaleDurationMinutes(-10) === 120");
  assert(resolveScaleDurationMinutes(NaN) === 120, "resolveScaleDurationMinutes(NaN) === 120");
  assert(resolveScaleDurationMinutes("") === 120, "resolveScaleDurationMinutes('') === 120");
  assert(resolveScaleDurationMinutes("abc") === 120, "resolveScaleDurationMinutes('abc') === 120");
  assert(resolveScaleDurationMinutes(90) === 90, "resolveScaleDurationMinutes(90) === 90");
  assert(resolveScaleDurationMinutes("90") === 90, "resolveScaleDurationMinutes('90') === 90");
  assert(resolveScaleDurationMinutes(180) === 180, "resolveScaleDurationMinutes(180) === 180");
  assert(resolveScaleDurationMinutes("180") === 180, "resolveScaleDurationMinutes('180') === 180");
} catch (err: any) {
  failedTests++;
  console.error("Erro durante os testes dinâmicos de resolveScaleDurationMinutes:", err);
}

// 2. DYNAMIC TESTS of convertScaleToCalendarEvent
try {
  const dummyScale90 = {
    id: "scale_1",
    organizationId: "org_1",
    date: "2026-07-07",
    time: "10:00",
    durationMinutes: 90,
    title: "Ensaio Geral",
    location: { name: "Auditório Principal" }
  };
  const event90 = convertScaleToCalendarEvent(dummyScale90);
  assert(event90 !== null, "convertScaleToCalendarEvent retornou evento");
  if (event90) {
    const diffMs = event90.end.getTime() - event90.start.getTime();
    assert(diffMs === 90 * 60 * 1000, `Duração de 90 minutos gera final correto (${diffMs / 60000} min)`);
  }

  const dummyScale180 = {
    id: "scale_2",
    organizationId: "org_1",
    date: "2026-07-07",
    time: "10:00",
    durationMinutes: 180,
    title: "Ensaio Geral",
    location: { name: "Auditório Principal" }
  };
  const event180 = convertScaleToCalendarEvent(dummyScale180);
  assert(event180 !== null, "convertScaleToCalendarEvent retornou evento");
  if (event180) {
    const diffMs = event180.end.getTime() - event180.start.getTime();
    assert(diffMs === 180 * 60 * 1000, `Duração de 180 minutos gera final correto (${diffMs / 60000} min)`);
  }

  const dummyScaleInvalid = {
    id: "scale_3",
    organizationId: "org_1",
    date: "2026-07-07",
    time: "10:00",
    durationMinutes: "abc",
    title: "Ensaio Geral",
    location: { name: "Auditório Principal" }
  };
  const eventInvalid = convertScaleToCalendarEvent(dummyScaleInvalid);
  assert(eventInvalid !== null, "convertScaleToCalendarEvent retornou evento");
  if (eventInvalid) {
    const diffMs = eventInvalid.end.getTime() - eventInvalid.start.getTime();
    assert(diffMs === 120 * 60 * 1000, `Duração inválida faz fallback para 120 minutos (${diffMs / 60000} min)`);
  }
} catch (err: any) {
  failedTests++;
  console.error("Erro durante os testes dinâmicos de convertScaleToCalendarEvent:", err);
}

// 3. STATIC / SEMANTIC CHECKS OF SOURCE FILES
try {
  // A. utils/calendar.ts possui helper resolveScaleDurationMinutes
  const calendarContent = readFile("utils/calendar.ts");
  assert(calendarContent.includes("export function resolveScaleDurationMinutes"), "utils/calendar.ts possui export de resolveScaleDurationMinutes");

  // B. convertScaleToCalendarEvent usa durationMinutes e não usa mais duração fixa exclusiva de 2 horas
  assert(calendarContent.includes("resolveScaleDurationMinutes(scale.durationMinutes)"), "convertScaleToCalendarEvent resolve a duração usando o helper");
  assert(!calendarContent.includes("const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);"), "convertScaleToCalendarEvent não usa mais duração fixa exclusiva de 2h");

  // G. ScaleDetailModal usa helper/fallback seguro ou lógica equivalente que exige número positivo
  const detailModalContent = readFile("components/scales/ScaleDetailModal.tsx");
  assert(detailModalContent.includes("resolveScaleDurationMinutes"), "ScaleDetailModal.tsx importa/utiliza o helper resolveScaleDurationMinutes");
} catch (err: any) {
  failedTests++;
  console.error("Erro durante verificações estáticas dos arquivos fontes:", err);
}

// 4. FORBIDDEN FILES CHECK
// H. Nenhum arquivo proibido existe
const forbiddenFiles = ["run_test.js", "run_test2.js", "scripts/test_gate_check.ts"];
forbiddenFiles.forEach(file => {
  assert(!fileExists(file), `Arquivo proibido ${file} não existe`);
});

// 5. FINOPS PROTECTION CHECK
try {
  const serverContent = readFile("server.ts");
  assert(serverContent.includes("/api/admin/finops-diagnostics/preflight"), "server.ts ainda contém /api/admin/finops-diagnostics/preflight");
  assert(serverContent.includes("/api/admin/finops-diagnostics/run"), "server.ts ainda contém /api/admin/finops-diagnostics/run");
} catch (err: any) {
  failedTests++;
  console.error("Erro ao ler server.ts:", err);
}

console.log("\n==================================");
console.log(`Testes registrados: ${registeredTests}`);
console.log(`Testes passados: ${passedTests}`);
console.log(`Testes falhos: ${failedTests}`);
console.log("==================================");

if (failedTests > 0 || registeredTests === 0) {
  console.error("Falha nos testes de cobertura.");
  process.exit(1);
} else {
  console.log("Todos os testes passaram com sucesso!");
  process.exit(0);
}
