const { execSync } = require('child_process');
try {
  execSync('npx vitest run tests/ui/users-existing-member-setup-integration.test.tsx', { encoding: 'utf8' });
  console.log("PASS");
} catch (e) {
  console.log("FAIL");
  console.log(e.stdout.split('\n').filter(l => l.includes('×')).join('\n'));
}
