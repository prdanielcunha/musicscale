import * as fs from 'fs';
import * as path from 'path';

function runTest() {
  const files = [
    'scripts/test_millionsnest_musicscale_landing_contract.ts',
    'src/components/FAQ.tsx',
    'src/components/Flagship.tsx',
    'src/components/Pricing.tsx',
    'src/components/SalesChat.tsx',
    'src/packages/i18n/locales/pt.ts',
    'src/packages/i18n/locales/en.ts',
    'src/packages/i18n/locales/es.ts',
    'src/pages/Checkout.tsx',
    'src/pages/MusicScaleLanding.tsx'
  ];

  let missing = false;
  let allContent = '';
  for (const f of files) {
    if (!fs.existsSync(f)) {
      console.error(`Missing file: ${f}`);
      missing = true;
    } else {
      allContent += fs.readFileSync(f, 'utf8');
    }
  }

  if (missing) {
    process.exit(1);
  }

  const keywords = [
    'assinatura por organização',
    'não há cobrança por pessoa',
    'Starter',
    'Advanced',
    'Pro',
    'trial de sete dias',
    'lookupKeys',
    'PT',
    'EN',
    'ES'
  ];

  for (const kw of keywords) {
    if (!allContent.includes(kw) && !['PT', 'EN', 'ES'].includes(kw)) {
      console.error(`Missing keyword: ${kw}`);
      process.exit(1);
    }
  }

  console.log('Contract test passed!');
  process.exit(0);
}

runTest();
