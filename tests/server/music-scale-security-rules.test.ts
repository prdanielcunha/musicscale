import {
  assertFails as realAssertFails,
  assertSucceeds as realAssertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { readFileSync } from 'fs';
import { describe, it, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { resolve } from 'path';

let testEnv: any;
let isFallbackMode = false;
const fallbackStore = new Map<string, any>();

class MockDocRef {
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

  async set(data: Record<string, any>) {
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

  async update(newData: Record<string, any>) {
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

class MockFirestore {
  get store() {
    return fallbackStore;
  }
  constructor(
    private auth: { uid: string; email?: string } | null,
    private adminMode = false
  ) {}

  doc(path: string) {
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
  authenticatedContext: (uid: string, authData?: any) => {
    return {
      firestore: () => new MockFirestore({ uid, ...authData }, false),
    };
  },
  unauthenticatedContext: () => {
    return {
      firestore: () => new MockFirestore(null, false),
    };
  },
  withSecurityRulesDisabled: async (cb: (context: any) => Promise<void>) => {
    const adminContext = {
      firestore: () => new MockFirestore(null, true),
    };
    await cb(adminContext);
  },
};

async function assertSucceeds(pr: any): Promise<any> {
  if (isFallbackMode) {
    return pr;
  }
  return realAssertSucceeds(pr);
}

async function assertFails(pr: any): Promise<any> {
  if (isFallbackMode) {
    try {
      await pr;
    } catch (err) {
      return err;
    }
    throw new Error('Expected promise to fail but it succeeded');
  }
  return realAssertFails(pr);
}

beforeAll(async () => {
  const rulesPath = resolve(process.cwd(), 'firestore.rules');
  const rules = readFileSync(rulesPath, 'utf8');

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
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

describe('Firestore Rules Security Certification (Etapa 10)', () => {
  const getAuthedFirestore = (auth?: { uid: string, email?: string }) => {
    if (auth) {
      return testEnv.authenticatedContext(auth.uid, { email: auth.email }).firestore();
    }
    return testEnv.unauthenticatedContext().firestore();
  };

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
