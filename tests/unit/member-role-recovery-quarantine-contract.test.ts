import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
const workflow=fs.readFileSync('.github/workflows/apply-member-role-recovery.yml','utf8');
const script=fs.readFileSync('scripts/apply-member-role-recovery.ts','utf8');

describe('P0 global ministry role recovery quarantine',()=>{
 it('never auto-executes under a production branch push',()=>{
   expect(workflow).toContain('workflow_dispatch:');
   expect(workflow).not.toMatch(/^\s+push:\s*$/m);
   expect(workflow).toContain('scripts/audit-member-role-recovery.ts');
   expect(workflow).not.toContain('run: npx tsx scripts/apply-member-role-recovery.ts');
 });
 it('explicitly refuses global cross-tenant role writes',()=>{
   expect(script).toContain('ROLE_RECOVERY_WRITE_DISABLED_PENDING_TENANT_SCOPED_P0_APPROVAL');
   expect(script).not.toContain('.set(');
   expect(script).not.toContain('.update(');
   expect(script).not.toContain('activeOrganizationId)');
 });
});
