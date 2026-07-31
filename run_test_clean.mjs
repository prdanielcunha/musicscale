import { execSync } from 'child_process';
process.env.DEBUG_PRINT_LIMIT = '100'; // Vitest truncates DOM dump
try {
  execSync('npx vitest run tests/ui/scale-song-settings.test.tsx -t "opens confirmation dialog"', { stdio: 'inherit' });
} catch (e) {}
