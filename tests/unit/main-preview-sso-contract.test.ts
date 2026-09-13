import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('MusicScale Firebase main preview SSO contract', () => {
  const source = fs.readFileSync(
    path.resolve(process.cwd(), 'services/ecosystem/handoffHelper.ts'),
    'utf8',
  );

  it('forwards only the trusted main-review Firebase origin to the Hub', () => {
    expect(source).toContain('MAIN_PREVIEW_HOST');
    expect(source).toContain('mn-musicscale-555464791734--main-review-');
    expect(source).toContain("url.protocol !== 'https:'");
    expect(source).toContain("hubUrl.searchParams.set('returnOrigin', trustedPreviewOrigin)");
  });

  it('keeps the normal Hub handoff contract intact', () => {
    expect(source).toContain("const HUB_LAUNCH_URL = 'https://www.millionsnest.com/apps/musicscale/launch'");
    expect(source).toContain("hubUrl.searchParams.set('returnTo', safePath)");
    expect(source).toContain('signInWithCustomToken(auth, payload.customToken)');
  });
});
