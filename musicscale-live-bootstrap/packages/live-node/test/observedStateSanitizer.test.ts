import { describe, expect, it } from 'vitest';
import { sanitizeObservedStateForPersistence } from '../src/observedStateSanitizer';

describe('observed state persistence sanitizer', () => {
  it('keeps live metadata while dropping preview/base64 payloads', () => {
    const preview = 'a'.repeat(50_000);
    const state = sanitizeObservedStateForPersistence({
      screenMode: 'normal',
      currentPresentation: {
        id: 'p1',
        slide_number: 2,
        slides: [
          {
            number: 2,
            text: 'Chorus',
            preview
          }
        ]
      },
      thumbnail: preview
    });

    expect(state.screenMode).toBe('normal');
    const presentation = state.currentPresentation as Record<string, unknown>;
    const slides = presentation.slides as Array<Record<string, unknown>>;
    expect(slides[0]?.text).toBe('Chorus');
    expect(slides[0]).not.toHaveProperty('preview');
    expect(state).not.toHaveProperty('thumbnail');
    expect(JSON.stringify(state).length).toBeLessThan(10_000);
  });

  it('bounds unknown oversized strings before crash-recovery persistence', () => {
    const state = sanitizeObservedStateForPersistence({
      unknownProviderPayload: 'x'.repeat(40_000)
    });

    expect(String(state.unknownProviderPayload)).toContain('[omitted:string:40000]');
  });
});
