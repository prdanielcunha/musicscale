import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('scale save failure feedback contract', () => {
  it('never silently returns when auth/profile/API context is unavailable', () => {
    const source = readFileSync(resolve(process.cwd(), 'contexts/ModalContext.tsx'), 'utf8');
    const start = source.indexOf('if (!user || !userProfile || !api)');
    expect(start).toBeGreaterThan(-1);
    const block = source.slice(start, start + 650);
    expect(block).toContain('toast({');
    expect(block).toContain("scaleModal.saveContextUnavailable");
  });
});
