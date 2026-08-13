import { describe, expect, it, vi } from 'vitest';
import { HubJoinRequestAdapter, HubJoinRequestError } from '../../services/server/hubJoinRequestAdapter';

const response = (status: number, body: any, invalidJson = false) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => {
    if (invalidJson) throw new Error('invalid json');
    return body;
  }
}) as Response;

describe('02C Hub join-request adapter', () => {
  it('forwards exact bearer and canonical create path with empty non-authoritative body', async () => {
    const fetcher = vi.fn(async (url, init) => {
      expect(url).toBe('https://hub.example/api/v1/organizations/org-1/join-requests');
      expect(init?.method).toBe('POST');
      expect(init?.headers).toEqual({ 'content-type': 'application/json', authorization: 'Bearer exact-token' });
      expect(JSON.parse(String(init?.body))).toEqual({});
      return response(201, { success: true, reasonCode: 'JOIN_REQUEST_CREATED', requestId: 'requester-1', generation: 1 });
    });
    await expect(new HubJoinRequestAdapter({ origin: 'https://hub.example', fetch: fetcher as any })
      .create('Bearer exact-token', 'org-1'))
      .resolves.toEqual({ success: true, reasonCode: 'JOIN_REQUEST_CREATED', organizationId: 'org-1', requestId: 'requester-1', generation: 1 });
  });

  it.each([
    ['approve', '/api/v1/organizations/org-1/join-requests/requester-1/approve', 'JOIN_REQUEST_APPROVED'],
    ['reject', '/api/v1/organizations/org-1/join-requests/requester-1/reject', 'JOIN_REQUEST_REJECTED']
  ] as const)('forwards %s to exact Hub path', async (command, path, reasonCode) => {
    const fetcher = vi.fn(async (url, init) => {
      expect(url).toBe(`https://hub.example${path}`);
      expect((init?.headers as any).authorization).toBe('Bearer actor-token');
      return response(200, { success: true, reasonCode, generation: 2 });
    });
    const adapter = new HubJoinRequestAdapter({ origin: 'https://hub.example', fetch: fetcher as any });
    const result = command === 'approve'
      ? await adapter.approve('Bearer actor-token', 'org-1', 'requester-1')
      : await adapter.reject('Bearer actor-token', 'org-1', 'requester-1');
    expect(result).toMatchObject({ success: true, reasonCode, organizationId: 'org-1', requestId: 'requester-1', generation: 2 });
  });

  it('accepts idempotent create and resolution success contracts', async () => {
    const pending = new HubJoinRequestAdapter({ origin: 'https://hub.example', fetch: vi.fn(async () => response(200, { success: true, reasonCode: 'ALREADY_PENDING', requestId: 'u1', generation: 3 })) as any });
    await expect(pending.create('Bearer x', 'org-1')).resolves.toMatchObject({ reasonCode: 'ALREADY_PENDING', requestId: 'u1', generation: 3 });

    const member = new HubJoinRequestAdapter({ origin: 'https://hub.example', fetch: vi.fn(async () => response(200, { success: true, reasonCode: 'ALREADY_MEMBER' })) as any });
    await expect(member.create('Bearer x', 'org-1')).resolves.toEqual({ success: true, reasonCode: 'ALREADY_MEMBER', organizationId: 'org-1' });

    const approved = new HubJoinRequestAdapter({ origin: 'https://hub.example', fetch: vi.fn(async () => response(200, { success: true, reasonCode: 'ALREADY_APPROVED', generation: 1 })) as any });
    await expect(approved.approve('Bearer x', 'org-1', 'u1')).resolves.toMatchObject({ reasonCode: 'ALREADY_APPROVED' });
  });

  it.each([
    { success: false, reasonCode: 'JOIN_REQUEST_CREATED', requestId: 'u1', generation: 1 },
    { success: true, reasonCode: 'UNKNOWN', requestId: 'u1', generation: 1 },
    { success: true, reasonCode: 'JOIN_REQUEST_CREATED', requestId: '../bad', generation: 1 },
    { success: true, reasonCode: 'JOIN_REQUEST_CREATED', requestId: 'u1', generation: 0 }
  ])('rejects malformed create success as ambiguous 502', async payload => {
    const adapter = new HubJoinRequestAdapter({ origin: 'https://hub.example', fetch: vi.fn(async () => response(200, payload)) as any });
    await expect(adapter.create('Bearer x', 'org-1')).rejects.toMatchObject({ status: 502, reasonCode: 'INVALID_HUB_RESPONSE', ambiguous: true });
  });

  it('rejects invalid JSON as ambiguous 502', async () => {
    const adapter = new HubJoinRequestAdapter({ origin: 'https://hub.example', fetch: vi.fn(async () => response(200, {}, true)) as any });
    await expect(adapter.create('Bearer x', 'org-1')).rejects.toMatchObject({ status: 502, reasonCode: 'INVALID_HUB_RESPONSE', ambiguous: true });
  });

  it.each([[500, 'INTERNAL_ERROR'], [503, 'MEMBER_LIMIT_UNAVAILABLE']])('preserves Hub %s failure and marks server errors ambiguous', async (status, reasonCode) => {
    const adapter = new HubJoinRequestAdapter({ origin: 'https://hub.example', fetch: vi.fn(async () => response(status as number, { reasonCode })) as any });
    await expect(adapter.create('Bearer x', 'org-1')).rejects.toMatchObject({ status, reasonCode, ambiguous: true });
  });

  it('network failure fails closed without fallback', async () => {
    const adapter = new HubJoinRequestAdapter({ origin: 'https://hub.example', fetch: vi.fn(async () => { throw new Error('network'); }) as any });
    await expect(adapter.create('Bearer x', 'org-1')).rejects.toMatchObject({ status: 503, reasonCode: 'HUB_UNAVAILABLE', ambiguous: true });
  });

  it('rejects invalid path ids and missing bearer before network access', async () => {
    const fetcher = vi.fn();
    const adapter = new HubJoinRequestAdapter({ origin: 'https://hub.example', fetch: fetcher as any });
    await expect(adapter.create('', 'org-1')).rejects.toBeInstanceOf(HubJoinRequestError);
    await expect(adapter.approve('Bearer x', '../org', 'u1')).rejects.toMatchObject({ status: 400 });
    await expect(adapter.reject('Bearer x', 'org-1', '../u')).rejects.toMatchObject({ status: 400 });
    expect(fetcher).not.toHaveBeenCalled();
  });
});
