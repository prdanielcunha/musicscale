import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(
  path.join(process.cwd(), 'components/songs/SongForm.tsx'),
  'utf8',
);

describe('SongForm technical parts preservation', () => {
  it('preserves fields outside the form ownership when editing an imported song', () => {
    expect(source).toContain('...songToEdit,');
    expect(source).toContain('tabs: songToEdit.tabs || []');
  });

  it('keeps selectedKey synchronized when the editable key is saved', () => {
    const occurrences = source.match(/selectedKey:\s*formData\.key/g) || [];
    expect(occurrences.length).toBeGreaterThanOrEqual(2);
  });
});
