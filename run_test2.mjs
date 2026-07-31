import { execSync } from 'child_process';
try {
  execSync('npx vitest run tests/ui/scale-song-settings.test.tsx > test_output.log', { stdio: 'inherit' });
} catch (e) {}
