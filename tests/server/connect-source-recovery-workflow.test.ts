import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const dirs: string[] = [];
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });
function fixture(enabled: boolean, extraTraffic = false, keyAsPlaintext = false) {
  const dir = mkdtempSync(join(tmpdir(), 'ms-recovery-fixture-')); dirs.push(dir);
  const env = [
    { name: 'FIREBASE_PROJECT_ID', value: 'millionsnest' },
    { name: 'MUSICSCALE_CONNECT_SCALE_PUBLISHED_EVENTS_ENABLED', value: String(enabled) },
    { name: 'MUSICSCALE_CONNECT_SOURCE_EVENT_SECRET', ...(keyAsPlaintext ? { value: 'synthetic-only' } :
      { valueFrom: { secretKeyRef: { name: 'synthetic-source-key', key: '1' } } }) },
    { name: 'MUSICSCALE_CONNECT_OPERATOR_TARGETS_JSON', value: '{}' },
    { name: 'STRIPE_SECRET_KEY', value: 'synthetic-unrelated-never-copy' },
  ];
  writeFileSync(join(dir, 'service.json'), JSON.stringify({ spec: { template: { spec: { containers: [{ env }] } } },
    status: { traffic: extraTraffic ? [{ percent: 50, revisionName: 'synthetic-a' }, { percent: 50, revisionName: 'synthetic-b' }]
      : [{ percent: 100, revisionName: 'synthetic-a' }] } }));
  writeFileSync(join(dir, 'revision.json'), JSON.stringify({ spec: {
    serviceAccountName: 'mn-musicscale-runtime@millionsnest.iam.gserviceaccount.com', containers: [{ env }],
  }, status: { conditions: [{ type: 'Ready', status: 'True' }],
    imageDigest: 'us-central1-docker.pkg.dev/millionsnest/millionsnest-web/musicscale-api@sha256:' + 'a'.repeat(64) } }));
  writeFileSync(join(dir, 'gcloud'), `#!/bin/bash
set -euo pipefail
echo "$*" >> "$FIXTURE_DIR/calls"
if [[ "$*" == 'run services describe '* ]]; then cat "$FIXTURE_DIR/service.json"
elif [[ "$*" == 'run revisions describe '* ]]; then cat "$FIXTURE_DIR/revision.json"
elif [[ "$*" == 'run jobs replace '* ]]; then cp "$4" "$FIXTURE_DIR/captured-job.json"
elif [[ "$*" != 'run jobs execute '* ]]; then exit 90
fi
`, { mode: 0o700 });
  return { dir, run: () => spawnSync('bash', [resolve('scripts/run-connect-source-recovery.sh')], {
    encoding: 'utf8', env: { ...process.env, PATH: dir + ':' + process.env.PATH, FIXTURE_DIR: dir,
      GITHUB_REF: 'refs/heads/production', GITHUB_REPOSITORY: 'prdanielcunha/musicscale' },
  }) };
}
describe('protected source job orchestration using a synthetic gcloud simulator', () => {
  it('disabled bridge performs one read and zero jobs or serving mutations', () => {
    const f = fixture(false); const result = f.run();
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('DISABLED_NO_MUTATION');
    expect(readFileSync(join(f.dir, 'calls'), 'utf8').trim().split('\n')).toHaveLength(1);
    expect(existsSync(join(f.dir, 'captured-job.json'))).toBe(false);
  });
  it('rejects split traffic and plaintext source credentials before job creation', () => {
    for (const f of [fixture(true, true), fixture(true, false, true)]) {
      expect(f.run().status).not.toBe(0);
      expect(existsSync(join(f.dir, 'captured-job.json'))).toBe(false);
    }
  });
  it('pins runtime digest and identity, strips unrelated secrets, disables retries', () => {
    const f = fixture(true); const result = f.run();
    expect(result.status, result.stderr).toBe(0);
    const job = JSON.parse(readFileSync(join(f.dir, 'captured-job.json'), 'utf8'));
    const task = job.spec.template.spec.template.spec;
    expect(task.maxRetries).toBe(0);
    expect(task.serviceAccountName).toBe('mn-musicscale-runtime@millionsnest.iam.gserviceaccount.com');
    expect(task.containers[0].args).toEqual(['dist/connect-recovery.mjs']);
    expect(task.containers[0].image).toContain('@sha256:');
    expect(task.containers[0].env.map((e: any) => e.name)).not.toContain('STRIPE_SECRET_KEY');
    expect(result.stdout + result.stderr).not.toContain('synthetic-only');
    expect(readFileSync(join(f.dir, 'calls'), 'utf8')).not.toMatch(/add-iam|secrets|services update|deploy/);
  });
});
