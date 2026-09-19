import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('ServeGuard server route contract', () => {
  it('keeps preference and prospective evaluation behind the canonical server handlers', () => {
    const serverSource = fs.readFileSync(
      path.resolve(process.cwd(), 'server.ts'),
      'utf8',
    );

    expect(serverSource).toContain(
      'import { createServeGuardHttpHandlers } from "./services/server/serveGuard/serveGuardHttpHandler.js";',
    );
    expect(serverSource).toContain(
      'const serveGuardHttpHandlers = createServeGuardHttpHandlers({',
    );
    expect(serverSource).toContain(
      '"/api/v1/organizations/:organizationId/serve-guard/preferences/:userId"',
    );
    expect(serverSource).toContain(
      '"/api/v1/organizations/:organizationId/serve-guard/evaluate"',
    );
    expect(serverSource).toContain('serveGuardHttpHandlers.getPreference');
    expect(serverSource).toContain('serveGuardHttpHandlers.putPreference');
    expect(serverSource).toContain('serveGuardHttpHandlers.evaluate');
  });
});
