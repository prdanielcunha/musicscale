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
            where(field: string, op: string, states: string[]) {
              expect([field, op, states]).toEqual(['connectOutbox.state', 'in', ['pending','processing']]);
              return { limit(n: number) {
                expect(n).toBeLessThanOrEqual(5);
                return { async get() {
                  query.count++;
                  return { docs: ['pending','processing'].includes(receipt.connectOutbox.state) ? [
                    { ref: receiptRef },
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
