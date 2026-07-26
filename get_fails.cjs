const { execSync } = require('child_process');
try {
  const output = execSync('npx vitest run tests/ui/users-existing-member-setup-integration.test.tsx', { encoding: 'utf8' });
  console.log(output);
} catch (e) {
  const lines = e.stdout.split('\n');
  lines.forEach(l => {
    if (l.includes('×')) console.log(l);
  });
}
