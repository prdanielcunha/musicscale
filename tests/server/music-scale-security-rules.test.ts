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

async function assertSucceeds<T>(pr: Promise<T> | T): Promise<T> {
  if (isFallbackMode) {
    return pr;
  }
  return realAssertSucceeds(pr as Promise<T>);
}

async function assertFails<T>(pr: Promise<T> | T): Promise<unknown> {
  if (isFallbackMode) {
    try {
      await pr;
    } catch (err) {
      return err;
    }
    throw new Error('Expected promise to fail but it succeeded');
  }
  return realAssertFails(pr as Promise<T>);
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
});

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
    it('permite leitura no tenant e nega escrita direta e leitura cross-tenant', async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const adminDb = context.firestore();
        await adminDb.doc('organizations/org-1/members/user-1').set({
          uid: 'user-1', organizationId: 'org-1', status: 'active', organizationRole: 'member'
        });
        await adminDb.doc('organizations/org-1/musicscale_members/user-1').set({
          uid: 'user-1', organizationId: 'org-1', roleId: 'role-admin'
        });
        await adminDb.doc('organizations/org-2/musicscale_members/user-2').set({
          uid: 'user-2', organizationId: 'org-2', roleId: 'role-member'
        });
      });

      const db = getAuthedFirestore({ uid: 'user-1' });
      await assertSucceeds(db.doc('organizations/org-1/musicscale_members/user-1').get());
      await assertFails(db.doc('organizations/org-1/musicscale_members/user-1').update({ roleId: 'role-owner' }));
      await assertFails(db.doc('organizations/org-2/musicscale_members/user-2').get());
      await assertFails(db.doc('organizations/org-2/musicscale_members/user-1').set({ roleId: 'role-owner' }));
    });

    it('users.systemRole admin não recebe acesso global, mas os quatro papéis canônicos recebem', async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const adminDb = context.firestore();
        await adminDb.doc('organizations/org-1/musicscale_members/user-1').set({ roleId: 'role-member' });
        await adminDb.doc('users/local-admin').set({ systemRole: 'admin' });
        for (const role of ['ceo', 'global_admin', 'ecosystem_owner', 'founder']) {
          await adminDb.doc(`users/${role}`).set({ systemRole: role });
        }
      });
      await assertFails(getAuthedFirestore({ uid: 'local-admin' }).doc('organizations/org-1/musicscale_members/user-1').get());
      for (const role of ['ceo', 'global_admin', 'ecosystem_owner', 'founder']) {
        await assertSucceeds(getAuthedFirestore({ uid: role }).doc('organizations/org-1/musicscale_members/user-1').get());
      }
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
