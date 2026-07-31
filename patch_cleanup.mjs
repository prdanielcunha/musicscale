import fs from 'fs';
let content = fs.readFileSync('tests/ui/global-create-action.test.tsx', 'utf8');

content = content.replace(
  'import { render, screen, fireEvent, waitFor } from \'@testing-library/react\';',
  'import { render, screen, fireEvent, waitFor, cleanup } from \'@testing-library/react\';'
);

content = content.replace(
  'beforeEach(() => {',
  'beforeEach(() => {\n  cleanup();'
);

fs.writeFileSync('tests/ui/global-create-action.test.tsx', content);
