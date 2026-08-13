import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';

const usersPage = readFileSync('pages/UsersPage.tsx', 'utf8');
const profilePage = readFileSync('pages/ProfilePage.tsx', 'utf8');
const diagnostics = readFileSync('components/admin/EcosystemDiagnostics.tsx', 'utf8');
const rules = readFileSync('firestore.rules', 'utf8');

function between(source: string, start: string, end: string) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  if (from < 0 || to < 0) throw new Error(`Unable to extract ${start}`);
  return source.slice(from, to);
}

describe('02E final client membership-authority migration', () => {
  it('UsersPage no longer exposes the legacy organization-role migration tool', () => {
    expect(usersPage).not.toContain('handleMigrateRoles');
    expect(usersPage).not.toContain('Migrar Estrutura de Papéis (Admin)');
    expect(usersPage).not.toContain('setMigrating');
  });

  it('ProfilePage reads canonical nested join requests and resolves them through 02C backend commands', () => {
    const queryBlock = between(profilePage, "collection(db, 'organizations', organization.id, 'join_requests')", 'const handleProcessJoinRequest');
    expect(queryBlock).not.toContain('organization_join_requests');

    const commandBlock = between(profilePage, 'const handleProcessJoinRequest', 'const handleUpdateMemberRole');
    expect(commandBlock).toContain('user.getIdToken()');
    expect(commandBlock).toContain('/join-requests/${encodeURIComponent(requestId)}/${action}');
    expect(commandBlock).toContain("'Authorization': `Bearer ${idToken}`");
    expect(commandBlock).not.toMatch(/\b(?:setDoc|updateDoc|deleteDoc)\s*\(/);
    expect(commandBlock).not.toContain('organization_members');
  });

  it('ProfilePage member removal delegates to the 02D backend and contains no membership Firestore mutation', () => {
    const block = between(profilePage, 'const handleRemoveMember', '// Password state');
    expect(block).toContain('user.getIdToken()');
    expect(block).toContain('method: \'DELETE\'');
    expect(block).toContain('/members/${encodeURIComponent(memberId)}');
    expect(block).toContain("'Authorization': `Bearer ${idToken}`");
    expect(block).not.toMatch(/\b(?:setDoc|updateDoc|deleteDoc)\s*\(/);
    expect(block).not.toContain('organization_members');
  });

  it('ProfilePage support organization creation is explicitly delegated to the Hub', () => {
    const block = between(profilePage, 'const handleSupportCreateOrg', 'const handleSpecialtyChange');
    expect(block).toContain('foi movida para o MillionsNest Hub');
    expect(block).not.toMatch(/\b(?:addDoc|setDoc|updateDoc|writeBatch)\s*\(/);
    expect(block).not.toContain('organizationRole');
    expect(block).not.toContain('ownerUserId');
  });

  it('EcosystemDiagnostics cannot link an owner or create an owner membership client-side', () => {
    expect(diagnostics).toContain('OWNER_LINK_REQUIRES_MILLIONSNEST_HUB');
    expect(diagnostics).toContain('ORGANIZATION_CREATION_REQUIRES_MILLIONSNEST_HUB');
    expect(diagnostics).not.toContain('organizationRole: "owner"');
    expect(diagnostics).not.toMatch(/batch\.set\([^\n]*memberRef/);
  });

  it('Firestore Rules make canonical and legacy membership mutation backend-only', () => {
    const canonicalBlock = between(rules, 'match /members/{uid}', 'match /musicscale_members/{uid}');
    expect(canonicalBlock).toContain('allow create, update, delete: if false;');
    expect(canonicalBlock).not.toContain('allow create: if isAuthenticated()');

    const legacyBlock = between(rules, 'match /organization_members/{id}', '// ==========================================\n    // 3. MÚSICAS');
    expect(legacyBlock).toContain('allow create, update, delete: if false;');

    const genericBlock = between(rules, 'match /{app}/{document=**}', 'match /organization_members/{id}');
    expect(genericBlock.match(/app != 'members'/g)?.length).toBe(3);
  });

  it('legacy root join-request authority is absent from reachable team/profile UX', () => {
    expect(usersPage).not.toContain('organization_join_requests');
    expect(profilePage).not.toContain('organization_join_requests');
  });
});
