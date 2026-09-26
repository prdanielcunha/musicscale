import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { beforeAll, beforeEach, afterAll, describe, it } from 'vitest';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

let env: RulesTestEnvironment | null = null;
const enabled = !!process.env.FIRESTORE_EMULATOR_HOST;
beforeAll(async () => {
  if (!enabled) return;
  env = await initializeTestEnvironment({ projectId: 'demo-musicscale-medley-templates', firestore: { rules: readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8') } });
}, 30_000);
beforeEach(async () => { if (env) await env.clearFirestore(); });
afterAll(async () => { if (env) await env.cleanup(); });

describe.skipIf(!enabled)('organization medley templates', () => {
  it('keeps templates tenant scoped and writable only by scale managers', async () => {
    await env!.withSecurityRulesDisabled(async context => {
      const db = context.firestore();
      await setDoc(doc(db, 'organizations/org-a'), { status: 'active' });
      await setDoc(doc(db, 'organizations/org-b'), { status: 'active' });
      for (const [uid, org, permissions] of [
        ['manager', 'org-a', { canManageScales: true }], ['member', 'org-a', {}], ['outsider', 'org-b', {}],
      ] as const) await setDoc(doc(db, `organizations/${org}/members/${uid}`), { uid, status: 'active', organizationId: org, role: 'member', organizationRole: 'member', permissions });
    });
    const template = { organizationId: 'org-a', name: 'A → B', arrangement: { id: 'medley', steps: [] } };
    const path = 'medleyTemplates/template-1';
    const managerDb = env!.authenticatedContext('manager').firestore();
    await assertSucceeds(setDoc(doc(managerDb, path), template));
    await assertSucceeds(getDoc(doc(env!.authenticatedContext('member').firestore(), path)));
    await assertFails(getDoc(doc(env!.authenticatedContext('outsider').firestore(), path)));
    await assertFails(updateDoc(doc(env!.authenticatedContext('member').firestore(), path), { name: 'Changed' }));
    await assertFails(updateDoc(doc(managerDb, path), { organizationId: 'org-b' }));
  });
});
