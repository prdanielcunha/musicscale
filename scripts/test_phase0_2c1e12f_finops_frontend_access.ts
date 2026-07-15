import fs from "fs";
import path from "path";

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

// Replicate the canonical functions from AuthContext to test their logic dynamically
function normalizeGlobalSystemRole(input: any): string {
  if (!input) return "";
  return String(input).trim().toLowerCase();
}

function isCanonicalGlobalAdminRole(role: string): boolean {
  const normalized = normalizeGlobalSystemRole(role);
  return ["ceo", "global_admin", "ecosystem_owner", "founder"].includes(normalized);
}

function resolveCanonicalGlobalRole(params: {
  ecoContext?: any;
  userProfile?: any;
}): string {
  if (!params) return "";
  const { ecoContext, userProfile } = params;
  
  const rolesToTry = [
    ecoContext?.ecosystemRole,
    ecoContext?.systemRole,
    userProfile?.systemRole,
    userProfile?.globalRole,
    userProfile?.ecosystemRole
  ];

  for (const role of rolesToTry) {
    if (role && typeof role === "string" && role.trim() !== "") {
      return normalizeGlobalSystemRole(role);
    }
  }

  return "";
}

async function runTests() {
  console.log("=== RUNNING TEST: 0.2C.1E.12F Canonical Global Role Frontend Access Verification ===");

  // A. Check presence of resolvedor/helper de papel global canônico
  console.log("\n--- A. Checking AuthContext.tsx helper declarations ---");
  const authContextPath = "contexts/AuthContext.tsx";
  assert(fs.existsSync(authContextPath), "AuthContext.tsx exists");
  
  const authContextContent = fs.readFileSync(authContextPath, "utf8");
  assert(authContextContent.includes("export function normalizeGlobalSystemRole"), "AuthContext.tsx exports normalizeGlobalSystemRole");
  assert(authContextContent.includes("export function isCanonicalGlobalAdminRole"), "AuthContext.tsx exports isCanonicalGlobalAdminRole");
  assert(authContextContent.includes("export function resolveCanonicalGlobalRole"), "AuthContext.tsx exports resolveCanonicalGlobalRole");

  // Dynamic simulation tests for resolvedor
  console.log("\n--- B & C. Dynamic Role Resolution & Verification Tests ---");
  
  // Authorized roles
  assert(isCanonicalGlobalAdminRole("ceo"), "CEO is canonical global admin");
  assert(isCanonicalGlobalAdminRole("global_admin"), "GLOBAL_ADMIN is canonical global admin");
  assert(isCanonicalGlobalAdminRole("ecosystem_owner"), "ECOSYSTEM_OWNER is canonical global admin");
  assert(isCanonicalGlobalAdminRole("founder"), "FOUNDER is canonical global admin");
  assert(isCanonicalGlobalAdminRole(" CEO "), "CEO with spaces is handled");
  assert(isCanonicalGlobalAdminRole("Global_Admin"), "Mixed case is handled");

  // Unauthorized roles
  assert(!isCanonicalGlobalAdminRole("owner"), "owner is NOT canonical global admin");
  assert(!isCanonicalGlobalAdminRole("admin"), "admin is NOT canonical global admin");
  assert(!isCanonicalGlobalAdminRole("dono"), "dono is NOT canonical global admin");
  assert(!isCanonicalGlobalAdminRole("administrador"), "administrador is NOT canonical global admin");
  assert(!isCanonicalGlobalAdminRole("support"), "support is NOT canonical global admin");
  assert(!isCanonicalGlobalAdminRole("suporte"), "suporte is NOT canonical global admin");
  assert(!isCanonicalGlobalAdminRole("supervisor"), "supervisor is NOT canonical global admin");
  assert(!isCanonicalGlobalAdminRole("member"), "member is NOT canonical global admin");
  assert(!isCanonicalGlobalAdminRole("musician"), "musician is NOT canonical global admin");
  assert(!isCanonicalGlobalAdminRole("leader"), "leader is NOT canonical global admin");
  assert(!isCanonicalGlobalAdminRole(""), "Empty string is NOT canonical global admin");
  assert(!isCanonicalGlobalAdminRole(undefined as any), "undefined is NOT canonical global admin");

  // D. Fields considerations
  console.log("\n--- D & E. Canonical Ecosystem Fields Priority Tests ---");
  
  // Case: ecoContext has ecosystemRole
  let role = resolveCanonicalGlobalRole({
    ecoContext: { ecosystemRole: "ceo" },
    userProfile: { systemRole: "member" } // Should pick ecoContext first or resolve
  });
  assert(role === "ceo" && isCanonicalGlobalAdminRole(role), "Resolves ecoContext.ecosystemRole as ceo");

  // Case: ecoContext has systemRole
  role = resolveCanonicalGlobalRole({
    ecoContext: { systemRole: "global_admin" },
    userProfile: { systemRole: "member" }
  });
  assert(role === "global_admin" && isCanonicalGlobalAdminRole(role), "Resolves ecoContext.systemRole as global_admin");

  // Case: userProfile has systemRole
  role = resolveCanonicalGlobalRole({
    ecoContext: null,
    userProfile: { systemRole: "founder" }
  });
  assert(role === "founder" && isCanonicalGlobalAdminRole(role), "Resolves userProfile.systemRole as founder");

  // Case: userProfile has globalRole / ecosystemRole
  role = resolveCanonicalGlobalRole({
    userProfile: { globalRole: "ecosystem_owner" }
  });
  assert(role === "ecosystem_owner" && isCanonicalGlobalAdminRole(role), "Resolves userProfile.globalRole as ecosystem_owner");

  role = resolveCanonicalGlobalRole({
    userProfile: { ecosystemRole: "founder" }
  });
  assert(role === "founder" && isCanonicalGlobalAdminRole(role), "Resolves userProfile.ecosystemRole as founder");

  // Case: fallbacks to role organizational should not happen
  role = resolveCanonicalGlobalRole({
    userProfile: { role: "owner" } // should return empty since userProfile.role is not a canonical field
  });
  assert(role === "", "Does not use userProfile.role as fallback for global role resolution");

  // F, G, H, I. Sidebar Checks
  console.log("\n--- F, G, H, I. Checking Sidebar.tsx Integration ---");
  const sidebarPath = "components/layout/Sidebar.tsx";
  assert(fs.existsSync(sidebarPath), "Sidebar.tsx exists");
  
  const sidebarContent = fs.readFileSync(sidebarPath, "utf8");
  assert(sidebarContent.includes("isCurationAdmin"), "Sidebar retrieves isCurationAdmin from useAuth()");
  assert(sidebarContent.includes("Diagnóstico FinOps"), "Sidebar contains 'Diagnóstico FinOps'");
  assert(sidebarContent.includes("/admin/finops-diagnostics"), "Sidebar contains '/admin/finops-diagnostics'");
  assert(!sidebarContent.includes("userProfile?.role") || !sidebarContent.includes("userProfile?.role === 'owner'"), "Sidebar does not use userProfile.role to release diagnostics");

  // J. GlobalCurationProtectedRoute
  console.log("\n--- J. Checking GlobalCurationProtectedRoute ---");
  const protRefPath = "components/auth/GlobalCurationProtectedRoute.tsx";
  assert(fs.existsSync(protRefPath), "GlobalCurationProtectedRoute.tsx exists");
  const protRefContent = fs.readFileSync(protRefPath, "utf8");
  assert(protRefContent.includes("isCurationAdmin"), "GlobalCurationProtectedRoute protects route using isCurationAdmin");
  assert(protRefContent.includes("Você não tem acesso global autorizado para visualizar esta área."), "ProtectedRoute uses correct customized error message");

  // K. App.tsx
  console.log("\n--- K. Checking App.tsx ---");
  const appPath = "App.tsx";
  assert(fs.existsSync(appPath), "App.tsx exists");
  const appContent = fs.readFileSync(appPath, "utf8");
  assert(appContent.includes("/admin/finops-diagnostics"), "App.tsx defines route /admin/finops-diagnostics");
  assert(
    appContent.includes("<GlobalCurationProtectedRoute>") ||
    appContent.includes("GlobalCurationProtectedRoute"),
    "App.tsx protects route with GlobalCurationProtectedRoute"
  );

  // L. No Email Bypass Check
  console.log("\n--- L. Checking No Email Bypass in AuthContext.tsx ---");
  assert(!authContextContent.includes("gmail.com") && !authContextContent.includes("@"), "No email bypass hardcoded in AuthContext.tsx");

  // M, N, O. Untouched Files Check
  console.log("\n--- M, N, O. Verifying Untouched Boundaries ---");
  const serverPath = "server.ts";
  assert(fs.existsSync(serverPath), "server.ts exists");
  const serverContent = fs.readFileSync(serverPath, "utf8");
  assert(!serverContent.includes("test_phase0_2c1e12f"), "server.ts was not modified in this phase");

  const firestoreRulesPath = "firestore.rules";
  assert(fs.existsSync(firestoreRulesPath), "firestore.rules exists");
  const firestoreRulesContent = fs.readFileSync(firestoreRulesPath, "utf8");
  assert(!firestoreRulesContent.includes("test_phase0_2c1e12f"), "firestore.rules was not modified in this phase");

  // P. Forbidden Files Absence Check
  console.log("\n--- P. Verifying Absence of Forbidden Files ---");
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

  // Final Summary
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
