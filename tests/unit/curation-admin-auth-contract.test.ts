import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function readSource(relativePath: string) {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

describe('P4 curation admin authentication contract', () => {
  const pageSource = readSource('pages/CurationPage.tsx');
  const serverSource = readSource('server.ts');
  const authSource = readSource('services/server/ecosystemAuth.ts');

  it('keeps all curation maintenance endpoints behind the canonical ecosystem role middleware', () => {
    expect(serverSource).toContain("app.get(\"/api/admin/inbox-count\", requireEcosystemRole");
    expect(serverSource).toContain("app.post(\"/api/admin/reanalyze-candidates\", requireEcosystemRole");
    expect(serverSource).toContain("app.post(\"/api/admin/backfill-global-titles\", requireEcosystemRole");
    expect(serverSource).toContain("app.post(\"/api/admin/backfill-global-titles/dry-run\", requireEcosystemRole");
    expect(serverSource).toContain('backfillGlobalSongs(db, { dryRun: true })');
    expect(authSource).toContain('authHeader.startsWith("Bearer ")');
  });

  it('uses the authenticated Firebase user as the source of admin bearer tokens', () => {
    expect(pageSource).toContain('const { isCurationAdmin, user } = useAuth();');
    expect(pageSource.match(/await user\?\.getIdToken\(\)/g)?.length).toBe(3);
  });

  it('authenticates inbox count, reanalysis, and backfill requests with Bearer tokens', () => {
    for (const endpoint of [
      '/api/admin/inbox-count',
      '/api/admin/reanalyze-candidates',
      '/api/admin/backfill-global-titles',
    ]) {
      const start = pageSource.indexOf(`fetch('${endpoint}'`);
      expect(start).toBeGreaterThan(-1);
      const requestBlock = pageSource.slice(start, start + 260);
      expect(requestBlock).toContain("'Authorization': `Bearer ${token}`");
    }
  });

  it('does not issue the inbox request without a token and rejects maintenance actions before fetch', () => {
    expect(pageSource).toMatch(
      /const token = await user\?\.getIdToken\(\);\s*if \(!token\) return;\s*const res = await fetch\('\/api\/admin\/inbox-count'/,
    );
    expect(pageSource.match(/if \(!token\) throw new Error\(/g)?.length).toBe(2);
  });
});
