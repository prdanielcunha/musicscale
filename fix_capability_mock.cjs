const fs = require('fs');
const filePath = 'tests/ui/first-scale-journey-team-step.test.tsx';
let code = fs.readFileSync(filePath, 'utf8');

const mockCode = `
vi.mock('../../hooks/useCapability', () => ({
  useCapability: () => ({ hasCapability: () => true })
}));
`;

code = code.replace("const mockNavigate = vi.fn();", mockCode + "\nconst mockNavigate = vi.fn();");
fs.writeFileSync(filePath, code);
