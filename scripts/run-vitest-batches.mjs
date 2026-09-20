import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const root = process.cwd();
const requested = process.argv.slice(2).filter(Boolean);
const batchSize = Math.max(
  1,
  Number.parseInt(process.env.VITEST_BATCH_SIZE || '18', 10) || 18,
);
const batchTimeoutMs = Math.max(
  60_000,
  Number.parseInt(process.env.VITEST_BATCH_TIMEOUT_MS || '600000', 10) ||
    600_000,
);
const exitGraceMs = Math.max(
  1_000,
  Number.parseInt(process.env.VITEST_EXIT_GRACE_MS || '10000', 10) ||
    10_000,
);

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
      if (
        ignoredPrefixes.some(prefix =>
          (relative + '/').startsWith(prefix),
        )
      ) {
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

const defaultRoots = [
  'tests',
  'components/tests',
  'services/tests',
];

const files = requested.length > 0
  ? requested
  : defaultRoots
      .flatMap(relativeRoot => {
        const absoluteRoot = path.join(root, relativeRoot);
        return fs.existsSync(absoluteRoot) ? collect(absoluteRoot) : [];
      })
      .sort();

if (files.length === 0) {
  console.error('[vitest-batches] No eligible Vitest files found.');
  process.exit(1);
}

const vitestBin = path.join(
  root,
  'node_modules',
  'vitest',
  'vitest.mjs',
);

if (!fs.existsSync(vitestBin)) {
  console.error('[vitest-batches] Vitest binary not found:', vitestBin);
  process.exit(1);
}

function readReport(reportPath) {
  try {
    if (!fs.existsSync(reportPath)) return null;
    const raw = fs.readFileSync(reportPath, 'utf8');
    if (!raw.trim()) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function killProcessTree(child, signal = 'SIGTERM') {
  if (!child.pid) return;

  try {
    if (process.platform !== 'win32') {
      process.kill(-child.pid, signal);
    } else {
      child.kill(signal);
    }
  } catch {
    try {
      child.kill(signal);
    } catch {
      // Process already ended.
    }
  }
}

function printFailures(report) {
  const failures = [];

  for (const testResult of report?.testResults || []) {
    for (const assertion of testResult?.assertionResults || []) {
      if (assertion?.status !== 'failed') continue;
      failures.push({
        file: testResult?.name || 'unknown-file',
        name: assertion?.fullName || assertion?.title || 'unknown-test',
        messages: Array.isArray(assertion?.failureMessages)
          ? assertion.failureMessages
          : [],
      });
    }
  }

  for (const failure of failures.slice(0, 20)) {
    console.error(
      `[vitest-batches] FAIL ${failure.file} :: ${failure.name}`,
    );
    for (const message of failure.messages.slice(0, 3)) {
      console.error(String(message));
    }
  }

  if (failures.length > 20) {
    console.error(
      `[vitest-batches] ...and ${failures.length - 20} more failing tests.`,
    );
  }
}

async function runBatch(batch, batchNumber, batchCount) {
  const reportDir = fs.mkdtempSync(
    path.join(os.tmpdir(), 'musicscale-vitest-'),
  );
  const reportPath = path.join(reportDir, 'report.json');

  console.log(
    `\n[vitest-batches] Batch ${batchNumber}/${batchCount} (${batch.length} files)\n`,
  );

  const child = spawn(
    process.execPath,
    [
      vitestBin,
      'run',
      ...batch,
      '--reporter=json',
      `--outputFile=${reportPath}`,
    ],
    {
      cwd: root,
      env: {
        ...process.env,
        VITEST_BATCH_MODE: 'true',
      },
      stdio: 'inherit',
      detached: process.platform !== 'win32',
    },
  );

  let settled = false;
  let resolveExit;
  const exitPromise = new Promise(resolve => {
    resolveExit = resolve;
  });

  child.on('exit', (code, signal) => {
    if (settled) return;
    settled = true;
    resolveExit({ code, signal });
  });

  child.on('error', error => {
    console.error('[vitest-batches] Failed to start Vitest:', error);
    if (!settled) {
      settled = true;
      resolveExit({ code: 1, signal: null });
    }
  });

  const startedAt = Date.now();
  let report = null;

  while (!settled && Date.now() - startedAt < batchTimeoutMs) {
    report = readReport(reportPath);

    if (report) {
      const successful =
        report.success === true &&
        Number(report.numFailedTests || 0) === 0 &&
        Number(report.numFailedTestSuites || 0) === 0;

      console.log(
        `[vitest-batches] Batch ${batchNumber}/${batchCount}: ` +
          `${report.numPassedTests || 0}/${report.numTotalTests || 0} tests passed.`,
      );

      if (!successful) {
        console.error(
          `[vitest-batches] Batch ${batchNumber}/${batchCount} reported test failures.`,
        );
        printFailures(report);
        killProcessTree(child, 'SIGTERM');
        await new Promise(resolve => setTimeout(resolve, 1000));
        if (!settled) killProcessTree(child, 'SIGKILL');
        fs.rmSync(reportDir, { recursive: true, force: true });
        return false;
      }

      const naturalExit = await Promise.race([
        exitPromise.then(value => ({ type: 'exit', value })),
        new Promise(resolve =>
          setTimeout(
            () => resolve({ type: 'grace-expired' }),
            exitGraceMs,
          ),
        ),
      ]);

      if (naturalExit.type === 'grace-expired' && !settled) {
        console.warn(
          `[vitest-batches] Batch ${batchNumber}/${batchCount} finished green but Vitest did not exit within ${exitGraceMs}ms; terminating residual test processes.`,
        );
        killProcessTree(child, 'SIGTERM');
        await new Promise(resolve => setTimeout(resolve, 1000));
        if (!settled) killProcessTree(child, 'SIGKILL');
      }

      fs.rmSync(reportDir, { recursive: true, force: true });
      return true;
    }

    await Promise.race([
      exitPromise,
      new Promise(resolve => setTimeout(resolve, 500)),
    ]);
  }

  if (!settled) {
    console.error(
      `[vitest-batches] Batch ${batchNumber}/${batchCount} exceeded ${batchTimeoutMs}ms without a final report.`,
    );
    killProcessTree(child, 'SIGTERM');
    await new Promise(resolve => setTimeout(resolve, 1000));
    if (!settled) killProcessTree(child, 'SIGKILL');
    fs.rmSync(reportDir, { recursive: true, force: true });
    return false;
  }

  const reportAfterExit = readReport(reportPath);
  const result = await exitPromise;
  const successful =
    result.code === 0 &&
    reportAfterExit?.success === true &&
    Number(reportAfterExit?.numFailedTests || 0) === 0 &&
    Number(reportAfterExit?.numFailedTestSuites || 0) === 0;

  if (!successful) {
    console.error(
      `[vitest-batches] Batch ${batchNumber}/${batchCount} exited without a successful final report (code=${result.code}, signal=${result.signal || 'none'}).`,
    );
    if (reportAfterExit) printFailures(reportAfterExit);
  }

  fs.rmSync(reportDir, { recursive: true, force: true });
  return successful;
}

console.log(
  `[vitest-batches] Running ${files.length} files in batches of up to ${batchSize}.`,
);

const batchCount = Math.ceil(files.length / batchSize);

for (let index = 0; index < files.length; index += batchSize) {
  const batch = files.slice(index, index + batchSize);
  const batchNumber = Math.floor(index / batchSize) + 1;

  const ok = await runBatch(batch, batchNumber, batchCount);
  if (!ok) process.exit(1);
}

console.log('\n[vitest-batches] All batches passed.');
