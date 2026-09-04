import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, setDoc, Timestamp } from 'firebase/firestore';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { afterAll, beforeAll, describe, it } from 'vitest';

const hasEmulatorHost = !!process.env.FIRESTORE_EMULATOR_HOST;
let env: RulesTestEnvironment;

describe.skipIf(!hasEmulatorHost)('Public analytics Firestore Rules', () => {
  beforeAll(async () => {
    env = await initializeTestEnvironment({
      projectId: 'demo-musicscale-analytics-rules',
      firestore: {
        rules: readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8'),
      },
    });
  });

  afterAll(async () => {
    await env.cleanup();
  });

  const baseEvent = {
    organizationId: 'none',
    userId: 'none',
    sessionId: 'session-public-123',
    app: 'musicscale',
    timestamp: Timestamp.now(),
  };

  it('preserves the anonymous MusicScale sales funnel', async () => {
    const db = env.unauthenticatedContext().firestore();

    await assertSucceeds(setDoc(doc(db, 'analytics_events/page-view'), {
      ...baseEvent,
      eventType: 'page_view',
      metadata: { page: 'sales_landing' },
    }));

    await assertSucceeds(setDoc(doc(db, 'analytics_events/demo-opened'), {
      ...baseEvent,
      eventType: 'app_usage',
      metadata: { action: 'sales_demo_opened', source: 'sales_landing' },
    }));

    await assertSucceeds(setDoc(doc(db, 'analytics_events/demo-step'), {
      ...baseEvent,
      eventType: 'app_usage',
      metadata: { action: 'sales_demo_step_selected', step: 5 },
    }));

    await assertSucceeds(setDoc(doc(db, 'analytics_events/plan-choice'), {
      ...baseEvent,
      eventType: 'trial_cta_clicked',
      metadata: { action: 'choose_plan', source: 'sales_landing_primary' },
    }));
  });

  it('denies arbitrary or spoofed anonymous analytics writes', async () => {
    const db = env.unauthenticatedContext().firestore();

    await assertFails(setDoc(doc(db, 'analytics_events/arbitrary'), {
      ...baseEvent,
      eventType: 'checkout_completed',
      metadata: {},
    }));

    await assertFails(setDoc(doc(db, 'analytics_events/spoofed'), {
      ...baseEvent,
      userId: 'victim-user',
      eventType: 'page_view',
      metadata: { page: 'sales_landing' },
    }));

    await assertFails(setDoc(doc(db, 'analytics_events/injected'), {
      ...baseEvent,
      eventType: 'page_view',
      metadata: { page: 'sales_landing' },
      injected: true,
    }));

    await assertFails(setDoc(doc(db, 'analytics_events/out-of-range-demo-step'), {
      ...baseEvent,
      eventType: 'app_usage',
      metadata: { action: 'sales_demo_step_selected', step: 6 },
    }));
  });

  it('allows authenticated root analytics only for self or none user identity', async () => {
    const db = env.authenticatedContext('user-1').firestore();

    await assertSucceeds(setDoc(doc(db, 'analytics_events/auth-self'), {
      ...baseEvent,
      userId: 'user-1',
      eventType: 'checkout_started',
      metadata: { source: 'checkout' },
    }));

    await assertFails(setDoc(doc(db, 'analytics_events/auth-spoof'), {
      ...baseEvent,
      userId: 'other-user',
      eventType: 'checkout_started',
      metadata: { source: 'checkout' },
    }));
  });
});
