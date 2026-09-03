import { describe, expect, it } from 'vitest';
import { canUseBulkLibraryImport } from '../../utils/libraryImportPolicy';

describe('Library bulk import policy', () => {
  it('allows bulk import for a paid active Pro organization', () => {
    expect(canUseBulkLibraryImport('pro', 'active')).toBe(true);
  });

  it('blocks bulk import during a Pro trial', () => {
    expect(canUseBulkLibraryImport('pro', 'trialing')).toBe(false);
  });

  it('blocks bulk import for Advanced even when active', () => {
    expect(canUseBulkLibraryImport('advanced', 'active')).toBe(false);
  });

  it('blocks bulk import for Starter', () => {
    expect(canUseBulkLibraryImport('starter', 'active')).toBe(false);
  });

  it('preserves the ecosystem-admin operational bypass', () => {
    expect(canUseBulkLibraryImport('starter', 'inactive', true)).toBe(true);
  });
});
