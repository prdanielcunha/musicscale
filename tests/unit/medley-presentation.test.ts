import { describe, expect, it } from 'vitest';
import { medleyPresentationHtml } from '../../utils/medleyPresentation';
import type { ScaleMedley } from '../../types';

describe('medley presentation', () => {
  it('exports approved snapshots without executable source content or remote assets', () => {
    const medley = { id: 'm', anchorSongId: 'a', revision: 1, steps: [{ id: 's', songId: 'a', sourceRevision: 'r', startLine: 0, endLine: 0, title: '<script>alert(1)</script>', repetitions: 1, snapshot: '<img src=x onerror=alert(1)>', tabs: [{ section: 'Solo', content: '<iframe>' }], transition: { mode: 'direct' as const, cue: '& pause' } }] } satisfies ScaleMedley;
    const html = medleyPresentationHtml(medley);
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).toContain('&amp; pause');
    expect(html).toContain('&lt;iframe&gt;');
    expect(html).not.toContain('<script>');
    expect(html).toContain("default-src 'none'");
    expect(medleyPresentationHtml(medley, 'es-ES')).toContain('<html lang="es">');
  });
});
