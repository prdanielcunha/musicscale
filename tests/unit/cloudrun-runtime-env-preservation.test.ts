import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
describe('Cloud Run production runtime configuration preservation', () => {
  const workflow = readFileSync('.github/workflows/cloudrun-private-deploy.yml', 'utf8');
  it('preserves unrelated environment variables and secret bindings during deployment', () => {
    expect(workflow).toContain('--update-env-vars');
    expect(workflow).toContain('--update-secrets');
    expect(workflow).not.toContain('--set-env-vars');
    expect(workflow).not.toContain('--clear-env-vars');
    expect(workflow).not.toContain('--set-secrets');
    expect(workflow).not.toContain('--clear-secrets');
  });
  it('continues explicitly protecting AI cost controls and authenticated API', () => {
    expect(workflow).toContain('AI_IMPORT_FINOPS_WRITE_PATH_ENABLED=false');
    expect(workflow).toContain('AI_IMPORT_FINOPS_READ_PATH_ENABLED=false');
    expect(workflow).toContain('AI_FINOPS_DIAGNOSTICS_ENABLED=false');
    // The existing service access policy must remain byte-for-byte unchanged.
    // The old deploy flag and subsequent allUsers grant could mutate IAM.
    expect(workflow).toContain('Snapshot existing Cloud Run IAM (read-only)');
    expect(workflow).toContain('MUSICSCALE_IAM_UNCHANGED_OK');
    expect(workflow).not.toContain('--allow-unauthenticated');
    expect(workflow).not.toContain('--no-allow-unauthenticated');
    expect(workflow).not.toContain('add-iam-policy-binding');
    expect(workflow).toContain('STRIPE_SECRET_KEY=musicscale-stripe-secret-key:latest');
  });
});
