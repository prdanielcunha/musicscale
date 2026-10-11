import { describe, expect, it, vi } from 'vitest';
import {
  canOptOutOfGlobalCuration,
  isVerifiedGlobalCurationOptOut
} from '../../services/server/globalCurationPolicy.js';

const dbFor = (profile: unknown, exists = true) => {
  const get = vi.fn(async () => ({ exists, data: () => profile }));
  const doc = vi.fn(() => ({ get }));
  return { db: { collection: vi.fn(() => ({ doc })) }, get, doc };
};

describe('mandatory global curation with verified privileged opt-out', () => {
  it('never honors tenant owner/admin role as an ecosystem override', () => {
    expect(canOptOutOfGlobalCuration({ role: 'admin', organizationRole: 'owner' })).toBe(false);
    expect(canOptOutOfGlobalCuration({ systemRole: 'member' })).toBe(false);
    expect(canOptOutOfGlobalCuration({ globalRole: 'musician' })).toBe(false);
  });

  it.each(['ceo', 'admin', 'global_admin', 'ecosystem_owner', 'founder', 'ecosystem_support'])(
    'recognizes a verified global role: %s', role => {
      expect(canOptOutOfGlobalCuration({ ecosystemRole: role })).toBe(true);
    }
  );

  it('defaults every new song to global curation without database lookups', async () => {
    const { db, get } = dbFor({});
    expect(await isVerifiedGlobalCurationOptOut({ createdBy: { uid: 'u1' } }, 'song1', db)).toBe(false);
    expect(get).not.toHaveBeenCalled();
  });

  it('ignores a member flag without a server-issued exemption', async () => {
    const { db } = dbFor({ systemRole: 'member' }, false);
    expect(await isVerifiedGlobalCurationOptOut({
      globalCurationOptOut: true, organizationId: 'org1', createdBy: { uid: 'member1' }
    }, 'song1', db)).toBe(false);
  });

  it('requires the exemption to match the actual song creator and organization', async () => {
    const { db } = dbFor({ userId: 'someoneElse', organizationId: 'org1' });
    expect(await isVerifiedGlobalCurationOptOut({
      globalCurationOptOut: true, organizationId: 'org1', createdBy: { uid: 'support1' }
    }, 'song1', db)).toBe(false);
  });

  it('accepts a server-issued exemption for the precise song, creator and organization', async () => {
    const { db, doc } = dbFor({ userId: 'support1', organizationId: 'org1' });
    expect(await isVerifiedGlobalCurationOptOut({
      globalCurationOptOut: true, organizationId: 'org1', createdBy: { uid: 'support1' }
    }, 'song1', db)).toBe(true);
    expect(doc).toHaveBeenCalledWith('song1');
  });
});
