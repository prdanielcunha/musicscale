import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('tenant onboarding completion contract', () => {
  it('marks the canonical organization complete only through the authorized update endpoint', () => {
    const server = fs.readFileSync(path.join(process.cwd(), 'server.ts'), 'utf8');
    const start = server.indexOf('app.post("/api/orgs/update"');
    const end = server.indexOf('const joinRequestCompatibilityHandlers', start);
    const updateRoute = server.slice(start, end);

    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    expect(updateRoute).toContain('resolveOrganizationAuthorization');
    expect(updateRoute).toContain("onboardingState: 'complete'");
    expect(updateRoute).toContain('onboardingCompletedAt: admin.firestore.FieldValue.serverTimestamp()');
  });
});
