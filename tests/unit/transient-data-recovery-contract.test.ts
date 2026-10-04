import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => fs.readFileSync(path, 'utf8');

describe('transient data recovery hotfix', () => {
  it('retries only transient Firestore failures and never permission failures', () => {
    const source = read('hooks/useMusicData.ts');
    expect(source).toContain("'unavailable'");
    expect(source).toContain("'deadline-exceeded'");
    expect(source).toContain("'resource-exhausted'");
    expect(source).not.toContain("transientCodes.add('permission-denied')");
    expect(source).not.toContain("transientCodes.add('unauthenticated')");
    expect(source).toContain('attempt < 3');
    expect(source).toContain('12000');
  });

  it('recovers bootstrap and canonical context only from transient failures', () => {
    const source = read('contexts/EcosystemContext.tsx');
    expect(source).toContain('withTransientEcosystemRetry');
    expect(source).toContain("'unavailable'");
    expect(source).toContain("'deadline-exceeded'");
    expect(source).not.toContain("ECOSYSTEM_TRANSIENT_FIRESTORE_CODES.add('permission-denied')");
    expect(source).toContain('user.getIdToken(attempt > 0)');
    expect(source).toContain('apiRes.status === 429 || apiRes.status >= 500');
    expect(source).toContain('apiRes.status === 401');
    expect(source).toContain('attempt < 2');
    expect(source).toContain('ecosystem_degraded_recovered_ms');
    expect(source).toContain('const delays = [1200, 3500, 8000]');
    expect(source).toContain('setIsDegraded(false)');
  });

  it('does not redeploy Cloud Run for frontend-only production changes', () => {
    const workflow = read('.github/workflows/cloudrun-private-deploy.yml');
    expect(workflow).toContain('paths:');
    expect(workflow).toContain("- 'server.ts'");
    expect(workflow).toContain("- 'services/server/**'");
    expect(workflow).not.toContain('paths-ignore:');
    expect(workflow).toContain("- 'ops/cloudrun-release.txt'");
    expect(workflow).not.toContain("- 'package.json'");
    expect(workflow).not.toContain("- 'package-lock.json'");
    expect(workflow).not.toContain("- 'contexts/**'");
    expect(workflow).not.toContain("- 'pages/**'");
    expect(workflow).not.toContain("- 'components/**'");
  });
});
