import { readFileSync } from 'fs';
import { resolve } from 'path';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, initializeTestEnvironment, RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

const hasEmulator = !!process.env.FIRESTORE_EMULATOR_HOST;
let env: RulesTestEnvironment;

const authed = (uid: string) => env.authenticatedContext(uid).firestore();
const anon = () => env.unauthenticatedContext().firestore();

async function seed() {
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'organizations/org-1'), { status: 'active', ownerUid: 'metadata-owner' });
    await setDoc(doc(db, 'organizations/org-2'), { status: 'active', ownerUid: 'other-owner' });

    await setDoc(doc(db, 'organizations/org-1/members/self-member'), {
      uid: 'self-member', organizationId: 'org-1', status: 'active', organizationRole: 'member', role: 'member'
    });
    await setDoc(doc(db, 'organizations/org-1/members/common-member'), {
      uid: 'common-member', organizationId: 'org-1', status: 'active', organizationRole: 'member', role: 'member'
    });
    await setDoc(doc(db, 'organizations/org-1/members/canonical-admin'), {
      uid: 'canonical-admin', organizationId: 'org-1', status: 'active', organizationRole: 'admin', role: 'admin'
    });
    await setDoc(doc(db, 'organizations/org-1/members/target-member'), {
      uid: 'target-member', organizationId: 'org-1', status: 'active', organizationRole: 'member', role: 'member'
    });
    await setDoc(doc(db, 'organizations/org-2/members/cross-tenant-admin'), {
      uid: 'cross-tenant-admin', organizationId: 'org-2', status: 'active', organizationRole: 'admin', role: 'admin'
    });

    await setDoc(doc(db, 'organization_members/target-member_org-1'), {
      uid: 'target-member', organizationId: 'org-1', status: 'active', role: 'member', organizationRole: 'member'
    });
    await setDoc(doc(db, 'organization_members/org-1_target-member'), {
      uid: 'target-member', organizationId: 'org-1', status: 'active', role: 'member', organizationRole: 'member'
    });

    for (const [uid, role] of [
      ['system-admin', 'admin'],
      ['global-support', 'global_support'],
      ['global-ceo', 'ceo'],
      ['global-admin', 'global_admin'],
      ['global-ecosystem-owner', 'ecosystem_owner'],
      ['global-founder', 'founder']
    ]) {
      await setDoc(doc(db, `users/${uid}`), { systemRole: role });
    }
  });
}

beforeAll(async () => {
  if (!hasEmulator) return;
  env = await initializeTestEnvironment({
    projectId: 'demo-musicscale-membership-authority-02e',
    firestore: { rules: readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8') }
  });
});

afterAll(async () => {
  if (hasEmulator) await env.cleanup();
});

beforeEach(async () => {
  if (!hasEmulator) return;
  await env.clearFirestore();
  await seed();
});

describe.skipIf(!hasEmulator)('02E canonical membership authority Firestore Rules', () => {
  const privilegedAndOrdinaryActors = [
    'self-member',
    'common-member',
    'canonical-admin',
    'metadata-owner',
    'cross-tenant-admin',
    'system-admin',
    'global-support',
    'global-ceo',
    'global-admin',
    'global-ecosystem-owner',
    'global-founder'
  ];

  it.each(privilegedAndOrdinaryActors)('%s cannot create canonical membership client-side', async uid => {
    const db = authed(uid);
    await assertFails(setDoc(doc(db, 'organizations/org-1/members/new-member'), {
      uid: 'new-member', organizationId: 'org-1', status: 'active', role: 'member', organizationRole: 'member'
    }));
  });

  it.each(privilegedAndOrdinaryActors)('%s cannot update canonical membership client-side', async uid => {
    const db = authed(uid);
    await assertFails(updateDoc(doc(db, 'organizations/org-1/members/target-member'), {
      role: 'admin', organizationRole: 'admin'
    }));
  });

  it.each(privilegedAndOrdinaryActors)('%s cannot delete canonical membership client-side', async uid => {
    await assertFails(deleteDoc(doc(authed(uid), 'organizations/org-1/members/target-member')));
  });

  it('unauthenticated client cannot mutate canonical membership', async () => {
    const db = anon();
    await assertFails(setDoc(doc(db, 'organizations/org-1/members/new-anon'), { status: 'active' }));
    await assertFails(updateDoc(doc(db, 'organizations/org-1/members/target-member'), { role: 'admin' }));
    await assertFails(deleteDoc(doc(db, 'organizations/org-1/members/target-member')));
  });

  it.each(['self-member', 'canonical-admin', 'metadata-owner', 'system-admin', 'global-ceo', 'global-founder'])
  ('%s cannot create legacy membership projection client-side', async uid => {
    await assertFails(setDoc(doc(authed(uid), 'organization_members/new-member_org-1'), {
      uid: 'new-member', organizationId: 'org-1', status: 'active', role: 'member'
    }));
  });

  it.each(['self-member', 'canonical-admin', 'metadata-owner', 'system-admin', 'global-ceo', 'global-founder'])
  ('%s cannot update legacy membership projection client-side', async uid => {
    await assertFails(updateDoc(doc(authed(uid), 'organization_members/target-member_org-1'), { role: 'admin' }));
  });

  it.each(['self-member', 'canonical-admin', 'metadata-owner', 'system-admin', 'global-ceo', 'global-founder'])
  ('%s cannot delete legacy membership projection client-side', async uid => {
    await assertFails(deleteDoc(doc(authed(uid), 'organization_members/target-member_org-1')));
  });

  it('unauthenticated client cannot mutate legacy membership projection', async () => {
    const db = anon();
    await assertFails(setDoc(doc(db, 'organization_members/new-anon_org-1'), { organizationId: 'org-1' }));
    await assertFails(updateDoc(doc(db, 'organization_members/target-member_org-1'), { role: 'admin' }));
    await assertFails(deleteDoc(doc(db, 'organization_members/target-member_org-1')));
  });

  it('generic organization catch-all cannot reopen canonical membership writes', async () => {
    const db = authed('canonical-admin');
    await assertFails(setDoc(doc(db, 'organizations/org-1/members/catch-all-create'), { status: 'active' }));
    await assertFails(updateDoc(doc(db, 'organizations/org-1/members/target-member'), { organizationRole: 'admin' }));
    await assertFails(deleteDoc(doc(db, 'organizations/org-1/members/target-member')));
  });

  it('read compatibility remains available to own canonical member and own legacy projection', async () => {
    await assertSucceeds(getDoc(doc(authed('self-member'), 'organizations/org-1/members/self-member')));
    await env.withSecurityRulesDisabled(async context => {
      await setDoc(doc(context.firestore(), 'organization_members/self-member_org-1'), {
        uid: 'self-member', organizationId: 'org-1', status: 'active', role: 'member'
      });
    });
    await assertSucceeds(getDoc(doc(authed('self-member'), 'organization_members/self-member_org-1')));
  });
});
