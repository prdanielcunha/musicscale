import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, setDoc } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

const hasEmulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
const describeWithEmulator = hasEmulator ? describe : describe.skip;
let env: RulesTestEnvironment;

describeWithEmulator('MusicScale scale-save global role compatibility', () => {
  beforeAll(async () => {
    env = await initializeTestEnvironment({
      projectId: 'demo-musicscale-global-role-save',
      firestore: { rules: readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8') },
    });
  });

  afterAll(async () => { await env?.cleanup(); });

  beforeEach(async () => {
    await env.clearFirestore();
    await env.withSecurityRulesDisabled(async context => {
      await setDoc(doc(context.firestore(), 'organizations', 'org-1'), {
        status: 'active', ownerUid: 'tenant-owner',
      });
    });
  });

  const seedUser = async (uid: string, data: Record<string, unknown>) => {
    await env.withSecurityRulesDisabled(async context => {
      await setDoc(doc(context.firestore(), 'users', uid), data);
    });
  };

  const createMusicScale = (uid: string, id: string) => {
    const db = env.authenticatedContext(uid).firestore();
    return setDoc(doc(db, 'scales', id), {
      organizationId: 'org-1',
      date: '2026-09-20',
      time: '19:00',
      timeZone: 'America/Sao_Paulo',
      eventTypeId: 'event-1',
      locationId: 'location-1',
      songIds: ['song-1'],
      durationMinutes: 90,
      status: 'draft',
    });
  };

  const createBandScale = (uid: string, id: string) => {
    const db = env.authenticatedContext(uid).firestore();
    return setDoc(doc(db, 'bandScales', id), {
      organizationId: 'org-1',
      date: '2026-09-20',
      assignments: [{ userId: 'member-1', instrumentId: 'instrument-1' }],
    });
  };

  it('allows CEO carried in ecosystemRole to create music and band scales', async () => {
    await seedUser('ceo-ecosystem', { ecosystemRole: 'ceo' });
    await assertSucceeds(createMusicScale('ceo-ecosystem', 'scale-eco-ceo'));
    await assertSucceeds(createBandScale('ceo-ecosystem', 'band-eco-ceo'));
  });

  it('allows CEO carried in globalRole to create a music scale', async () => {
    await seedUser('ceo-global', { globalRole: 'ceo' });
    await assertSucceeds(createMusicScale('ceo-global', 'scale-global-ceo'));
  });

  it('preserves the canonical systemRole CEO path', async () => {
    await seedUser('ceo-system', { systemRole: 'ceo' });
    await assertSucceeds(createMusicScale('ceo-system', 'scale-system-ceo'));
  });

  it('does not turn an ordinary member into a scale manager', async () => {
    await seedUser('ordinary-member', { systemRole: 'user' });
    await env.withSecurityRulesDisabled(async context => {
      await setDoc(doc(context.firestore(), 'organizations', 'org-1', 'members', 'ordinary-member'), {
        status: 'active', organizationRole: 'member',
      });
    });
    await assertFails(createMusicScale('ordinary-member', 'scale-forbidden'));
  });

  it('allows an active member with explicit canManageScales permission', async () => {
    await seedUser('scale-manager', { systemRole: 'user' });
    await env.withSecurityRulesDisabled(async context => {
      await setDoc(doc(context.firestore(), 'organizations', 'org-1', 'members', 'scale-manager'), {
        status: 'active',
        organizationRole: 'member',
        permissions: { canManageScales: true },
      });
    });
    await assertSucceeds(createMusicScale('scale-manager', 'scale-explicit-permission'));
  });
});
