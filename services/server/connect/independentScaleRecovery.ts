import { safeConnectOutboxScope, recoverConnectScaleReceipts } from './durableScaleOutbox.js';

/** Server-owned allowlist only. All mapped tenants receive one bounded page,
 * including after a previous tenant fails. No browser or event supplies scope. */
export async function runIndependentScaleRecovery(options: {
  enabled: boolean;
  signingSecret?: string;
  targetsJson?: string;
  recover?: typeof recoverConnectScaleReceipts;
}) {
  const totals = { enabled: options.enabled, tenants: 0, failures: 0,
    scanned: 0, completed: 0, review: 0, pending: 0 };
  if (!options.enabled) return totals;
  if (!options.signingSecret || options.signingSecret.length < 32 || options.signingSecret.length > 4096 ||
      !options.targetsJson || options.targetsJson.length > 16000) throw Error('CONNECT_RECOVERY_NOT_CONFIGURED');
  let mapping: unknown;
  try { mapping = JSON.parse(options.targetsJson); } catch { throw Error('CONNECT_RECOVERY_NOT_CONFIGURED'); }
  if (!mapping || typeof mapping !== 'object' || Array.isArray(mapping)) throw Error('CONNECT_RECOVERY_NOT_CONFIGURED');
  const tenants = Object.keys(mapping).sort();
  if (!tenants.length || tenants.length > 100 ||
      tenants.some(id => !safeConnectOutboxScope(id, options.targetsJson))) throw Error('CONNECT_RECOVERY_NOT_CONFIGURED');
  for (const organizationId of tenants) {
    totals.tenants++;
    try {
      const result = await (options.recover ?? recoverConnectScaleReceipts)({
        enabled: true, organizationId, signingSecret: options.signingSecret,
        targetsJson: options.targetsJson, limit: 5,
      });
      for (const key of ['scanned', 'completed', 'review', 'pending'] as const) totals[key] += result[key];
    } catch { totals.failures++; }
  }
  return totals;
}
