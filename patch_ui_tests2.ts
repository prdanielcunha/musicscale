import fs from 'fs';

const path = 'tests/ui/use-home-experience.test.tsx';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  "vi.mocked(useAuth).mockReturnValue",
  "mockUseAuth.mockReturnValue"
);
code = code.replace(
  "vi.mocked(useMusic).mockReturnValue",
  "mockUseMusic.mockReturnValue"
);

fs.writeFileSync(path, code);
console.log('patched again');
