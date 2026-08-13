import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';

const server = readFileSync('server.ts', 'utf8');
const usersPage = readFileSync('pages/UsersPage.tsx', 'utf8');
const compatibility = readFileSync('services/server/musicScaleMemberRemovalCompatibility.ts', 'utf8');

function between(source: string, start: string, end: string) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  if (from < 0 || to < 0) throw new Error(`Unable to extract ${start}`);
  return source.slice(from, to);
}

describe('02D member-removal authority migration', () => {
  it('server exposes only the compatibility route for MusicScale removal UX', () => {
    expect(server).toContain('createMemberRemovalCompatibilityHandler');
    expect(server).toContain('app.delete("/api/orgs/:organizationId/members/:memberId", memberRemovalCompatibilityHandler)');
  });

  it('UsersPage no longer imports or invokes deleteDoc', () => {
    expect(usersPage).not.toContain('deleteDoc');
  });

  it('individual removal delegates to authenticated backend endpoint', () => {
    const block = between(usersPage, 'const removeMemberViaHub = async', 'const handleDeleteUser = async');
    expect(block).toContain('currentUser.getIdToken()');
    expect(block).toContain('method: "DELETE"');
    expect(block).toContain('/members/${encodeURIComponent(memberId)}');
    expect(block).toContain('"Authorization": `Bearer ${idToken}`');
    expect(block).not.toContain('organization_members');
    expect(block).not.toContain('"members", memberId');
  });

  it('bulk deletion reuses the same Hub-backed removal command', () => {
    const block = between(usersPage, 'const handleBulkActionConfirm = async', 'const hasChanges =');
    expect(block).toContain('selectedUserIds.map((uid) => removeMemberViaHub(uid))');
    expect(block).not.toContain('deleteDoc');
    expect(block).not.toContain('organization_members');
  });

  it('compatibility service owns only MusicScale projection cleanup after Hub success', () => {
    expect(compatibility).toContain("collection('musicscale_members').doc(memberId).delete()");
    expect(compatibility).not.toContain('organization_members');
    expect(compatibility).not.toContain("collection('members')");
    expect(compatibility).not.toContain("collection('users')");
    expect(compatibility).not.toContain('runTransaction');
  });
});
