import { describe, expect, it } from 'vitest';
import { CAPABILITIES } from '../src/types';
import { LIVE_ERROR_CODES } from '../src/errors';

describe('Phase 0 contracts', () => {
  it('keeps capability names provider-neutral', () => {
    const serialized = CAPABILITIES.join(' ').toLowerCase();
    expect(serialized).not.toContain('holyrics');
    expect(serialized).not.toContain('propresenter');
    expect(serialized).not.toContain('resolume');
  });

  it('has deterministic command-path error codes', () => {
    expect(LIVE_ERROR_CODES).toContain('capability_not_supported');
    expect(LIVE_ERROR_CODES).toContain('provider_timeout');
    expect(LIVE_ERROR_CODES).toContain('node_not_paired');
    expect(LIVE_ERROR_CODES).toContain('state_diverged');
  });
});
