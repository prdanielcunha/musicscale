import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Pro trial Living Library fair-use contract', () => {
  it('caps trial imports server-side with a lifetime counter while paid Pro stays unlimited', () => {
    const server = fs.readFileSync(path.join(process.cwd(), 'server.ts'), 'utf8');

    expect(server).toContain('const PRO_TRIAL_LIBRARY_IMPORT_CAP = 20');
    expect(server).toContain("verifiedPlan === 'pro' && verifiedStatus === 'trialing'");
    expect(server).toContain("collection('trial_usage').doc('musicscale')");
    expect(server).toContain('PRO_TRIAL_LIBRARY_LIMIT_REACHED');
    expect(server).toContain("verifiedStatus !== 'active' && verifiedStatus !== 'trialing'");
    expect(server).toContain("errorCode: 'SUBSCRIPTION_INACTIVE'");
    expect(server).toContain('effectiveServerLimits');
    expect(server).toContain('libraryImportsPerMonth: PRO_TRIAL_LIBRARY_IMPORT_CAP');
  });

  it('removes bulk-import convenience controls during Pro trial and explains the limit', () => {
    const page = fs.readFileSync(path.join(process.cwd(), 'pages/LibraryPage.tsx'), 'utf8');
    const banner = fs.readFileSync(path.join(process.cwd(), 'components/billing/LibraryUsageBanner.tsx'), 'utf8');

    expect(page).toContain('entitlements?.status === "trialing"');
    expect(page).toContain('library.trial_bulk_disabled');
    expect(page).toContain("result.errorCode === 'PRO_TRIAL_LIBRARY_LIMIT_REACHED'");
    expect(banner).toContain("status === 'trialing'");
    expect(banner).toContain('billing.pro_trial_library_remaining');
  });
});
