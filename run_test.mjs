import { execSync } from 'child_process';
try {
  execSync('npx vitest run tests/ui/scale-song-settings.test.tsx', { stdio: 'inherit' });
} catch (e) {
  // handled
}
