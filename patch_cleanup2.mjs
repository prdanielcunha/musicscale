import fs from 'fs';
let content = fs.readFileSync('tests/ui/global-create-action.test.tsx', 'utf8');

content = content.replace(
  'import { describe, it, expect, vi, beforeEach } from \'vitest\';',
  'import { describe, it, expect, vi, beforeEach, afterEach } from \'vitest\';'
);

content = content.replace(
  'beforeEach(() => {',
  'afterEach(() => { cleanup(); });\nbeforeEach(() => {'
);

fs.writeFileSync('tests/ui/global-create-action.test.tsx', content);
