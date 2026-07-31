import fs from 'fs';

const filePath = 'playwright-results.json';
const summaryPath = process.env.GITHUB_STEP_SUMMARY || 'summary.md';

if (!fs.existsSync(filePath)) {
  fs.appendFileSync(summaryPath, '## MS-QA-AUTO-01 Execution Report\n\n**E2E NOT EXECUTED**\n\nScreenshots gerados localmente: 0\n');
  process.exit(0);
}

const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

let passed = 0;
let failed = 0;
let skipped = 0;

function countSpecs(suites) {
  for (const suite of suites) {
    if (suite.specs) {
      for (const spec of suite.specs) {
        if (spec.ok) passed++;
        else if (spec.tests.some(t => t.status === 'skipped')) skipped++;
        else failed++;
      }
    }
    if (suite.suites) {
      countSpecs(suite.suites);
    }
  }
}

if (data.suites) countSpecs(data.suites);

let projects = new Set(data.config?.projects?.map(p => p.name) || []);
const resultText = failed > 0 ? 'E2E FAILED' : (passed > 0 ? 'E2E PASSED' : 'E2E NOT EXECUTED');

const markdown = `## MS-QA-AUTO-01 Execution Report

**${resultText}**

- Total: ${passed + failed + skipped}
- Aprovados: ${passed}
- Falhos: ${failed}
- Ignorados: ${skipped}
- Projetos executados: ${projects.size}

Consulte os artefatos anexados para vídeos, traces e screenshots.
`;

fs.appendFileSync(summaryPath, markdown);
process.exit(0);
