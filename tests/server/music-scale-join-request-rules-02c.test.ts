import { readFileSync } from 'fs';
import { resolve } from 'path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { assertFails, assertSucceeds, initializeTestEnvironment, RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore';

const hasEmulator = !!process.env.FIRESTORE_EMULATOR_HOST;
let env: RulesTestEnvironment;

async function seed() {
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'organizations/org-1'), { status: 'active', ownerUid: 'metadata-owner' });
    await setDoc(doc(db, 'organizations/org-2'), { status: 'active', ownerUid: 'other-owner' });
    await setDoc(doc(db, 'organizations/org-1/join_requests/requester-1'), {
      requestId: 'requester-1', requesterUid: 'requester-1', organizationId: 'org-1', status: 'pending', email: 'person@example.com'
    });
    await setDoc(doc(db, 'organizations/org-2/join_requests/requester-2'), {
      requestId: 'requester-2', requesterUid: 'requester-2', organizationId: 'org-2', status: 'pending'
    });

    await setDoc(doc(db, 'organizations/org-1/members/canonical-admin'), { uid: 'canonical-admin', status: 'active', organizationRole: 'admin' });
    await setDoc(doc(db, 'organizations/org-1/members/canonical-owner'), { uid: 'canonical-owner', status: 'ativo', role: 'owner' });
    await setDoc(doc(db, 'organizations/org-1/members/common-member'), { uid: 'common-member', status: 'active', role: 'member' });
    await setDoc(doc(db, 'organizations/org-1/members/pending-admin'), { uid: 'pending-admin', status: 'pending', role: 'admin' });
    await setDoc(doc(db, 'organization_members/legacy-owner_org-1'), { uid: 'legacy-owner', organizationId: 'org-1', status: 'active', role: 'owner' });

    for (const [uid, role] of [
      ['system-admin', 'admin'], ['global-support', 'global_support'], ['ecosystem-support', 'ecosystem_support'],
      ['global-ceo', 'ceo'], ['global-admin', 'global_admin'], ['global-ecosystem-owner', 'ecosystem_owner'], ['global-founder', 'founder']
    ]) {
      await setDoc(doc(db, `users/${uid}`), { systemRole: role });
    }
  });
}

const authed = (uid: string) => env.authenticatedContext(uid).firestore();
const requestRef = (uid: string) => doc(authed(uid), 'organizations/org-1/join_requests/requester-1');

beforeAll(async () => {
  if (!hasEmulator) return;
  env = await initializeTestEnvironment({
    projectId: 'demo-musicscale-join-request-02c',
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

describe.skipIf(!hasEmulator)('02C canonical join request Firestore Rules', () => {
  it.each(['canonical-admin', 'canonical-owner', 'metadata-owner'])('%s can get and list tenant join requests', async uid => {
    const db = authed(uid);
    await assertSucceeds(getDoc(doc(db, 'organizations/org-1/join_requests/requester-1')));
    const q = query(collection(db, 'organizations/org-1/join_requests'), where('status', '==', 'pending'));
    const snap = await assertSucceeds(getDocs(q));
    expect(snap.size).toBe(1);
  });

  it.each(['global-ceo', 'global-admin', 'global-ecosystem-owner', 'global-founder'])('%s exact canonical global can get and list', async uid => {
    const db = authed(uid);
    await assertSucceeds(getDoc(doc(db, 'organizations/org-1/join_requests/requester-1')));
    await assertSucceeds(getDocs(query(collection(db, 'organizations/org-1/join_requests'), where('status', '==', 'pending'))));
  });

  it.each([
    'common-member', 'pending-admin', 'legacy-owner', 'system-admin', 'global-support', 'ecosystem-support', 'outsider'
  ])('%s cannot read canonical join requests', async uid => {
    const db = authed(uid);
    await assertFails(getDoc(doc(db, 'organizations/org-1/join_requests/requester-1')));
    await assertFails(getDocs(query(collection(db, 'organizations/org-1/join_requests'), where('status', '==', 'pending'))));
  });

  it('unauthenticated and cross-tenant access are denied', async () => {
    const anon = env.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(anon, 'organizations/org-1/join_requests/requester-1')));
    await assertFails(getDoc(doc(authed('canonical-admin'), 'organizations/org-2/join_requests/requester-2')));
  });

  it.each(['canonical-admin', 'metadata-owner', 'global-ceo'])('%s cannot create update or delete join requests client-side', async uid => {
    const db = authed(uid);
    await assertFails(setDoc(doc(db, 'organizations/org-1/join_requests/new-request'), { status: 'pending' }));
    await assertFails(updateDoc(doc(db, 'organizations/org-1/join_requests/requester-1'), { status: 'approved' }));
    await assertFails(deleteDoc(doc(db, 'organizations/org-1/join_requests/requester-1')));
  });

  it('generic organization catch-all does not reopen join request writes', async () => {
    await assertFails(setDoc(doc(authed('canonical-admin'), 'organizations/org-1/join_requests/catch-all-test'), { status: 'pending' }));
  });
});
