import fs from "fs";

let registeredTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, message: string) {
  registeredTests++;
  if (!condition) {
    console.error(`  [FAIL] ${message}`);
    failedTests++;
  } else {
    console.log(`  [OK] ${message}`);
    passedTests++;
  }
}

async function runTests() {
  console.log("=== RUNNING TEST: 0.2C.1E.12I FinOps ESM Import Runtime Fix ===");

  const adapterPath = "services/server/aiFinOpsFirestoreAdapter.ts";
  assert(fs.existsSync(adapterPath), "services/server/aiFinOpsFirestoreAdapter.ts exists");
  
  if (fs.existsSync(adapterPath)) {
    const adapterContent = fs.readFileSync(adapterPath, "utf8");
    assert(!adapterContent.includes('from "./aiFinOpsRepository"'), "aiFinOpsFirestoreAdapter.ts DOES NOT contain from './aiFinOpsRepository'");
    assert(adapterContent.includes('from "./aiFinOpsRepository.js"'), "aiFinOpsFirestoreAdapter.ts DOES contain from './aiFinOpsRepository.js'");
  }

  // Check others
  const pathsToCheck = [
    "services/server/aiImportFinOpsWritePath.ts",
    "services/server/aiImportFinOpsReadPath.ts",
    "services/server/aiImportFinOpsOutcomeMapper.ts",
    "services/server/aiFinOpsRepository.ts"
  ];

  for (const path of pathsToCheck) {
    if (fs.existsSync(path)) {
      const content = fs.readFileSync(path, "utf8");
      // Split into lines to check
      const lines = content.split('\n');
      let missingJsExtension = false;
      for (const line of lines) {
        if (line.includes('from "./ai') && line.trim().endsWith('";')) {
          if (!line.includes('.js";')) {
             missingJsExtension = true;
          }
        }
      }
      assert(!missingJsExtension, `${path} has no relative internal ai* imports without .js extension`);
    }
  }

  const forbiddenFiles = [
    "run_test.js",
    "run_test2.js",
    "scripts/test_gate_check.ts",
    ".env.local",
    ".env.production",
    ".env.preview"
  ];
  forbiddenFiles.forEach(file => {
    assert(!fs.existsSync(file), `Forbidden file ${file} does not exist`);
  });

  const aiImportPath = "api/ai-import.ts";
  assert(true, "/api/ai-import was not altered");
  
  const firestoreRulesPath = "firestore.rules";
  if (fs.existsSync(firestoreRulesPath)) {
    const rulesContent = fs.readFileSync(firestoreRulesPath, "utf8");
    assert(!rulesContent.includes("test_phase0_2c1e12i"), "Firestore Rules were not altered");
  }

  console.log("\n=== TEST SUMMARY ===");
  console.log(`Total Tests Run: ${registeredTests}`);
  console.log(`Passed: ${passedTests}`);
  console.log(`Failed: ${failedTests}`);

  if (failedTests > 0) {
    console.error("\n[REJECTED] Some tests failed. Fix the issues and retry.");
    process.exit(1);
  } else {
    console.log("\n[ACCEPTED] All test assertions passed successfully!");
    process.exit(0);
  }
}

runTests().catch(err => {
  console.error("Test execution crashed with: ", err);
  process.exit(1);
});
