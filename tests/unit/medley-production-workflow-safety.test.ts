import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('MusicScale Medley production infrastructure contract', () => {
  const cloudRun = readFileSync('.github/workflows/cloudrun-private-deploy.yml', 'utf8');
  const firebase = readFileSync('.github/workflows/firebase-production-deploy.yml', 'utf8');
  it('never writes Cloud Run IAM or opens it to allUsers on deployment', () => {
    expect(cloudRun).toContain('Snapshot existing Cloud Run IAM (read-only)');
    expect(cloudRun).toContain('MUSICSCALE_IAM_UNCHANGED_OK');
    expect(cloudRun).not.toContain('add-iam-policy-binding');
    expect(cloudRun).not.toContain('set-iam-policy');
    expect(cloudRun).not.toContain('--allow-unauthenticated');
    expect(cloudRun).not.toContain('--no-allow-unauthenticated');
  });
  it('serializes Cloud Run and Firebase Hosting release jobs to prevent revision races', () => {
    expect(cloudRun).toContain('group: musicscale-production-release');
    expect(firebase).toContain('group: musicscale-production-release');
    expect(cloudRun).toContain('cancel-in-progress: false');
    expect(firebase).toContain('cancel-in-progress: false');
    expect(cloudRun).toContain('--only hosting:musicscale');
    expect(firebase).toContain('--only "hosting:$HOSTING_TARGET"');
  });
});
