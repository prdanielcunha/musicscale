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
    expect(await isVerifiedGlobalCurationOptOut({ createdBy: { uid: 'u1' } }, db)).toBe(false);
    expect(get).not.toHaveBeenCalled();
  });

  it('ignores member attempts to opt out, even if they submit a hidden flag', async () => {
    const { db } = dbFor({ systemRole: 'member' });
    expect(await isVerifiedGlobalCurationOptOut({
      globalCurationOptOut: true, createdBy: { uid: 'member1' }
    }, db)).toBe(false);
  });

  it('honors opt-out only with an authoritative privileged user document', async () => {
    const { db, doc } = dbFor({ systemRole: 'ecosystem_support' });
    expect(await isVerifiedGlobalCurationOptOut({
      globalCurationOptOut: true, createdBy: { uid: 'support1' }
    }, db)).toBe(true);
    expect(doc).toHaveBeenCalledWith('support1');
  });

  it('does not honor claimed global role without a verified user record', async () => {
    const { db } = dbFor({ systemRole: 'ceo' }, false);
    expect(await isVerifiedGlobalCurationOptOut({
      globalCurationOptOut: true, createdBy: { uid: 'fake' }
    }, db)).toBe(false);
  });
});
