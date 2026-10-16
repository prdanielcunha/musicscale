import { describe, expect, it, vi } from 'vitest';
import { runIndependentScaleRecovery } from '../../services/server/connect/independentScaleRecovery.js';
const secret = 'synthetic-worker-source-secret-32-characters';
const targetsJson = JSON.stringify(Object.fromEntries(['org-a', 'org-b'].map(id => [id,
  { recipientUid: 'synthetic-operator', conversationId: 'synthetic-thread' }])));

describe('independent source recovery', () => {
  it('default-off performs no recovery or scope lookup', async () => {
    const recover = vi.fn();
    expect(await runIndependentScaleRecovery({ enabled: false, recover })).toMatchObject({ tenants: 0 });
    expect(recover).not.toHaveBeenCalled();
  });
  it('fails closed on missing/invalid server-owned configuration', async () => {
    const recover = vi.fn();
    for (const config of [undefined, '{}', '[]', '{"org-a":{"conversationId":"x","recipientUid":"../bad"}}']) {
      await expect(runIndependentScaleRecovery({ enabled: true, signingSecret: secret, targetsJson: config, recover }))
        .rejects.toThrow('CONNECT_RECOVERY_NOT_CONFIGURED');
    }
    expect(recover).not.toHaveBeenCalled();
  });
  it('continues the next tenant after a storage failure without exposing identifiers in metrics', async () => {
    const recover = vi.fn().mockRejectedValueOnce(Error('synthetic-storage-error'))
      .mockResolvedValueOnce({ scanned: 3, completed: 1, pending: 1, review: 1 });
    const result = await runIndependentScaleRecovery({ enabled: true, signingSecret: secret, targetsJson, recover });
    expect(recover.mock.calls.map(([arg]) => arg.organizationId)).toEqual(['org-a', 'org-b']);
    expect(result).toEqual({ enabled: true, tenants: 2, failures: 1, scanned: 3, completed: 1, pending: 1, review: 1 });
    expect(JSON.stringify(result)).not.toContain('org-');
  });
});
