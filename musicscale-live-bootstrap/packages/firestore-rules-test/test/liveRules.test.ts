import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment
} from '@firebase/rules-unit-testing';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc
} from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

let env: RulesTestEnvironment;

async function seed() {
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();

    await setDoc(doc(db, 'organizations', 'org-a'), {
      name: 'Org A',
      ownerUid: 'owner'
    });
    await setDoc(doc(db, 'organizations', 'org-b'), {
      name: 'Org B',
      ownerUid: 'other-owner'
    });

    await setDoc(doc(db, 'organizations/org-a/members', 'admin'), {
      uid: 'admin',
      status: 'active',
      organizationRole: 'admin'
    });
    await setDoc(doc(db, 'organizations/org-a/members', 'operator'), {
      uid: 'operator',
      status: 'active',
      organizationRole: 'member',
      permissions: {
        'musicscale.live.conduct': true
      }
    });
    await setDoc(doc(db, 'organizations/org-a/members', 'viewer'), {
      uid: 'viewer',
      status: 'active',
      organizationRole: 'member'
    });
    await setDoc(doc(db, 'organizations/org-b/members', 'other'), {
      uid: 'other',
      status: 'active',
      organizationRole: 'admin'
    });

    await setDoc(doc(db, 'musicScaleLiveVenues', 'venue-a'), {
      organizationId: 'org-a',
      name: 'Main sanctuary',
      timeZone: 'America/Sao_Paulo',
      active: true
    });
    await setDoc(doc(db, 'musicScaleLiveVenues', 'venue-b'), {
      organizationId: 'org-b',
      name: 'Other',
      timeZone: 'America/Sao_Paulo',
      active: true
    });
    await setDoc(doc(db, 'musicScaleLiveRequests', 'request-a'), {
      organizationId: 'org-a',
      venueId: 'venue-a',
      liveSessionId: 'session-a',
      actorId: 'viewer',
      kind: 'bible',
      payload: { reference: 'João 3:16' },
      status: 'pending',
      createdAt: '2026-09-19T00:00:00.000Z'
    });
  });
}

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-musicscale-live'
  });
});

beforeEach(async () => {
  await env.clearFirestore();
  await seed();
});

afterAll(async () => {
  await env.cleanup();
});

describe('MusicScale Live Firestore tenant rules', () => {
  it('lets an active tenant member read Live config but blocks cross-tenant reads', async () => {
    const viewer = env.authenticatedContext('viewer').firestore();

    await assertSucceeds(getDoc(doc(viewer, 'musicScaleLiveVenues', 'venue-a')));
    await assertFails(getDoc(doc(viewer, 'musicScaleLiveVenues', 'venue-b')));
  });

  it('allows admins to configure venues but blocks ordinary members', async () => {
    const admin = env.authenticatedContext('admin').firestore();
    const viewer = env.authenticatedContext('viewer').firestore();

    await assertSucceeds(setDoc(doc(admin, 'musicScaleLiveVenues', 'venue-new'), {
      organizationId: 'org-a',
      name: 'Youth room',
      timeZone: 'America/Sao_Paulo',
      active: true
    }));

    await assertFails(setDoc(doc(viewer, 'musicScaleLiveVenues', 'venue-denied'), {
      organizationId: 'org-a',
      name: 'Should fail',
      timeZone: 'America/Sao_Paulo',
      active: true
    }));
  });

  it('allows a Live conductor to cache a service plan without granting config authority', async () => {
    const operator = env.authenticatedContext('operator').firestore();

    await assertSucceeds(setDoc(doc(operator, 'musicScaleLiveServicePlans', 'plan-a'), {
      id: 'plan-a',
      organizationId: 'org-a',
      venueId: 'venue-a',
      liveSystemId: 'system-a',
      title: 'Sunday',
      scheduledAt: '2026-09-20T09:30:00-03:00',
      items: [],
      revision: 1
    }));

    await assertFails(setDoc(doc(operator, 'musicScaleLiveSystems', 'system-a'), {
      id: 'system-a',
      organizationId: 'org-a',
      venueId: 'venue-a',
      name: 'Main',
      activeProfileId: null
    }));
  });

  it('lets a member create only their own pending request', async () => {
    const viewer = env.authenticatedContext('viewer').firestore();

    await assertSucceeds(setDoc(doc(viewer, 'musicScaleLiveRequests', 'request-own'), {
      id: 'request-own',
      organizationId: 'org-a',
      venueId: 'venue-a',
      liveSessionId: 'session-a',
      actorId: 'viewer',
      kind: 'message',
      payload: { text: 'Voltar ao refrão' },
      status: 'pending',
      createdAt: '2026-09-19T00:00:00.000Z'
    }));

    await assertFails(setDoc(doc(viewer, 'musicScaleLiveRequests', 'request-spoof'), {
      id: 'request-spoof',
      organizationId: 'org-a',
      venueId: 'venue-a',
      liveSessionId: 'session-a',
      actorId: 'operator',
      kind: 'message',
      payload: { text: 'spoofed' },
      status: 'pending',
      createdAt: '2026-09-19T00:00:00.000Z'
    }));
  });

  it('lets the operator resolve a request while preventing the requester from self-approving it', async () => {
    const viewer = env.authenticatedContext('viewer').firestore();
    const operator = env.authenticatedContext('operator').firestore();

    await assertFails(updateDoc(doc(viewer, 'musicScaleLiveRequests', 'request-a'), {
      status: 'accepted'
    }));
    await assertSucceeds(updateDoc(doc(operator, 'musicScaleLiveRequests', 'request-a'), {
      status: 'accepted'
    }));
  });

  it('keeps tenant identity immutable on updates', async () => {
    const admin = env.authenticatedContext('admin').firestore();

    await assertFails(updateDoc(doc(admin, 'musicScaleLiveVenues', 'venue-a'), {
      organizationId: 'org-b'
    }));
  });

  it('keeps Live events append-only', async () => {
    const operator = env.authenticatedContext('operator').firestore();

    await assertSucceeds(setDoc(doc(operator, 'musicScaleLiveEvents', 'event-a'), {
      id: 'event-a',
      organizationId: 'org-a',
      venueId: 'venue-a',
      liveSystemId: 'system-a',
      liveSessionId: 'session-a',
      actorId: 'operator',
      type: 'take',
      occurredAt: '2026-09-19T00:00:00.000Z',
      source: 'live-ui',
      payload: { sceneId: 'scene-a' }
    }));

    await assertFails(updateDoc(doc(operator, 'musicScaleLiveEvents', 'event-a'), {
      type: 'rewritten'
    }));
  });
});
