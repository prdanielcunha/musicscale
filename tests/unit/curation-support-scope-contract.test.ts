import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const authSource = readFileSync('services/server/ecosystemAuth.ts', 'utf8');

describe('MillionsNest support RBAC isolation', () => {
  it('grants support access only to global curation paths, not all admin APIs', () => {
    expect(authSource).toContain("export const CURATION_ECOSYSTEM_ROLES = [...VALID_ECOSYSTEM_ROLES, 'ecosystem_support']");
    expect(authSource).toContain("return path.startsWith('/api/curation/') || CURATION_SUPPORT_PATHS.has(path)");
    expect(authSource).toContain("isCurationSupportEndpoint(String(req.path || ''))");
    const genericRoles = authSource.split('export const VALID_ECOSYSTEM_ROLES = [')[1].split('];')[0];
    expect(genericRoles).not.toContain("'ecosystem_support'");
    expect(authSource).toContain('const permittedRoles = allowCurationSupport ? CURATION_ECOSYSTEM_ROLES : VALID_ECOSYSTEM_ROLES');
  });
});
