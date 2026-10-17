import '../../firebaseAdmin.js';
import { runIndependentScaleRecovery } from './independentScaleRecovery.js';

try {
  const result = await runIndependentScaleRecovery({
    enabled: process.env.MUSICSCALE_CONNECT_SCALE_PUBLISHED_EVENTS_ENABLED === 'true',
    signingSecret: process.env.MUSICSCALE_CONNECT_SOURCE_EVENT_SECRET,
    targetsJson: process.env.MUSICSCALE_CONNECT_OPERATOR_TARGETS_JSON,
  });
  // Counts only: never log tenant, scale, recipients, payloads or credentials.
  console.info(JSON.stringify({ event: 'connect_source_recovery', source: 'musicscale', ...result }));
  if (result.failures) process.exitCode = 1;
} catch {
  console.error('CONNECT_SOURCE_RECOVERY_CONFIGURATION_OR_RUNTIME_FAILED');
  process.exitCode = 1;
}
