import {
  assertFails as realAssertFails,
  assertSucceeds as realAssertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { readFileSync } from 'fs';
import { describe, it, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { resolve } from 'path';

interface DocData {
  recipientId?: string;
  organizationId?: string;
  type?: string;
  isRead?: boolean;
  isArchived?: boolean;
  readAt?: string | null;
  archivedAt?: string | null;
  [key: string]: unknown;
}

interface DocumentReference {
  set(data: Record<string, unknown>): Promise<void>;
  update(data: Record<string, unknown>): Promise<void>;
  get(): Promise<{ exists: boolean; data(): unknown }>;
  delete(): Promise<void>;
}

interface FirestoreInstance {
  doc(path: string): DocumentReference;
}

interface RulesContext {
  firestore(): FirestoreInstance;
}

let testEnv: RulesTestEnvironment | typeof mockTestEnv;
let isFallbackMode = false;
const fallbackStore = new Map<string, DocData>();

class MockDocRef implements DocumentReference {
  constructor(
    public path: string,
    private db: MockFirestore,
    private auth: { uid: string; email?: string } | null,
    private adminMode: boolean
  ) {}

  async get() {
    const docData = this.db.store.get(this.path) || null;
    
    if (!this.adminMode) {
      if (!this.auth) {
        throw new Error('PERMISSION_DENIED: Unauthenticated');
      }
      if (!docData) {
        throw new Error('PERMISSION_DENIED');
      }
      if (docData.recipientId !== this.auth.uid) {
        throw new Error('PERMISSION_DENIED: Recipient mismatch');
      }
    }

    return {
      exists: docData !== null,
      data: () => docData,
    };
  }

  async set(data: Record<string, unknown>) {
    if (!this.adminMode) {
      throw new Error('PERMISSION_DENIED: Create not allowed');
    }
    this.db.store.set(this.path, { ...data });
  }

  async delete() {
    if (!this.adminMode) {
      throw new Error('PERMISSION_DENIED: Delete not allowed');
    }
    this.db.store.delete(this.path);
  }

  async update(newData: Record<string, unknown>) {
    const docData = this.db.store.get(this.path);
    if (!this.adminMode) {
      if (!this.auth) {
        throw new Error('PERMISSION_DENIED: Unauthenticated');
      }
      if (!docData) {
        throw new Error('PERMISSION_DENIED: Document not found');
      }
      if (docData.recipientId !== this.auth.uid) {
        throw new Error('PERMISSION_DENIED: Recipient mismatch');
      }
      for (const key of Object.keys(newData)) {
        if (['recipientId', 'organizationId', 'type'].includes(key)) {
          if (docData[key] !== undefined && docData[key] !== newData[key]) {
            throw new Error(`PERMISSION_DENIED: Field ${key} is immutable`);
          }
        }
      }
    }
    if (docData) {
      this.db.store.set(this.path, { ...docData, ...newData });
    }
  }
}

class MockFirestore implements FirestoreInstance {
  get store() {
    return fallbackStore;
  }
  constructor(
    private auth: { uid: string; email?: string } | null,
    private adminMode = false
  ) {}

  doc(path: string): MockDocRef {
    return new MockDocRef(path, this, this.auth, this.adminMode);
  }
}

const mockTestEnv = {
  cleanup: async () => {
    fallbackStore.clear();
  },
  clearFirestore: async () => {
    fallbackStore.clear();
  },
  authenticatedContext: (uid: string, authData?: { email?: string }) => {
    return {
      firestore: () => new MockFirestore({ uid, ...authData }, false),
    };
  },
  unauthenticatedContext: () => {
    return {
      firestore: () => new MockFirestore(null, false),
    };
  },
  withSecurityRulesDisabled: async (cb: (context: RulesContext) => Promise<void>) => {
    const adminContext: RulesContext = {
      firestore: () => new MockFirestore(null, true),
    };
    await cb(adminContext);
  },
};

async function assertSucceeds(pr: unknown): Promise<any> {
  if (isFallbackMode) {
    return await (pr as any);
  }
  return realAssertSucceeds(pr as any);
}

async function assertFails(pr: unknown): Promise<unknown> {
  if (isFallbackMode) {
    try {
      await (pr as any);
    } catch (err) {
      return err;
    }
    throw new Error('Expected promise to fail but it succeeded');
  }
  return realAssertFails(pr as any);
}

const hasEmulatorHost = !!process.env.FIRESTORE_EMULATOR_HOST;

if (!hasEmulatorHost) {
  console.log("==========================================================");
  console.log("WARNING: FIRESTORE_EMULATOR_HOST is not defined.");
  console.log("Real firestore security rules are NOT being executed.");
  console.log("Running in high-fidelity Mock Fallback Mode as a Mock Contract test.");
  console.log("This DOES NOT certify real Firebase Security Rules.");
  console.log("==========================================================");
  console.log("SECURITY_RULES_MODE=MOCK_CONTRACT");
} else {
  console.log("SECURITY_RULES_MODE=FIREBASE_EMULATOR");
}

beforeAll(async () => {
  const rulesPath = resolve(process.cwd(), 'firestore.rules');
  const rules = readFileSync(rulesPath, 'utf8');

  if (hasEmulatorHost) {
    // Must propagate error and must NOT use fallback
    testEnv = await initializeTestEnvironment({
      projectId: 'demo-musicscale-rules',
      firestore: {
        rules,
      },
    });
    isFallbackMode = false;
  } else {
    try {
      testEnv = await initializeTestEnvironment({
        projectId: 'demo-musicscale-rules',
        firestore: {
          rules,
        },
      });
    } catch (err) {
      console.warn("Firestore Emulator not available, running in high-fidelity Mock Fallback Mode.");
      isFallbackMode = true;
      testEnv = mockTestEnv;
    }
  }
}, 30_000);

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

describe(hasEmulatorHost ? 'Firestore Rules Security Certification (Etapa 10)' : 'Firestore Rules Mock Contract Check (Emulator Not Available - MOCK CONTRACT)', () => {
  const getAuthedFirestore = (auth?: { uid: string, email?: string }) => {
    if (auth) {
      return testEnv.authenticatedContext(auth.uid, { email: auth.email }).firestore();
    }
    return testEnv.unauthenticatedContext().firestore();
  };

  const seedProjection = async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const adminDb = context.firestore();
      await adminDb.doc('organizations/org-1/musicscale_members/member-1').set({
        uid: 'member-1', organizationId: 'org-1', roleId: 'role-member'
      });
    });
  };

  describe('0. Security Rules Environment Check', () => {
    it('com FIRESTORE_EMULATOR_HOST definido, fallback nao e usado e falhas sao propagadas', () => {
      if (hasEmulatorHost) {
        if (isFallbackMode) {
          throw new Error('Fallback mode is active even though FIRESTORE_EMULATOR_HOST is defined');
        }
      }
    });
  });

  describe('1. Multi-Tenant Isolation', () => {
    it('destinatário lê a própria notificação', async () => {
      const db = getAuthedFirestore({ uid: 'user-1' });
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const adminDb = context.firestore();
        await adminDb.doc('organizations/org-1/notifications/notif-1').set({
          recipientId: 'user-1',
          isRead: false,
        });
      });

      const docRef = db.doc('organizations/org-1/notifications/notif-1');
      await assertSucceeds(docRef.get());
    });

    it('outro usuário não lê a notificação', async () => {
      const db = getAuthedFirestore({ uid: 'user-2' });
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const adminDb = context.firestore();
        await adminDb.doc('organizations/org-1/notifications/notif-1').set({
          recipientId: 'user-1',
          isRead: false,
        });
      });

      const docRef = db.doc('organizations/org-1/notifications/notif-1');
      await assertFails(docRef.get());
    });
    
    it('tenant incorreto é bloqueado', async () => {
        const db = getAuthedFirestore({ uid: 'user-1' });
        const docRef = db.doc('organizations/org-2/notifications/notif-1');
        await assertFails(docRef.get());
    });
  });

  describe.skipIf(!hasEmulatorHost)('1b. MusicScale member projection isolation', () => {
    it('canonical status active permite leitura no tenant', async () => {
      await seedProjection();
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await context.firestore().doc('organizations/org-1/members/user-active').set({
          uid: 'user-active', organizationId: 'org-1', status: 'active', organizationRole: 'member'
        });
      });
      await assertSucceeds(getAuthedFirestore({ uid: 'user-active' }).doc('organizations/org-1/musicscale_members/member-1').get());
    });

    it('canonical status ativo permite leitura no tenant', async () => {
      await seedProjection();
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await context.firestore().doc('organizations/org-1/members/user-ativo').set({
          uid: 'user-ativo', organizationId: 'org-1', status: 'ativo', organizationRole: 'member'
        });
      });
      await assertSucceeds(getAuthedFirestore({ uid: 'user-ativo' }).doc('organizations/org-1/musicscale_members/member-1').get());
    });

    it('canonical pending não permite leitura', async () => {
      await seedProjection();
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await context.firestore().doc('organizations/org-1/members/user-pending').set({ status: 'pending' });
      });
      await assertFails(getAuthedFirestore({ uid: 'user-pending' }).doc('organizations/org-1/musicscale_members/member-1').get());
    });

    it('canonical inactive não permite leitura', async () => {
      await seedProjection();
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await context.firestore().doc('organizations/org-1/members/user-inactive').set({ status: 'inactive' });
      });
      await assertFails(getAuthedFirestore({ uid: 'user-inactive' }).doc('organizations/org-1/musicscale_members/member-1').get());
    });

    it('canonical sem status ativo não permite leitura', async () => {
      await seedProjection();
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await context.firestore().doc('organizations/org-1/members/user-no-status').set({ organizationRole: 'member' });
      });
      await assertFails(getAuthedFirestore({ uid: 'user-no-status' }).doc('organizations/org-1/musicscale_members/member-1').get());
    });

    it('legacy uid_org active preserva leitura', async () => {
      await seedProjection();
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await context.firestore().doc('organization_members/legacy-a_org-1').set({
          uid: 'legacy-a', organizationId: 'org-1', status: 'active'
        });
      });
      await assertSucceeds(getAuthedFirestore({ uid: 'legacy-a' }).doc('organizations/org-1/musicscale_members/member-1').get());
    });

    it('legacy uid_org pending não permite leitura', async () => {
      await seedProjection();
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await context.firestore().doc('organization_members/legacy-b_org-1').set({
          uid: 'legacy-b', organizationId: 'org-1', status: 'pending'
        });
      });
      await assertFails(getAuthedFirestore({ uid: 'legacy-b' }).doc('organizations/org-1/musicscale_members/member-1').get());
    });

    it('legacy uid_org inactive não permite leitura', async () => {
      await seedProjection();
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await context.firestore().doc('organization_members/legacy-c_org-1').set({
          uid: 'legacy-c', organizationId: 'org-1', status: 'inactive'
        });
      });
      await assertFails(getAuthedFirestore({ uid: 'legacy-c' }).doc('organizations/org-1/musicscale_members/member-1').get());
    });

    it('legacy org_uid ativo preserva leitura', async () => {
      await seedProjection();
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await context.firestore().doc('organization_members/org-1_legacy-d').set({
          uid: 'legacy-d', organizationId: 'org-1', status: 'ativo'
        });
      });
      await assertSucceeds(getAuthedFirestore({ uid: 'legacy-d' }).doc('organizations/org-1/musicscale_members/member-1').get());
    });

    it('legacy org_uid pending não permite leitura', async () => {
      await seedProjection();
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await context.firestore().doc('organization_members/org-1_legacy-e').set({
          uid: 'legacy-e', organizationId: 'org-1', status: 'pending'
        });
      });
      await assertFails(getAuthedFirestore({ uid: 'legacy-e' }).doc('organizations/org-1/musicscale_members/member-1').get());
    });

    it('legacy org_uid inactive não permite leitura', async () => {
      await seedProjection();
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await context.firestore().doc('organization_members/org-1_legacy-f').set({
          uid: 'legacy-f', organizationId: 'org-1', status: 'inactive'
        });
      });
      await assertFails(getAuthedFirestore({ uid: 'legacy-f' }).doc('organizations/org-1/musicscale_members/member-1').get());
    });

    it('usuário autenticado sem membership não permite leitura', async () => {
      await seedProjection();
      await assertFails(getAuthedFirestore({ uid: 'ordinary-user' }).doc('organizations/org-1/musicscale_members/member-1').get());
    });

    it('membership ativa em outro tenant não permite leitura', async () => {
      await seedProjection();
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await context.firestore().doc('organizations/org-2/members/cross-tenant').set({ status: 'active' });
      });
      await assertFails(getAuthedFirestore({ uid: 'cross-tenant' }).doc('organizations/org-1/musicscale_members/member-1').get());
    });

    it('users.systemRole admin não recebe acesso global', async () => {
      await seedProjection();
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await context.firestore().doc('users/local-admin').set({ systemRole: 'admin' });
      });
      await assertFails(getAuthedFirestore({ uid: 'local-admin' }).doc('organizations/org-1/musicscale_members/member-1').get());
    });

    it('users.systemRole owner não recebe acesso global', async () => {
      await seedProjection();
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await context.firestore().doc('users/local-owner').set({ systemRole: 'owner' });
      });
      await assertFails(getAuthedFirestore({ uid: 'local-owner' }).doc('organizations/org-1/musicscale_members/member-1').get());
    });

    for (const role of ['ceo', 'global_admin', 'ecosystem_owner', 'founder']) {
      it(`${role} recebe acesso global canônico`, async () => {
        await seedProjection();
        await testEnv.withSecurityRulesDisabled(async (context) => {
          await context.firestore().doc(`users/${role}`).set({ systemRole: role });
        });
        await assertSucceeds(getAuthedFirestore({ uid: role }).doc('organizations/org-1/musicscale_members/member-1').get());
      });
    }

    it('cliente com membership ativa não pode create, update ou delete diretamente', async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const adminDb = context.firestore();
        await adminDb.doc('organizations/org-1/members/user-writer').set({ status: 'active' });
        await adminDb.doc('organizations/org-1/musicscale_members/member-1').set({ roleId: 'role-member' });
      });
      const db = getAuthedFirestore({ uid: 'user-writer' });
      await assertFails(db.doc('organizations/org-1/musicscale_members/new-member').set({ roleId: 'role-owner' }));
      await assertFails(db.doc('organizations/org-1/musicscale_members/member-1').update({ roleId: 'role-owner' }));
      await assertFails(db.doc('organizations/org-1/musicscale_members/member-1').delete());
    });
  });

  describe.skipIf(!hasEmulatorHost)('1c. Invitation authority is server-only', () => {
    const seedOrganization = async () => testEnv.withSecurityRulesDisabled(async context => {
      await context.firestore().doc('organizations/org-1').set({ status: 'active', ownerUid: 'owner-1' });
      await context.firestore().doc('organizations/org-1/members/admin-1').set({ status: 'active', organizationRole: 'admin' });
      await context.firestore().doc('organizations/org-1/members/member-1').set({ status: 'active', organizationRole: 'member' });
      await context.firestore().doc('organizations/org-1/invites/legacy-1').set({ status: 'pending', organizationId: 'org-1' });
      await context.firestore().doc('organizations/org-1/musicscale_invite_role_intents/hash-1').set({ status: 'pending', organizationId: 'org-1' });
      await context.firestore().doc('users/global-1').set({ systemRole: 'global_admin' });
    });

    it('denies unauthenticated and ordinary authenticated nested invitation reads', async () => {
      await seedOrganization();
      await assertFails(getAuthedFirestore().doc('organizations/org-1/invites/legacy-1').get());
      await assertFails(getAuthedFirestore({ uid: 'ordinary-1' }).doc('organizations/org-1/invites/legacy-1').get());
    });

    it.each(['member-1', 'admin-1', 'owner-1', 'global-1'])('denies invitation read for privileged identity %s', async uid => {
      await seedOrganization();
      await assertFails(getAuthedFirestore({ uid }).doc('organizations/org-1/invites/legacy-1').get());
    });

    it.each(['ordinary-1', 'admin-1', 'owner-1', 'global-1'])('denies invitation create for client %s', async uid => {
      await seedOrganization();
      await assertFails(getAuthedFirestore({ uid }).doc(`organizations/org-1/invites/new-${uid}`).set({ status: 'pending' }));
    });

    it('denies invitation update and delete', async () => {
      await seedOrganization();
      const ref = getAuthedFirestore({ uid: 'admin-1' }).doc('organizations/org-1/invites/legacy-1');
      await assertFails(ref.update({ status: 'accepted' }));
      await assertFails(ref.delete());
    });

    it('denies all client access to role intents and catch-all does not reopen it', async () => {
      await seedOrganization();
      const ref = getAuthedFirestore({ uid: 'admin-1' }).doc('organizations/org-1/musicscale_invite_role_intents/hash-1');
      await assertFails(ref.get());
      await assertFails(getAuthedFirestore({ uid: 'admin-1' }).doc('organizations/org-1/musicscale_invite_role_intents/hash-2').set({ status: 'creating' }));
      await assertFails(ref.update({ status: 'applied' }));
      await assertFails(ref.delete());
    });

    it('denies every role-intent operation for canonical global identity', async () => {
      await seedOrganization();
      const db = getAuthedFirestore({ uid: 'global-1' });
      const ref = db.doc('organizations/org-1/musicscale_invite_role_intents/hash-1');
      await assertFails(ref.get());
      await assertFails(db.doc('organizations/org-1/musicscale_invite_role_intents/hash-global').set({ status: 'creating' }));
      await assertFails(ref.update({ status: 'applied' }));
      await assertFails(ref.delete());
    });
  });

  describe('2. Notifications Soft Delete & Restricted Updates', () => {
    it('cliente não cria notificação', async () => {
      const db = getAuthedFirestore({ uid: 'user-1' });
      const docRef = db.doc('organizations/org-1/notifications/notif-1');
      await assertFails(docRef.set({ recipientId: 'user-1', isRead: false }));
    });

    it('cliente não exclui fisicamente', async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const adminDb = context.firestore();
        await adminDb.doc('organizations/org-1/notifications/notif-1').set({
          recipientId: 'user-1',
          isRead: false,
        });
      });

      const db = getAuthedFirestore({ uid: 'user-1' });
      const docRef = db.doc('organizations/org-1/notifications/notif-1');
      await assertFails(docRef.delete());
    });

    it('destinatário atualiza isRead', async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const adminDb = context.firestore();
        await adminDb.doc('organizations/org-1/notifications/notif-1').set({
          recipientId: 'user-1',
          isRead: false,
        });
      });

      const db = getAuthedFirestore({ uid: 'user-1' });
      const docRef = db.doc('organizations/org-1/notifications/notif-1');
      await assertSucceeds(docRef.update({ isRead: true }));
    });
    
    it('destinatário atualiza readAt e archivedAt', async () => {
        await testEnv.withSecurityRulesDisabled(async (context) => {
          const adminDb = context.firestore();
          await adminDb.doc('organizations/org-1/notifications/notif-1').set({
            recipientId: 'user-1',
            isRead: false,
            isArchived: false,
          });
        });
  
        const db = getAuthedFirestore({ uid: 'user-1' });
        const docRef = db.doc('organizations/org-1/notifications/notif-1');
        await assertSucceeds(docRef.update({ readAt: '2026-07-30T10:00:00Z', archivedAt: '2026-07-30T10:00:00Z' }));
    });

    it('destinatário atualiza isArchived (soft delete é permitido)', async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const adminDb = context.firestore();
        await adminDb.doc('organizations/org-1/notifications/notif-1').set({
          recipientId: 'user-1',
          isArchived: false,
        });
      });

      const db = getAuthedFirestore({ uid: 'user-1' });
      const docRef = db.doc('organizations/org-1/notifications/notif-1');
      await assertSucceeds(docRef.update({ isArchived: true }));
    });

    it('destinatário não altera recipientId', async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const adminDb = context.firestore();
        await adminDb.doc('organizations/org-1/notifications/notif-1').set({
          recipientId: 'user-1',
        });
      });

      const db = getAuthedFirestore({ uid: 'user-1' });
      const docRef = db.doc('organizations/org-1/notifications/notif-1');
      await assertFails(docRef.update({ recipientId: 'user-2' }));
    });

    it('destinatário não altera organizationId', async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const adminDb = context.firestore();
        await adminDb.doc('organizations/org-1/notifications/notif-1').set({
          recipientId: 'user-1',
          organizationId: 'org-1'
        });
      });

      const db = getAuthedFirestore({ uid: 'user-1' });
      const docRef = db.doc('organizations/org-1/notifications/notif-1');
      await assertFails(docRef.update({ organizationId: 'org-2' }));
    });

    it('destinatário não altera type', async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const adminDb = context.firestore();
        await adminDb.doc('organizations/org-1/notifications/notif-1').set({
          recipientId: 'user-1',
          type: 'default'
        });
      });

      const db = getAuthedFirestore({ uid: 'user-1' });
      const docRef = db.doc('organizations/org-1/notifications/notif-1');
      await assertFails(docRef.update({ type: 'admin' }));
    });
  });
});
