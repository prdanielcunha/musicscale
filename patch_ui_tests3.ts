import fs from 'fs';

const path = 'tests/ui/use-home-experience.test.tsx';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  "import { renderHook } from '@testing-library/react';",
  "import { renderHook, act } from '@testing-library/react';"
);

fs.writeFileSync(path, code);
console.log('patched act');
