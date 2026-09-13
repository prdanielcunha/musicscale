import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(path.resolve(process.cwd(), 'pages/ScalesPage.tsx'), 'utf8');

describe('scale deep-link navigation contract', () => {
  it('never redirects from a stale scale route after the user has navigated away', () => {
    expect(source).toContain('const expectedPath = `/scales/${scaleId}`;');
    expect(source).toContain('if (location.pathname !== expectedPath)');
    expect(source).toContain('[scaleId, populatedScales, openScaleDetail, navigate, location.pathname]');
  });
});
