import { describe, expect, it, vi } from 'vitest';
import { createHmac } from 'node:crypto';
import {
  makeConnectScaleReceiptOutbox, recoverConnectScaleReceipts, safeConnectOutboxScope,
  type ConnectScaleReceiptOutbox,
} from '../../services/server/connect/durableScaleOutbox.js';

const start = Date.parse('2026-10-15T20:00:00.000Z');
const secret = 'synthetic-source-secret-32-chars-minimum-for-test';
const targets = JSON.stringify({ 'org-a': { recipientUid: 'verified-operator', conversationId: 'existing-thread' } });

function fakeDatabase(marker: ConnectScaleReceiptOutbox, org = 'org-a') {
  const receipt: Record<string, any> = {
    commandType: 'musicScale.publish', organizationId: org, entityId: 'scale-1',
    result: { version: marker.publishRevision }, connectOutbox: marker,
  };
  const scale = {
    organizationId: org, status: 'published', publishRevision: 7,
    updatedAt: { toDate: () => new Date(start - 5000) },
  };
  const query = { count: 0 };
  let cursor: any;
  const cursorRef = { kind: 'cursor', async get() { return { data: () => cursor }; } };
  function ref(kind: 'receipt' | 'scale') {
    return {
      kind,
      async get() { return {
        exists: true,
        data: () => kind === 'receipt' ? structuredClone(receipt) : scale,
      }; },
    };
  }
  const receiptRef = ref('receipt');
  const firestore: any = {
    collection(key: string) {
      if (key === 'scales') return { doc: (_id: string) => ref('scale') };
      if (key !== 'organizations') throw Error('unexpected collection');
      return { doc: (organizationId: string) => {
        expect(organizationId).toBe('org-a');
        return { collection: (name: string) => {
          expect(name).toBe('_commandReceipts');
          return {
            doc: () => cursorRef,
            where(field: string, op: string, states: string[]) {
              expect([field, op, states]).toEqual(['connectOutbox.state', 'in', ['pending','processing']]);
              return { orderBy() { return this; }, limit(n: number) {
                expect(n).toBeLessThanOrEqual(5);
                return { orderBy() { return this; }, startAfter() { return this; }, async get() {
                  query.count++;
                  return { docs: ['pending','processing'].includes(receipt.connectOutbox.state) ? [
                    { ref: receiptRef, id: 'receipt-1' },
                  ] : [] };
                } };
              } };
            },
          };
        } };
      } };
    },
    async runTransaction(fn: (tx: any) => Promise<unknown>) {
      return fn({
        get: (r: { get: () => Promise<unknown> }) => r.get(),
        set(_r: unknown, value: unknown) { cursor = value; },
        update(r: { kind: string }, patch: Record<string, any>) {
          expect(r.kind).toBe('receipt');
          for (const [path, value] of Object.entries(patch)) {
            const [parent, field] = path.split('.');
            expect(parent).toBe('connectOutbox');
            receipt.connectOutbox[field] = value;
          }
        },
      });
    },
  };
  return { firestore, receipt, query };
}

describe('MusicScale Connect durable receipt outbox', () => {
  it('has zero receipt writes when feature flag is disabled', () => {
    expect(makeConnectScaleReceiptOutbox({
      enabled: false, musicScaleId: 'scale-1', publishRevision: 7, createdResponseCount: 4,
    })).toBeUndefined();
  });

  it('models publication and presence from the same canonical transaction receipt', () => {
    const marker = makeConnectScaleReceiptOutbox({
      enabled: true, musicScaleId: 'scale-1', publishRevision: 7, createdResponseCount: 4,
    });
    expect(marker).toMatchObject({
      state: 'pending', schemaVersion: 1, publishRevision: 7, attempts: 0, delivered: [],
      triggers: ['scale.published', 'scale.presence_pending'],
    });
    expect(makeConnectScaleReceiptOutbox({
      enabled: true, musicScaleId: 'scale-2', publishRevision: 1, createdResponseCount: 0,
    })?.triggers).toEqual(['scale.published']);
  });

  it('refuses missing or unsafe org→operator mapping before touching database', async () => {
    expect(safeConnectOutboxScope('org-a', targets)).toBe(true);
    for (const mapping of [undefined, '{}', '{"org-a":{"conversationId":"../bad","recipientUid":"someone"}}']) {
      expect(safeConnectOutboxScope('org-a', mapping)).toBe(false);
    }
    const input = fakeDatabase(makeConnectScaleReceiptOutbox({
      enabled: true, musicScaleId: 'scale-1', publishRevision: 7, createdResponseCount: 0,
    })!);
    expect(await recoverConnectScaleReceipts({
      enabled: true, organizationId: 'org-b', signingSecret: secret, targetsJson: targets, db: input.firestore,
    })).toMatchObject({ scanned: 0 });
    expect(input.query.count).toBe(0);
  });

  it('sends only opaque signed events and commits both acknowledgements', async () => {
    const db = fakeDatabase(makeConnectScaleReceiptOutbox({
      enabled: true, musicScaleId: 'scale-1', publishRevision: 7, createdResponseCount: 3,
    })!);
    const payloads: any[] = [];
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const headers = init!.headers as Record<string, string>;
      const body = String(init!.body);
      expect(headers['x-connect-signature']).toBe(createHmac('sha256', secret)
        .update('musicscale\n' + headers['x-connect-timestamp'] + '\n' + body).digest('hex'));
      const data = JSON.parse(body);
      expect(JSON.stringify(data)).not.toContain('songIds');
      expect(JSON.stringify(data)).not.toContain('phone');
      payloads.push(data);
      return new Response(JSON.stringify({ accepted: true, duplicate: false }), { status: 202 });
    });
    expect(await recoverConnectScaleReceipts({
      enabled: true, organizationId: 'org-a', signingSecret: secret, targetsJson: targets,
      db: db.firestore, fetchImpl: fetchImpl as typeof fetch, now: () => start,
    })).toMatchObject({ scanned: 1, completed: 1, review: 0 });
    expect(payloads.map(x => x.trigger)).toEqual(['scale.published', 'scale.presence_pending']);
    expect(db.receipt.connectOutbox).toMatchObject({ state: 'complete', attempts: 1,
      delivered: ['scale.published', 'scale.presence_pending'] });
    expect(await recoverConnectScaleReceipts({
      enabled: true, organizationId: 'org-a', signingSecret: secret, targetsJson: targets,
      db: db.firestore, fetchImpl: fetchImpl as typeof fetch, now: () => start,
    })).toMatchObject({ scanned: 0 });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('preserves first ack across later failure and only retries unfinished trigger', async () => {
    const db = fakeDatabase(makeConnectScaleReceiptOutbox({
      enabled: true, musicScaleId: 'scale-1', publishRevision: 7, createdResponseCount: 1,
    })!);
    let clock = start, calls = 0;
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      calls++;
      if (calls === 2) throw Error('network ambiguity');
      return new Response(JSON.stringify({ accepted: true, duplicate: calls === 3 }), { status: 202 });
    });
    const args = { enabled: true, organizationId: 'org-a', signingSecret: secret, targetsJson: targets,
      db: db.firestore, fetchImpl: fetchImpl as typeof fetch, now: () => clock };
    expect((await recoverConnectScaleReceipts(args)).pending).toBe(1);
    expect(db.receipt.connectOutbox).toMatchObject({ state: 'pending', attempts: 1,
      delivered: ['scale.published'] });
    clock += 70000;
    expect((await recoverConnectScaleReceipts(args)).completed).toBe(1);
    expect(db.receipt.connectOutbox).toMatchObject({ state: 'complete', attempts: 2,
      delivered: ['scale.published', 'scale.presence_pending'] });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('never emits superseded revisions and requires human review', async () => {
    const db = fakeDatabase(makeConnectScaleReceiptOutbox({
      enabled: true, musicScaleId: 'scale-1', publishRevision: 8, createdResponseCount: 0,
    })!);
    const fetchImpl = vi.fn();
    expect((await recoverConnectScaleReceipts({
      enabled: true, organizationId: 'org-a', signingSecret: secret, targetsJson: targets,
      db: db.firestore, fetchImpl: fetchImpl as typeof fetch, now: () => start,
    })).review).toBe(1);
    expect(db.receipt.connectOutbox.state).toBe('needs_review');
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

// Query-aware fixture: exercising cursor movement, not a fixed returned page.
function pagedDatabase() {
  const rows = new Map<string, any>();
  const ref = (id: string) => ({ id, async get() { return { data: () => structuredClone(rows.get(id)) }; } });
  const collection: any = {
    doc: ref,
    where: () => {
      let after = '', take = 5;
      const query: any = {
        orderBy: () => query, limit(n: number) { take = n; return query; },
        startAfter(id: string) { after = id; return query; },
        async get() { return { docs: [...rows.keys()].sort().filter(id => id > after &&
          ['pending', 'processing'].includes(rows.get(id)?.connectOutbox?.state))
          .slice(0, take).map(id => ({ id, ref: ref(id) })) }; },
      };
      return query;
    },
  };
  const firestore: any = {
    collection: (name: string) => {
      expect(name).toBe('organizations');
      return { doc: (id: string) => {
        expect(id).toBe('org-a');
        return { collection: (key: string) => { expect(key).toBe('_commandReceipts'); return collection; } };
      } };
    },
    async runTransaction(fn: any) {
      return fn({ get: (r: any) => r.get(),
        set: (r: any, data: any) => rows.set(r.id, data),
        update: (r: any, patch: any) => {
          const data = rows.get(r.id);
          for (const [key, value] of Object.entries(patch)) data.connectOutbox[key.split('.')[1]] = value;
        },
      });
    },
  };
  return { rows, firestore };
}

it('crosses arbitrarily many blocked pages, survives process restart and wraps', async () => {
  const db = pagedDatabase();
  for (let i = 0; i < 13; i++) {
    db.rows.set(String(i).padStart(2, '0'), {
      organizationId: 'org-a', commandType: 'musicScale.publish', entityId: 'scale-1', result: { version: 7 },
      connectOutbox: { ...makeConnectScaleReceiptOutbox({ enabled: true, musicScaleId: 'scale-1', publishRevision: 7,
        createdResponseCount: 0 }), retryAt: new Date(start + 3600000).toISOString() },
    });
  }
  // A later eligible row is terminal without needing any network/scale reads.
  db.rows.get('12').connectOutbox.attempts = 3;
  db.rows.get('12').connectOutbox.retryAt = '';
  const run = () => recoverConnectScaleReceipts({ enabled: true, organizationId: 'org-a', signingSecret: secret,
    targetsJson: targets, now: () => start, db: db.firestore, limit: 5 });
  expect((await run()).scanned).toBe(5);
  expect((await run()).scanned).toBe(5);
  expect((await run()).scanned).toBe(3);
  expect(db.rows.get('12').connectOutbox.state).toBe('needs_review');
  expect((await run()).scanned).toBe(0);
  expect(db.rows.get('_connectRecoveryCursorV1').after).toBe('');
  expect((await run()).scanned).toBe(5);
});

it('does not reclaim an active lease, and recovers expired exhausted leases', async () => {
  const db = pagedDatabase();
  db.rows.set('00', { organizationId: 'org-a', commandType: 'musicScale.publish', entityId: 'scale-1',
    result: { version: 7 }, connectOutbox: {
      ...makeConnectScaleReceiptOutbox({ enabled: true, musicScaleId: 'scale-1', publishRevision: 7, createdResponseCount: 0 }),
      state: 'processing', attempts: 3, leaseToken: 'crashed-worker', leaseUntil: new Date(start + 30000).toISOString(),
    } });
  const run = (now: number) => recoverConnectScaleReceipts({ enabled: true, organizationId: 'org-a', signingSecret: secret,
    targetsJson: targets, now: () => now, db: db.firestore, limit: 5 });
  await run(start);
  expect(db.rows.get('00').connectOutbox.state).toBe('processing');
  await run(start + 31000); // wrap
  await run(start + 31000);
  expect(db.rows.get('00').connectOutbox.state).toBe('needs_review');
});
