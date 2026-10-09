import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('MusicScale global data integrity audit - non-destructive privacy contract', () => {
  const script = readFileSync('scripts/audit-member-role-recovery.ts', 'utf8');
  const workflow = readFileSync('.github/workflows/member-role-recovery-audit.yml', 'utf8');

  it('does not export member/org identifiers, names or detailed inventories to public CI artifacts', () => {
    expect(script).toContain("writeFile('tmp/firestore-audit/global-integrity-summary.json'");
    expect(script).toContain('GLOBAL_MUSICSCALE_INTEGRITY_AGGREGATE');
    expect(script).toContain('personalDataExported: false');
    expect(script).not.toContain('JSON.stringify(out');
    expect(script).not.toContain('JSON.stringify(inventory');
    expect(script).not.toContain('member-role-recovery.audit.json');
    expect(workflow).toContain('path: tmp/firestore-audit/global-integrity-summary.json');
    expect(workflow).not.toContain('member-role-recovery.*.json');
  });
  it('never invokes global repair or Firestore write methods', () => {
    expect(script).not.toMatch(/(?:\.doc\([^)]*\)|\.collection\([^)]*\))\.(?:set|update|delete|create)\s*\(/);
    expect(workflow).not.toContain('scripts/apply-member-role-recovery.ts');
    expect(script).toContain('readOnly: true');
  });
  it('differentiates active access projections and historical role names', () => {
    expect(script).toContain('activeProjectionMembersWithNoIdentifiedMinistryRole');
    expect(script).toContain('membersResolvedByLegacyRoleName');
    expect(script).toContain('membersWithConflictingRoleIds');
    expect(script).toContain('fixedFormationsRoot');
    expect(script).toContain('fixedFormationsNested');
    expect(script).toContain('collectVerifiedMinistryNameMatches');
    expect(script).toContain('projection.ministryFunction');
    expect(script).toContain('canonical.ministryFunction');
    expect(script).toContain('tenantBound(s.data(), id, uid)');
    expect(script).toContain('membersWithAmbiguousLegacyMinistryNames');
    expect(script).not.toContain('canonical.role,');
  });
});
