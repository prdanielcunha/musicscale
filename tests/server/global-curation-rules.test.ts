import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

const hasEmulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
const describeWithEmulator = hasEmulator ? describe : describe.skip;
let env: RulesTestEnvironment;

describeWithEmulator('global curation: only verified ecosystem roles may opt out', () => {
  beforeAll(async () => {
    env = await initializeTestEnvironment({
      projectId: 'demo-musicscale-global-curation-policy',
      firestore: { rules: readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8') },
    });
  });
  afterAll(async () => { await env?.cleanup(); });
  beforeEach(async () => { await env.clearFirestore(); });

  async function seed(uid: string, profile: Record<string, unknown>) {
    await env.withSecurityRulesDisabled(async ctx => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'organizations', 'org-global-curation'), { status: 'active', ownerUid: 'owner' });
      await setDoc(doc(db, 'users', uid), profile);
      await setDoc(doc(db, 'organizations', 'org-global-curation', 'members', uid), {
        status: 'active', organizationRole: 'member', permissions: { canManageRepertoire: true }
      });
    });
  }

  function save(uid: string, id: string, optOut?: boolean) {
    const db = env.authenticatedContext(uid).firestore();
    return setDoc(doc(db, 'songs', id), {
      organizationId: 'org-global-curation',
      title: 'Nova Canção',
      status: 'active',
      createdBy: { uid, displayName: uid },
      ...(optOut === undefined ? {} : { globalCurationOptOut: optOut })
    });
  }

  it('accepts ordinary member songs with mandatory curation (hidden true)', async () => {
    await seed('member', { systemRole: 'user' });
    await assertSucceeds(save('member', 'member-default'));
    await assertSucceeds(save('member', 'member-false', false));
  });

  it('rejects a member forged opt-out flag', async () => {
    await seed('member', { systemRole: 'user' });
    await assertFails(save('member', 'forged', true));
  });

  it('allows CEO and ecosystem support with exact authenticated authorship to opt out', async () => {
    await seed('ceo', { systemRole: 'ceo' });
    await assertSucceeds(save('ceo', 'ceo-override', true));
    await seed('support', { systemRole: 'ecosystem_support' });
    await assertSucceeds(save('support', 'support-override', true));
  });

  it('does not allow privileged account to forge another creator UID', async () => {
    await seed('ceo', { systemRole: 'ceo' });
    const db = env.authenticatedContext('ceo').firestore();
    await assertFails(setDoc(doc(db, 'songs', 'forged-contributor'), {
      organizationId: 'org-global-curation', title: 'Outra Música', status: 'active',
      createdBy: { uid: 'other-user' }, globalCurationOptOut: true
    }));
  });

  it('disallows changing an existing song opt-out from a member account', async () => {
    await seed('member', { systemRole: 'user' });
    await assertSucceeds(save('member', 'existing'));
    const db = env.authenticatedContext('member').firestore();
    await assertFails(updateDoc(doc(db, 'songs', 'existing'), { globalCurationOptOut: true }));
  });
});
