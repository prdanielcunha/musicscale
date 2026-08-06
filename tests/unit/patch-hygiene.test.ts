import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Patch Hygiene', () => {
  it('nenhum arquivo patch_*.ts na raiz', () => {
    const files = fs.readdirSync(process.cwd());
    const patches = files.filter(f => f.startsWith('patch_') && f.endsWith('.ts'));
    expect(patches).toHaveLength(0);
  });
  it('nenhum arquivo patch_*.cjs na raiz', () => {
    const files = fs.readdirSync(process.cwd());
    const patches = files.filter(f => f.startsWith('patch_') && f.endsWith('.cjs'));
    expect(patches).toHaveLength(0);
  });
  it('package.json não referencia patch_*', () => {
    const pkg = fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8');
    expect(pkg).not.toContain('patch_');
  });
});
