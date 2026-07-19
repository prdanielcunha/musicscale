import { resolveStarterEntitlementState } from '../services/server/onboarding/firstScaleOnboardingService.js';
import assert from 'assert';

async function runTests() {
  console.log('Running test_starter_pack_resolve...');
  let successCount = 0;
  
  const mockDb = {
    collection: (name: string) => ({
      doc: (id: string) => ({
        get: async () => {
          if (name === 'organizations' && id === 'org_active') {
            return {
              exists: true,
              data: () => ({ apps: { musicscale: { status: 'active' } } })
            };
          }
          if (name === 'organizations' && id === 'org_inactive') {
            return { exists: true, data: () => ({}) };
          }
          if (name === 'organizations' && id === 'org_no_entitlement') {
            return { exists: true, data: () => ({ status: 'active' }) };
          }
          
          if (name === 'subscriptions' && id === 'org_no_entitlement') {
            return { exists: true, data: () => ({ status: 'canceled' }) };
          }
          if (name === 'subscriptions' && id === 'org_inactive') {
            return { exists: false, data: () => null };
          }
          return { exists: false, data: () => null };
        }
      })
    })
  };

  try {
    const res1 = await resolveStarterEntitlementState(mockDb as any, 'org_active');
    assert.strictEqual(res1, true);
    successCount++;

    const res2 = await resolveStarterEntitlementState(mockDb as any, 'org_inactive');
    assert.strictEqual(res2, false);
    successCount++;

    const res3 = await resolveStarterEntitlementState(mockDb as any, 'org_no_entitlement');
    assert.strictEqual(res3, false);
    successCount++;

    console.log(`Testes passando: ${successCount}/3`);
  } catch (e) {
    console.error(e);
  }
}

runTests();
