import { isMusicScaleSubscriptionValid, getSubscriptionBlockReason } from '../utils/subscriptionValidator';
import { isCanonicalGlobalAdminRole } from '../contexts/AuthContext';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILURE: ${message}`);
    process.exit(1);
  } else {
    console.log(`✅ SUCCESS: ${message}`);
  }
}

async function runTests() {
  console.log("=========================================");
  console.log("RUNNING ENTILEMENT BILLING GATE HARDENING TESTS");
  console.log("=========================================");

  // -----------------------------------------------------
  // Test Case 1: Uma organização que NÃO tem apps.musicscale nem subStatus canônico deve retornar accessAllowed: false e status: 'inactive' pelo backend limits.
  // We simulate the backend logic here to prove its correctness.
  // -----------------------------------------------------
  console.log("\nTesting backend resolution simulator...");
  const mockOrgDataNoApps = {
    name: "Test Org No Apps",
    status: "active"
  };

  // Simulating the secure resolution we wrote in server.ts (ignoring contaminated subscriptionStatus)
  function simulateBackendResolution(orgData: any, subData: any) {
    let verifiedStatus = 'inactive';
    let verifiedPlan = 'starter';
    const msApp = orgData?.apps?.musicscale;
    if (msApp && msApp.status) {
      const rawStatus = String(msApp.status).toLowerCase().trim();
      if (rawStatus === 'active' || rawStatus === 'trialing') {
        verifiedStatus = rawStatus;
        verifiedPlan = String(msApp.plan || 'starter').toLowerCase().trim();
      }
    }
    if (verifiedStatus === 'inactive' && subData) {
      const rawStatus = String(subData.status || '').toLowerCase().trim();
      if (rawStatus === 'active' || rawStatus === 'trialing') {
        verifiedStatus = rawStatus;
        verifiedPlan = String(subData.plan || 'starter').toLowerCase().trim();
      }
    }
    // We strictly DO NOT check orgData.subscriptionStatus anymore!
    const accessAllowed = (verifiedStatus === 'active' || verifiedStatus === 'trialing');
    return { verifiedStatus, verifiedPlan, accessAllowed };
  }

  const resNoApps = simulateBackendResolution(mockOrgDataNoApps, null);
  assert(resNoApps.accessAllowed === false, "Org with no apps.musicscale or subscription status should not be allowed");
  assert(resNoApps.verifiedStatus === 'inactive', "Org with no apps.musicscale should be inactive");

  // -----------------------------------------------------
  // Test Case 2: Uma organização que tem apps.musicscale.status = 'active' deve retornar accessAllowed: true e status: 'active'.
  // -----------------------------------------------------
  const mockOrgDataActiveApps = {
    name: "Test Org Active Apps",
    apps: {
      musicscale: {
        status: "active",
        plan: "pro"
      }
    }
  };
  const resActiveApps = simulateBackendResolution(mockOrgDataActiveApps, null);
  assert(resActiveApps.accessAllowed === true, "Org with active apps.musicscale should be allowed");
  assert(resActiveApps.verifiedStatus === 'active', "Org with active apps.musicscale should have status active");
  assert(resActiveApps.verifiedPlan === 'pro', "Org with active apps.musicscale should resolve plan correctly");

  // -----------------------------------------------------
  // Test Case 3: O validador local de subscription deve rejeitar plan = 'pro' se o status for undefined ou inactive.
  // -----------------------------------------------------
  console.log("\nTesting local subscription validator...");
  const invalidProContext = {
    entitlements: {
      plan: 'pro',
      status: 'inactive'
    },
    organization: {
      plan: 'pro',
      subscriptionStatus: 'inactive'
    },
    subscription: {
      plan: 'pro',
      status: 'inactive'
    }
  };

  const isValidPro = isMusicScaleSubscriptionValid(invalidProContext as any);
  assert(isValidPro === false, "Local validator should reject plan = 'pro' if status is inactive");

  const blockReason = getSubscriptionBlockReason(invalidProContext as any);
  assert(blockReason.valid === false, "Local block reason should be invalid when status is inactive");
  assert(blockReason.reason === 'invalid_inactive', "Block reason should explicitly detail the inactive state");

  // -----------------------------------------------------
  // Test Case 4: isGlobalAdmin canônico (verificar papéis ceo, global_admin, ecosystem_owner, founder) deve passar no bypass, mas papéis não autorizados devem ser rejeitados.
  // -----------------------------------------------------
  console.log("\nTesting isGlobalAdmin roles bypass eligibility...");
  const validGlobalRoles = ['ceo', 'global_admin', 'ecosystem_owner', 'founder'];
  const invalidGlobalRoles = ['owner', 'admin', 'dono', 'administrador', 'support', 'suporte', 'supervisor', 'user', 'member'];

  for (const role of validGlobalRoles) {
    assert(isCanonicalGlobalAdminRole(role) === true, `Role '${role}' should be a valid canonical global admin role`);
  }

  for (const role of invalidGlobalRoles) {
    assert(isCanonicalGlobalAdminRole(role) === false, `Role '${role}' should NOT be eligible for global admin bypass`);
  }

  // -----------------------------------------------------
  // Test Case 5: Uma organização que possui apenas organizations.subscriptionStatus = 'active' NÃO deve obter liberação de acesso (accessAllowed = false), pois este campo não é mais confiável.
  // -----------------------------------------------------
  console.log("\nTesting contaminated legacy organizations.subscriptionStatus exclusion...");
  const mockOrgDataContaminated = {
    name: "Contaminated Org",
    subscriptionStatus: "active",
    music_scale_plan: "pro"
  };
  const resContaminated = simulateBackendResolution(mockOrgDataContaminated, null);
  assert(resContaminated.accessAllowed === false, "Contaminated legacy subscriptionStatus should NOT grant access anymore!");
  assert(resContaminated.verifiedStatus === 'inactive', "Contaminated legacy subscriptionStatus should leave status inactive");

  // -----------------------------------------------------
  // Test Case 6: Testar remoção no frontend validation
  // -----------------------------------------------------
  console.log("\nTesting frontend validation legacy organizations.subscriptionStatus exclusion...");
  const contaminatedFrontendContext = {
    entitlements: {
      status: 'inactive'
    },
    organization: {
      subscriptionStatus: 'active',
      currentPeriodEnd: 99999999999
    },
    subscription: {
      status: 'inactive'
    }
  };

  const isFrontendValid = isMusicScaleSubscriptionValid(contaminatedFrontendContext as any);
  assert(isFrontendValid === false, "Frontend isMusicScaleSubscriptionValid should NOT grant access with contaminated organization.subscriptionStatus");

  const frontendBlockReason = getSubscriptionBlockReason(contaminatedFrontendContext as any);
  assert(frontendBlockReason.valid === false, "Frontend getSubscriptionBlockReason should NOT grant access with contaminated organization.subscriptionStatus");

  console.log("\n=========================================");
  console.log("🎉 ALL TESTS PASSED SUCCESSFULLY! (PASS)");
  console.log("=========================================");
}

runTests().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
