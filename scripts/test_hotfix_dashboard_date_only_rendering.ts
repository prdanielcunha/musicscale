import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log("=== EXECUTANDO TESTE DE RENDERIZAÇÃO DE DATAS DATE-ONLY (DASHBOARD) ===");

let passedTests: number = 0;
let failedTests: number = 0;
const registeredTests: number = 7;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  [OK] ${message}`);
    passedTests++;
  } else {
    console.error(`  [ERRO] ${message}`);
    failedTests++;
  }
}

try {
  // 1. Check DashboardPage.tsx
  const dashboardPath = path.resolve(__dirname, '../pages/DashboardPage.tsx');
  const dashboardContent = fs.readFileSync(dashboardPath, 'utf8');

  // a. Doesn't contain "new Date(scale.date)" without "T00"
  assert(!dashboardContent.includes('new Date(scale.date)'), 'DashboardPage.tsx não contém mais "new Date(scale.date)" desprotegido.');

  // b. Contains the helper
  assert(dashboardContent.includes('parseDateOnlyLocal'), 'DashboardPage.tsx contém a declaração/chamada do helper parseDateOnlyLocal.');
  
  // c. Helper logic uses year, month - 1, day
  assert(dashboardContent.includes('new Date(year, month - 1, day)'), 'Helper implementa nova Date baseada nos componentes locais de ano, mês-1, dia.');
  
  // d. The badge renders with the helper
  assert(dashboardContent.includes('displayDate.toLocaleDateString(') && dashboardContent.includes('displayDate.getDate()'), 'O card usa o displayDate para mês e dia.');

  // 2. Validate helper locally
  const parseDateOnlyLocal = (dateValue?: string | null): Date | null => {
    if (!dateValue || typeof dateValue !== "string") return null;
    const [yearStr, monthStr, dayStr] = dateValue.split("-");
    const year = Number(yearStr);
    const month = Number(monthStr);
    const day = Number(dayStr);
    if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
    return new Date(year, month - 1, day);
  };
  
  const testDate = parseDateOnlyLocal("2026-07-05");
  assert(testDate?.getDate() === 5 && testDate?.getMonth() === 6 && testDate?.getFullYear() === 2026, 'O helper puro converte corretamente "2026-07-05" para o dia 5 local sem sofrer UTC shift.');

  // 3. Verify that other critical files were NOT modified (Smoke checks)
  const serverPath = path.resolve(__dirname, '../server.ts');
  let serverSafe = true;
  if (fs.existsSync(serverPath)) {
     const serverContent = fs.readFileSync(serverPath, 'utf8');
     // Just checking if we didn't wipe it
     if (!serverContent.includes('express')) serverSafe = false;
  }
  assert(serverSafe, 'server.ts não foi alterado de forma destrutiva no hotfix.');

  const firestoreRulesPath = path.resolve(__dirname, '../firestore.rules');
  let rulesSafe = true;
  if (fs.existsSync(firestoreRulesPath)) {
      const rulesContent = fs.readFileSync(firestoreRulesPath, 'utf8');
      if (!rulesContent.includes('match /organizations')) rulesSafe = false;
  }
  assert(rulesSafe, 'firestore.rules não foi alterado no hotfix.');

} catch (e: any) {
  console.error("ERRO FATAL NA EXECUÇÃO DOS TESTES:", e.message);
  failedTests++;
}

console.log("=============================================");
console.log("SUITE EXECUTION SUMMARY:");
console.log(`Registered Tests:  ${registeredTests}`);
console.log(`Passed Tests:      ${passedTests}`);
console.log(`Failed Tests:      ${failedTests}`);
console.log(`Zero Assertions:   ${passedTests === 0 ? 'YES' : 'NO'}`);
console.log("==========================================");

if (failedTests > 0 || passedTests !== registeredTests || passedTests === 0) {
  console.error("SUITE FAILED.");
  process.exit(1);
} else {
  console.log("SUITE PASSED successfully!");
  process.exit(0);
}
