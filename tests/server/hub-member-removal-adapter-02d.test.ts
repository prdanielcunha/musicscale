import { describe, expect, it, vi } from 'vitest';
import { HubMemberRemovalAdapter, HubMemberRemovalError } from '../../services/server/hubMemberRemovalAdapter';

const response = (status: number, body: any, jsonThrows = false) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => { if (jsonThrows) throw new Error('bad json'); return body; }
}) as Response;

const valid = (overrides: any = {}) => ({
  success: true,
  reasonCode: 'MEMBER_REMOVED',
  organizationId: 'org-1',
  memberId: 'member-1',
  activeOrganizationId: 'org-2',
  primaryOrganizationId: 'org-2',
  ...overrides
});

describe('02D Hub member-removal adapter', () => {
  it('forwards exact Bearer with DELETE and no client authority body', async () => {
    const fetcher = vi.fn(async (url, init) => {
      expect(url).toBe('https://hub.example/api/v1/organizations/org-1/members/member-1');
      expect(init?.method).toBe('DELETE');
      expect(init?.headers).toEqual({ authorization: 'Bearer exact-token' });
      expect(init?.body).toBeUndefined();
      return response(200, valid());
    });
    const result = await new HubMemberRemovalAdapter({ origin: 'https://hub.example', fetch: fetcher as any })
      .remove('Bearer exact-token', 'org-1', 'member-1');
    expect(result).toMatchObject(valid());
  });

  it.each(['', 'token', 'Bearer '])('rejects invalid bearer %s', async bearer => {
    await expect(new HubMemberRemovalAdapter({ origin: 'https://hub.example' }).remove(bearer, 'org-1', 'member-1'))
      .rejects.toMatchObject({ status: 401, reasonCode: 'UNAUTHORIZED' });
  });

  it.each([
    ['../bad', 'member-1'], ['org-1', '../bad'], ['', 'member-1'], ['org-1', '']
  ])('rejects unsafe ids', async (org, member) => {
    await expect(new HubMemberRemovalAdapter({ origin: 'https://hub.example' }).remove('Bearer x', org, member))
      .rejects.toMatchObject({ status: 400, reasonCode: 'INVALID_REQUEST_PATH' });
  });

  it.each([
    valid(),
    valid({ reasonCode: 'ALREADY_REMOVED', activeOrganizationId: null, primaryOrganizationId: null })
  ])('accepts canonical success contract %#', async payload => {
    const adapter = new HubMemberRemovalAdapter({ origin: 'https://hub.example', fetch: vi.fn(async () => response(200, payload)) as any });
    await expect(adapter.remove('Bearer x', 'org-1', 'member-1')).resolves.toMatchObject(payload);
  });

  it.each([
    ['success false', { success: false }],
    ['wrong reason', valid({ reasonCode: 'OTHER' })],
    ['wrong org', valid({ organizationId: 'org-2' })],
    ['wrong member', valid({ memberId: 'member-2' })],
    ['unsafe active org', valid({ activeOrganizationId: '../bad' })],
    ['unsafe primary org', valid({ primaryOrganizationId: '../bad' })]
  ])('rejects malformed Hub success: %s', async (_label, payload) => {
    const adapter = new HubMemberRemovalAdapter({ origin: 'https://hub.example', fetch: vi.fn(async () => response(200, payload)) as any });
    await expect(adapter.remove('Bearer x', 'org-1', 'member-1'))
      .rejects.toMatchObject({ status: 502, reasonCode: 'INVALID_HUB_RESPONSE', ambiguous: true });
  });

  it('rejects invalid JSON fail closed', async () => {
    const adapter = new HubMemberRemovalAdapter({ origin: 'https://hub.example', fetch: vi.fn(async () => response(200, {}, true)) as any });
    await expect(adapter.remove('Bearer x', 'org-1', 'member-1'))
      .rejects.toMatchObject({ status: 502, reasonCode: 'INVALID_HUB_RESPONSE', ambiguous: true });
  });

  it.each([[401, 'UNAUTHENTICATED'], [403, 'PERMISSION_DENIED'], [409, 'OWNER_REMOVAL_REQUIRES_TRANSFER']])
  ('preserves deterministic Hub denial %s %s', async (status, reasonCode) => {
    const adapter = new HubMemberRemovalAdapter({ origin: 'https://hub.example', fetch: vi.fn(async () => response(status as number, { reasonCode })) as any });
    await expect(adapter.remove('Bearer x', 'org-1', 'member-1'))
      .rejects.toMatchObject({ status, reasonCode, ambiguous: false });
  });

  it.each([[500, 'INTERNAL_ERROR'], [502, 'BAD_GATEWAY'], [503, 'UNAVAILABLE'], [504, 'TIMEOUT']])
  ('marks Hub %s as ambiguous fail-closed', async (status, reasonCode) => {
    const adapter = new HubMemberRemovalAdapter({ origin: 'https://hub.example', fetch: vi.fn(async () => response(status as number, { reasonCode })) as any });
    await expect(adapter.remove('Bearer x', 'org-1', 'member-1'))
      .rejects.toMatchObject({ status, reasonCode, ambiguous: true });
  });

  it('marks network failure ambiguous and never invents success', async () => {
    const adapter = new HubMemberRemovalAdapter({ origin: 'https://hub.example', fetch: vi.fn(async () => { throw new Error('network'); }) as any });
    const error = await adapter.remove('Bearer x', 'org-1', 'member-1').catch(value => value);
    expect(error).toBeInstanceOf(HubMemberRemovalError);
    expect(error).toMatchObject({ status: 503, reasonCode: 'HUB_UNAVAILABLE', ambiguous: true });
  });
});
