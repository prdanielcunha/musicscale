import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const scaleSource = fs.readFileSync(path.resolve(process.cwd(), 'pages/ScalesPage.tsx'), 'utf8');
const bandScaleSource = fs.readFileSync(path.resolve(process.cwd(), 'pages/BandScalesPage.tsx'), 'utf8');

describe('scale deep-link navigation contract', () => {
  it('never redirects from a stale music scale route after the user has navigated away', () => {
    expect(scaleSource).toContain('const expectedPath = `/scales/${scaleId}`;');
    expect(scaleSource).toContain('if (location.pathname !== expectedPath)');
    expect(scaleSource).toContain('[scaleId, populatedScales, openScaleDetail, navigate, location.pathname]');
  });

  it('never redirects from a stale band scale route after the user has navigated away', () => {
    expect(bandScaleSource).toContain('useParams, useNavigate, useLocation');
    expect(bandScaleSource).toContain('const expectedPath = `/band-scales/${scaleId}`;');
    expect(bandScaleSource).toContain('if (location.pathname !== expectedPath)');
    expect(bandScaleSource).toContain('[scaleId, loading, populatedBandScales, openBandScaleDetail, navigate, location.pathname]');
  });
});
