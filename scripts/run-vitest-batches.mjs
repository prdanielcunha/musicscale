import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const requested = process.argv.slice(2).filter(Boolean);
const batchSize = Math.max(1, Number.parseInt(process.env.VITEST_BATCH_SIZE || '18', 10) || 18);

const ignoredPrefixes = [
  'functions/tests/',
  'utils/songDiscovery/tests/',
  'tests/e2e/',
];

function normalize(relativePath) {
  return relativePath.split(path.sep).join('/');
}

function collect(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === 'dist') continue;
    const absolute = path.join(dir, entry.name);
    const relative = normalize(path.relative(root, absolute));

    if (entry.isDirectory()) {
      if (ignoredPrefixes.some(prefix => (relative + '/').startsWith(prefix))) {
        continue;
      }
      files.push(...collect(absolute));
      continue;
    }

    if (!/\.(test|spec)\.(ts|tsx|js|jsx|mts|cts)$/.test(entry.name)) {
      continue;
    }

    if (ignoredPrefixes.some(prefix => relative.startsWith(prefix))) {
      continue;
    }

    files.push(relative);
  }

  return files;
}

const files = requested.length > 0
  ? requested
  : collect(root).sort();

if (files.length === 0) {
  console.error('[vitest-batches] No eligible Vitest files found.');
  process.exit(1);
}

console.log(
  `[vitest-batches] Running ${files.length} files in batches of up to ${batchSize}.`,
);

const executable = process.platform === 'win32' ? 'npx.cmd' : 'npx';

for (let index = 0; index < files.length; index += batchSize) {
  const batch = files.slice(index, index + batchSize);
  const batchNumber = Math.floor(index / batchSize) + 1;
  const batchCount = Math.ceil(files.length / batchSize);

  console.log(
    `\n[vitest-batches] Batch ${batchNumber}/${batchCount} (${batch.length} files)\n`,
  );

  const result = spawnSync(
    executable,
    ['vitest', 'run', ...batch],
    {
      cwd: root,
      env: {
        ...process.env,
        VITEST_BATCH_MODE: 'true',
      },
      stdio: 'inherit',
    },
  );

  if (result.error) {
    console.error('[vitest-batches] Failed to start Vitest:', result.error);
    process.exit(1);
  }

  if (result.status !== 0) {
    console.error(
      `[vitest-batches] Batch ${batchNumber}/${batchCount} failed with exit code ${result.status}.`,
    );
    process.exit(result.status || 1);
  }
}

console.log('\n[vitest-batches] All batches passed.');
