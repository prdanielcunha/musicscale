import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');

// Certification trigger: this contract travels with the complete responsive ServeGuard experience.
describe('ServeGuard experience contract', () => {
  it('keeps personal preference UI behind the authenticated ServeGuard client', () => {
    const profile = read('pages/ProfilePage.tsx');
    const client = read('services/serveGuardService.ts');

    expect(profile).toContain('getServeGuardPreference');
    expect(profile).toContain('saveServeGuardPreference');
    expect(profile).toContain('profile.serve_guard.title');
    expect(profile).not.toContain('serveGuardPreferences');
    expect(client).toContain('/serve-guard/preferences/');
    expect(client).toContain('Authorization');
    expect(client).toContain('Bearer');
  });

  it('uses one batch advisory read for BandBuilder candidates and requires an explicit UI confirmation for strong conflicts', () => {
    const builder = read('components/scales/BandBuilder.tsx');
    const handler = read('services/server/serveGuard/serveGuardHttpHandler.ts');

    expect(builder).toContain('evaluateServeGuardBatch');
    expect(builder).toContain('Promise.allSettled');
    expect(builder).toContain('setPendingServeGuardOverride(null)');
    expect(builder).toContain('requiresExplicitOverride');
    expect(builder).toContain('pendingServeGuardOverride');
    expect(builder).toContain('bandScaleModal.serveGuard.addAnyway');
    expect(handler).toContain('rawUserIds.length > 100');
    expect(handler).toContain('loadScales(organizationId, deps.db)');
    expect(handler).toContain('SERVEGUARD_EVALUATION_AUTHORITY_REQUIRED');
    expect(handler).toContain('skippedUserIds');
  });

  it('keeps ServeGuard advisory rather than presenting it as a health diagnosis or silent blocker', () => {
    const profile = read('pages/ProfilePage.tsx');
    const builder = read('components/scales/BandBuilder.tsx');
    const policy = read('services/server/serveGuard/serveGuardPolicy.ts');

    expect(profile).toContain('profile.serve_guard.advisory_note');
    expect(policy).toContain('advisoryOnly: true');
    expect(builder).not.toContain('Adicionar mesmo assim');
    expect(builder).toContain('bandScaleModal.serveGuard.overridePrompt');
  });

  it('keeps the ServeGuard experience localized in PT/EN/ES', () => {
    for (const locale of ['pt', 'en', 'es']) {
      const data = JSON.parse(read('locales/' + locale + '.json'));
      expect(data.profile?.serve_guard?.title).toBeTruthy();
      expect(data.profile?.serve_guard?.advisory_note).toBeTruthy();
      expect(data.bandScaleModal?.serveGuard?.checking).toBeTruthy();
      expect(data.bandScaleModal?.serveGuard?.projectedLoad).toBeTruthy();
      expect(data.bandScaleModal?.serveGuard?.overridePrompt).toBeTruthy();
      expect(data.bandScaleModal?.serveGuard?.addAnyway).toBeTruthy();
      expect(data.bandScaleModal?.serveGuard?.cancel).toBeTruthy();
      expect(data.bandScaleModal?.serveGuard?.status?.paused).toBeTruthy();
      expect(data.bandScaleModal?.serveGuard?.status?.unavailable).toBeTruthy();
    }
  });
});
