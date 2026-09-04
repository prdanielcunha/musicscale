import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Living Library paid-Pro bulk import contract', () => {
  const server = fs.readFileSync(path.join(process.cwd(), 'server.ts'), 'utf8');
  const page = fs.readFileSync(path.join(process.cwd(), 'pages/LibraryPage.tsx'), 'utf8');

  it('server permits bulk only for active Pro or ecosystem admin', () => {
    expect(server).toContain("(verifiedPlan === 'pro' && verifiedStatus === 'active')");
    expect(server).toContain("selectedSongs.length > 1 && !canBulkImportLibrary");
    expect(server).toContain("errorCode: 'BULK_IMPORT_PRO_ONLY'");
  });

  it('UI uses the same active-Pro gate and keeps Pro trial individual-only', () => {
    expect(page).toContain("(entitlements?.plan === \"pro\" && entitlements?.status === \"active\")");
    expect(page).toContain("if (!canBulkImportLibrary)");
    expect(page).toContain("library.trial_bulk_disabled");
  });

  it('keeps the separate 20-song lifetime Pro-trial fair-use cap', () => {
    expect(server).toContain('const PRO_TRIAL_LIBRARY_IMPORT_CAP = 20');
    expect(server).toContain("collection('trial_usage').doc('musicscale')");
    expect(server).toContain('PRO_TRIAL_LIBRARY_LIMIT_REACHED');
  });
});
