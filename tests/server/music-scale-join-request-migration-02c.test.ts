import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';

const server = readFileSync('server.ts', 'utf8');
const usersPage = readFileSync('pages/UsersPage.tsx', 'utf8');
const onboarding = readFileSync('pages/TenantOnboarding.tsx', 'utf8');
const compatibility = readFileSync('services/server/musicScaleJoinRequestCompatibility.ts', 'utf8');

function between(source: string, start: string, end: string) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  if (from < 0 || to < 0) throw new Error(`Unable to extract block ${start}`);
  return source.slice(from, to);
}

describe('02C migrated join-request authority boundaries', () => {
  it('server no longer contains the legacy local join-request collection', () => {
    expect(server).not.toContain('organization_join_requests');
    expect(server).toContain('createJoinRequestCompatibilityHandlers');
    expect(server).toContain('app.post("/api/orgs/join", joinRequestCompatibilityHandlers.create)');
    expect(server).toContain('/api/orgs/:organizationId/join-requests/:requestId/approve');
    expect(server).toContain('/api/orgs/:organizationId/join-requests/:requestId/reject');
  });

  it('onboarding sends owner email only and no caller uid authority in join payload', () => {
    const block = between(onboarding, 'const handleJoinOrg = async () => {', 'if (mode === "premium_join")');
    expect(block).toContain('ownerEmail: joinEmail');
    expect(block).not.toContain('userId: user.uid');
    expect(block).not.toContain('organizationId:');
    expect(block).not.toContain('organizationRole:');
  });

  it('UsersPage reads the canonical nested join-request collection', () => {
    const block = between(usersPage, 'const fetchJoinRequests = async () => {', 'const fetchUsers = async () => {');
    expect(block).toContain("collection(db, 'organizations', organizationId, 'join_requests')");
    expect(block).not.toContain('organization_join_requests');
  });

  it('UsersPage resolution block performs no Firestore membership/user/request writes', () => {
    const block = between(usersPage, 'const handleProcessRequest = async', 'const fetchUsers = async');
    expect(block).toContain('/join-requests/${encodeURIComponent(requestId)}/${action}');
    expect(block).toContain('"Authorization": `Bearer ${idToken}`');
    expect(block).not.toMatch(/\bsetDoc\s*\(/);
    expect(block).not.toMatch(/\bupdateDoc\s*\(/);
    expect(block).not.toMatch(/\bdeleteDoc\s*\(/);
    expect(block).not.toContain('organization_members');
    expect(block).not.toContain("'members'");
  });

  it('compatibility service contains no local membership/request authority or legacy fallback', () => {
    expect(compatibility).not.toContain('organization_join_requests');
    expect(compatibility).not.toContain('organization_members');
    expect(compatibility).not.toContain('runTransaction');
    // Map.set() is used only to deduplicate organization-discovery results. Runtime
    // compatibility tests provide the primary proof that no Firestore mutation occurs.
    expect(compatibility).not.toMatch(/\btransaction\.(set|update|delete)\s*\(/);
    expect(compatibility).not.toMatch(/\b(?:memberRef|requestRef|userRef|legacyRef)\.(set|update|delete)\s*\(/);
    expect(compatibility).not.toContain('legacy');
  });
});
