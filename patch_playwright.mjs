import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let content = fs.readFileSync('playwright.config.ts', 'utf8');

// replace globalSetup: require.resolve('./tests/e2e/helpers/globalSetup.ts'),
content = content.replace(
  "globalSetup: require.resolve('./tests/e2e/helpers/globalSetup.ts')",
  "globalSetup: './tests/e2e/helpers/globalSetup.ts'"
);

fs.writeFileSync('playwright.config.ts', content);
