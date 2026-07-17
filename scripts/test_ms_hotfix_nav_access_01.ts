import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { 
  normalizeSystemRole, 
  normalizeOrganizationRole, 
  resolveCapabilities, 
  buildEffectiveAccessContext,
  hasMusicScaleCapability 
} from '../utils/rbac.js';

async function runTests() {
  console.log("=== STARTING MS-HOTFIX-NAV-ACCESS-01 TEST SUITE ===");

  // Test 1: RBAC System Role Normalization
  console.log("Testing System Role Normalization...");
  assert.strictEqual(normalizeSystemRole('ceo'), 'ecosystem_owner');
  assert.strictEqual(normalizeSystemRole('founder'), 'ecosystem_owner');
  assert.strictEqual(normalizeSystemRole('ecosystem_owner'), 'ecosystem_owner');
  assert.strictEqual(normalizeSystemRole('owner'), 'ecosystem_owner');
  assert.strictEqual(normalizeSystemRole('dono'), 'ecosystem_owner');
  assert.strictEqual(normalizeSystemRole('admin'), 'global_admin');
  assert.strictEqual(normalizeSystemRole('global_admin'), 'global_admin');
  assert.strictEqual(normalizeSystemRole('support'), 'global_support');
  assert.strictEqual(normalizeSystemRole('suporte'), 'global_support');
  assert.strictEqual(normalizeSystemRole('user'), 'user');
  assert.strictEqual(normalizeSystemRole(null), 'viewer');
  console.log("[PASS] System Role Normalization conforms to specifications.");

  // Test 2: Insecure elevation prevention
  console.log("Testing Org Role/AppRole Elevation Prevention...");
  // Confirm that local organizational role 'owner' or 'admin' does NOT yield global full access
  const orgOwnerContext = buildEffectiveAccessContext('user-1', 'org-1', 'user', 'owner');
  assert.strictEqual(orgOwnerContext.isGlobalFullAccess, false);
  assert.strictEqual(orgOwnerContext.isGlobalAccess, false);
  assert.strictEqual(orgOwnerContext.isOrganizationAdmin, true);
  
  const orgMemberContext = buildEffectiveAccessContext('user-2', 'org-1', 'user', 'member');
  assert.strictEqual(orgMemberContext.isGlobalFullAccess, false);
  assert.strictEqual(orgMemberContext.isOrganizationAdmin, false);
  assert.strictEqual(hasMusicScaleCapability(orgMemberContext, 'organization.settings.manage'), false);
  console.log("[PASS] Elevation prevention validated successfully.");

  // Test 3: Translations verify
  console.log("Testing pt.json Translation Keys...");
  const ptPath = path.resolve(process.cwd(), './locales/pt.json');
  assert.ok(fs.existsSync(ptPath), "locales/pt.json must exist");
  const ptData = JSON.parse(fs.readFileSync(ptPath, 'utf8'));
  
  assert.ok(ptData.nav, "nav section must exist in translations");
  assert.strictEqual(ptData.nav.database, "Banco de Dados");
  assert.strictEqual(ptData.nav.curation_queue, "Curadoria");
  assert.strictEqual(ptData.nav.dashboard, "Painel");
  console.log("[PASS] Required navigation translation keys exist.");

  // Test 4: Verify Sidebar structure via parsing
  console.log("Testing Sidebar configuration and groups...");
  const sidebarPath = path.resolve(process.cwd(), './components/layout/Sidebar.tsx');
  assert.ok(fs.existsSync(sidebarPath), "Sidebar.tsx must exist");
  const sidebarContent = fs.readFileSync(sidebarPath, 'utf8');
  assert.ok(sidebarContent.includes('navigationRegistry'), "Sidebar must use navigationRegistry for centralized canonical menu structure");
  assert.ok(!sidebarContent.includes('SettingsMenu'), "Sidebar must not contain the old SettingsMenu overlay");
  console.log("[PASS] Sidebar structure aligns with canonical refactoring requirements.");

  console.log("=== ALL TEST CASES FOR MS-HOTFIX-NAV-ACCESS-01-FIX-1 COMPLETED SUCCESSFULLY ===");
}

runTests().catch(err => {
  console.error("Test suite failed:", err);
  process.exit(1);
});
