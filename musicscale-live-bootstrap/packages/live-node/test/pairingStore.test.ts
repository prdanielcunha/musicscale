import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PairingStore } from '../src/pairingStore';

describe('PairingStore', () => {
  it('pairs once, persists only the token hash, and restores authorization', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ms-live-pairing-'));
    const path = join(dir, 'pairings.json');
    const store = new PairingStore(path, 'node_test');

    const challenge = await store.createChallenge({
      organizationId: 'org_1',
      venueId: 'venue_1',
      liveSystemId: 'system_1',
      deviceId: 'ipad_1',
      deviceName: 'iPad altar'
    });

    const completed = await store.complete(
      challenge.challengeId,
      challenge.pin,
      'ipad_1',
      'iPad altar'
    );

    expect(completed.token.length).toBeGreaterThan(20);
    expect((await store.authorize(completed.token))?.organizationId).toBe('org_1');

    const persisted = await readFile(path, 'utf8');
    expect(persisted).not.toContain(completed.token);

    const restored = new PairingStore(path, 'node_test');
    expect((await restored.authorize(completed.token))?.deviceId).toBe('ipad_1');
  });

  it('rejects a wrong PIN and can revoke a paired device', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ms-live-pairing-'));
    const store = new PairingStore(join(dir, 'pairings.json'), 'node_test');
    const challenge = await store.createChallenge({
      organizationId: 'org_1',
      venueId: 'venue_1',
      liveSystemId: 'system_1',
      deviceId: 'device_1',
      deviceName: 'Control'
    });

    const wrongPin = challenge.pin === '000000' ? '000001' : '000000';
    await expect(
      store.complete(challenge.challengeId, wrongPin, 'device_1', 'Control')
    ).rejects.toThrow('pairing_pin_invalid');

    const completed = await store.complete(
      challenge.challengeId,
      challenge.pin,
      'device_1',
      'Control'
    );
    expect(await store.revoke('device_1')).toBe(true);
    expect(await store.authorize(completed.token)).toBeNull();
  });
  it('locks an active Node binding to one environment', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ms-live-pairing-'));
    const store = new PairingStore(join(dir, 'pairings.json'), 'node_test');

    const first = await store.createChallenge({
      organizationId: 'org_a',
      venueId: 'venue_a',
      liveSystemId: 'system_a',
      deviceId: 'device_a',
      deviceName: 'Console A'
    });
    await store.complete(first.challengeId, first.pin, 'device_a', 'Console A');

    await expect(store.createChallenge({
      organizationId: 'org_b',
      venueId: 'venue_b',
      liveSystemId: 'system_b',
      deviceId: 'device_b',
      deviceName: 'Console B'
    })).rejects.toThrow('pairing_scope_conflict');
  });
});
