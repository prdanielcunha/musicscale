const fs = require('fs');
const file = 'tests/server/music-scale-command-service.test.ts';
let code = fs.readFileSync(file, 'utf8');

const newMock = `
const dbState = new Map<string, unknown>();

export class TestTransactionEmulator {
  reads: string[] = [];
  writes: Array<{ type: 'set' | 'update' | 'delete', path: string, data?: Record<string, unknown> }> = [];
  
  constructor(private state: Map<string, unknown>) {}

  async get(ref: any) {
    if (this.writes.length > 0) {
      throw new Error("READ_AFTER_WRITE");
    }
    this.reads.push(ref.path);
    const data = this.state.get(ref.path);
    if (data) {
      return { exists: true, data: () => data, id: ref.id, ref };
    }
    return { exists: false, data: () => undefined, id: ref.id, ref };
  }

  set(ref: any, data: any) {
    this.writes.push({ type: 'set', path: ref.path, data });
  }

  update(ref: any, data: any) {
    this.writes.push({ type: 'update', path: ref.path, data });
  }

  commit() {
    for (const write of this.writes) {
      if (write.type === 'set') {
        this.state.set(write.path, write.data);
      } else if (write.type === 'update') {
        const existing = this.state.get(write.path) as Record<string, unknown> || {};
        this.state.set(write.path, { ...existing, ...write.data });
      }
    }
  }
}

let transactionMutex = Promise.resolve();

const mockDb = {
  runTransaction: vi.fn(async (callback: any) => {
    return new Promise((resolve, reject) => {
      transactionMutex = transactionMutex.then(async () => {
        try {
          const t = new TestTransactionEmulator(dbState);
          const result = await callback(t);
          t.commit();
          resolve(result);
        } catch (e) {
          reject(e);
        }
      });
    });
  }),
  collection: vi.fn((path) => ({
    doc: vi.fn((id) => ({ id, path: \`\${path}/\${id}\`, collection: mockDb.collection })),
    where: vi.fn(() => ({
      get: vi.fn(),
    })),
  })),
};
`;

code = code.replace(/const mockTransactionUpdate.*};/s, newMock);
fs.writeFileSync(file, code);
