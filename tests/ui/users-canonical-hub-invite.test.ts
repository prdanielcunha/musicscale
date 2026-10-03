import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

describe('Users canonical MillionsNest invitation experience', () => {
  it('offers the same email/link access-role invitation modes from the Users area', () => {
    const modal = read('components/team/CanonicalHubInviteModal.tsx');

    expect(modal).toContain('"email" | "link"');
    expect(modal).toContain('users.invite.method_email');
    expect(modal).toContain('users.invite.method_link');
    expect(modal).toContain('users.invite.role_admin');
    expect(modal).toContain('users.invite.role_manager');
    expect(modal).toContain('users.invite.role_member');
    expect(modal).toContain('users.invite.role_viewer');
    expect(modal).toContain('/api/orgs/invite');
    expect(modal).toContain('/api/orgs/invite/send-email');
    expect(modal).toContain('https://www.millionsnest.com');
    expect(modal).toContain('users.invite.target_app_title');
    expect(modal).toContain('direto no MusicScale');
  });

  it('binds MusicScale invitations to the app on the server instead of trusting browser input', () => {
    const compatibility = read('services/server/musicScaleInvitationCompatibility.ts');
    const adapter = read('services/server/hubInvitationAdapter.ts');

    expect(compatibility).toContain("targetAppId: 'musicscale'");
    expect(compatibility).toContain("targetPath: '/start'");
    expect(adapter).toContain('targetAppId?: \'musicscale\'');
    expect(adapter).toContain('result.invitation?.targetAppId !== options.targetAppId');
  });

  it('exposes direct invite entry points globally and inside a MusicScale role', () => {
    const users = read('pages/UsersPage.tsx');

    expect(users).toContain('setIsHubInviteOpen(true)');
    expect(users).toContain('setIsInviteModalOpen(true)');
    expect(users).toContain('musicScaleRole={role}');
    expect(users).toContain('users.invite_user');
    expect(users).not.toContain('+ Convidar novo por E-mail');
  });

  it.each(['pt', 'en', 'es'])('ships invitation copy in %s', locale => {
    const parsed = JSON.parse(read(`locales/${locale}.json`));
    expect(parsed.users.invite.method_email).toBeTruthy();
    expect(parsed.users.invite.method_link).toBeTruthy();
    expect(parsed.users.invite.role_member).toBeTruthy();
    expect(parsed.users.invite.musicscale_role_title).toBeTruthy();
  });

  it('exposes a members directory that opens member details and offers invitation entry points', () => {
    const users = read('pages/UsersPage.tsx');

    expect(users).toContain('users.members_title');
    expect(users).toContain('users.members_search');
    expect(users).toContain('setSelectedMemberForDetail(member)');
    expect(users).toContain('handleDirectoryMemberSave');
    expect(users).toContain('handleDirectoryMemberDelete');
    expect(users).toContain('setIsHubInviteOpen(true)');
    expect(users).toContain('getActorOrganizationRoleKey');
    expect(users).toContain('profile?.organizationRole');
  });

  it.each(['pt', 'en', 'es'])('ships members directory copy in %s', locale => {
    const parsed = JSON.parse(read(`locales/${locale}.json`));
    expect(parsed.users.members_title).toBeTruthy();
    expect(parsed.users.members_search).toBeTruthy();
    expect(parsed.users.view_edit_member).toBeTruthy();
    expect(parsed.users.member_update_error).toBeTruthy();
  });

  it('keeps MillionsNest as the server-side authority for invitation creation and delivery', () => {
    const server = read('server.ts');
    const adapter = read('services/server/hubInvitationAdapter.ts');

    expect(server).toContain('invitationCompatibilityHandlers.create');
    expect(server).toContain('invitationCompatibilityHandlers.sendEmail');
    expect(adapter).toContain("/api/v1/invitations");
    expect(adapter).toContain("/api/v1/invitations/email");
    expect(adapter).not.toContain("collection('organizations').doc(organizationId).collection('invites').doc");
  });
});
