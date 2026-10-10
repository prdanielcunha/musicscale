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
  it('renders approved manual chord and bar cues as offline presentation chips without scripts', () => {
    const medley = { id: 'medley', anchorSongId: 'a', revision: 1, steps: [{
      id: 'a1', songId: 'a', sourceRevision: 'hash', startLine: 0, endLine: 0,
      title: 'Adoração', repetitions: 2, snapshot: 'Am F',
      transition: { mode: 'free' as const, cue: 'Ponte manual [6/8; 86 BPM]: Bbmaj7 × 2 | F#7/C# × 1' },
    }] } satisfies ScaleMedley;
    const html = medleyPresentationHtml(medley);
    expect(html).toContain('Bbmaj7');
    expect(html).toContain('F#7/C#');
    expect(html).toContain('bridge-event');
    expect(html).toContain('6/8 · 86 BPM');
    expect(html).not.toContain('<script>');
    expect(html).toContain("default-src 'none'");
  });
});
