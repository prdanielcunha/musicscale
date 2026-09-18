import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Users native role select contrast', () => {
  it('gives dark native option popups an explicit readable palette', () => {
    const css = fs.readFileSync('index.css', 'utf8');
    const users = fs.readFileSync('pages/UsersPage.tsx', 'utf8');

    expect(users).toContain('handleUpdateMemberRole(user.uid, e.target.value)');
    expect(css).toMatch(/\.dark select\s*\{[^}]*color-scheme:\s*dark;/s);
    expect(css).toMatch(/\.dark select option\s*\{[^}]*color:\s*#f5f7fa;[^}]*background:\s*#111318;/s);
  });
});
