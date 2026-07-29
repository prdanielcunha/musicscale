const fs = require('fs');

let code = fs.readFileSync('tests/ui/dashboard-home-experience.test.tsx', 'utf8');

code = code.replace(`await act(async () => { await Promise.resolve(); });`, ``);
code = code.replace(`await act(async () => { await Promise.resolve(); });`, ``);
code = code.replace(`import { describe, it, expect, vi, beforeEach } from 'vitest';`, `import { describe, it, expect, vi, beforeEach } from 'vitest';\nimport { act } from '@testing-library/react';`);

fs.writeFileSync('tests/ui/dashboard-home-experience.test.tsx', code);
