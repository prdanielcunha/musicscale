import fs from 'fs';
import path from 'path';
import assert from 'assert';

function runContractTests() {
  console.log('[Test] Running MillionsNest MusicScale Landing Contract Verification...');

  const rootDir = process.cwd();

  const flagshipPath = path.join(rootDir, 'src/components/Flagship.tsx');
  const landingPath = path.join(rootDir, 'src/pages/MusicScaleLanding.tsx');
  const pricingPath = path.join(rootDir, 'src/components/Pricing.tsx');
  const faqPath = path.join(rootDir, 'src/components/FAQ.tsx');
  const salesChatPath = path.join(rootDir, 'src/components/SalesChat.tsx');
  const checkoutPath = path.join(rootDir, 'src/pages/Checkout.tsx');

  const ptPath = path.join(rootDir, 'src/packages/i18n/locales/pt.ts');
  const enPath = path.join(rootDir, 'src/packages/i18n/locales/en.ts');
  const esPath = path.join(rootDir, 'src/packages/i18n/locales/es.ts');

  const requiredFiles = [
    flagshipPath,
    landingPath,
    pricingPath,
    faqPath,
    salesChatPath,
    checkoutPath,
    ptPath,
    enPath,
    esPath
  ];

  for (const file of requiredFiles) {
    assert(fs.existsSync(file), `Required file missing: ${file}`);
  }

  const flagshipContent = fs.readFileSync(flagshipPath, 'utf-8');
  const landingContent = fs.readFileSync(landingPath, 'utf-8');
  const pricingContent = fs.readFileSync(pricingPath, 'utf-8');
  const faqContent = fs.readFileSync(faqPath, 'utf-8');
  const salesChatContent = fs.readFileSync(salesChatPath, 'utf-8');
  const checkoutContent = fs.readFileSync(checkoutPath, 'utf-8');

  const ptContent = fs.readFileSync(ptPath, 'utf-8');
  const enContent = fs.readFileSync(enPath, 'utf-8');
  const esContent = fs.readFileSync(esPath, 'utf-8');

  let passedTestsCount = 0;

  // 1. Flagship utiliza subscription_scope_badge
  assert(
    flagshipContent.includes('subscription_scope_badge'),
    'Flagship.tsx must use subscription_scope_badge'
  );
  passedTestsCount++;

  // 2. Flagship utiliza subscription_scope_desc
  assert(
    flagshipContent.includes('subscription_scope_desc'),
    'Flagship.tsx must use subscription_scope_desc'
  );
  passedTestsCount++;

  // 3. MusicScaleLanding utiliza subscription_scope_badge
  assert(
    landingContent.includes('subscription_scope_badge'),
    'MusicScaleLanding.tsx must use subscription_scope_badge'
  );
  passedTestsCount++;

  // 4. MusicScaleLanding utiliza subscription_scope_desc
  assert(
    landingContent.includes('subscription_scope_desc'),
    'MusicScaleLanding.tsx must use subscription_scope_desc'
  );
  passedTestsCount++;

  // 5. Pricing utiliza pricing_scope_title
  assert(
    pricingContent.includes('pricing_scope_title'),
    'Pricing.tsx must use pricing_scope_title'
  );
  passedTestsCount++;

  // 6. Pricing utiliza pricing_scope_desc
  assert(
    pricingContent.includes('pricing_scope_desc'),
    'Pricing.tsx must use pricing_scope_desc'
  );
  passedTestsCount++;

  // 7. Pricing utiliza pricing_scope_label
  assert(
    pricingContent.includes('pricing_scope_label'),
    'Pricing.tsx must use pricing_scope_label'
  );
  passedTestsCount++;

  // 8. FAQ inclui faq_q5
  assert(
    faqContent.includes('faq_q5'),
    'FAQ.tsx must include faq_q5'
  );
  passedTestsCount++;

  // 9. FAQ inclui faq_a5
  assert(
    faqContent.includes('faq_a5'),
    'FAQ.tsx must include faq_a5'
  );
  passedTestsCount++;

  // 10. SalesChat inclui faq_q5
  assert(
    salesChatContent.includes('faq_q5'),
    'SalesChat.tsx must include faq_q5'
  );
  passedTestsCount++;

  // 11. SalesChat inclui faq_a5
  assert(
    salesChatContent.includes('faq_a5'),
    'SalesChat.tsx must include faq_a5'
  );
  passedTestsCount++;

  // 12. Checkout utiliza subscription_scope_title
  assert(
    checkoutContent.includes('subscription_scope_title'),
    'Checkout.tsx must use subscription_scope_title'
  );
  passedTestsCount++;

  // 13. Checkout utiliza subscription_scope_desc
  assert(
    checkoutContent.includes('subscription_scope_desc'),
    'Checkout.tsx must use subscription_scope_desc'
  );
  passedTestsCount++;

  // 14. pt.ts possui todas as novas chaves
  const requiredKeys = [
    'subscription_scope_badge',
    'subscription_scope_desc',
    'pricing_scope_title',
    'pricing_scope_desc',
    'pricing_scope_label',
    'faq_q5',
    'faq_a5',
    'subscription_scope_title'
  ];
  for (const key of requiredKeys) {
    assert(ptContent.includes(key), `pt.ts missing key: ${key}`);
  }
  passedTestsCount++;

  // 15. en.ts possui todas as novas chaves
  for (const key of requiredKeys) {
    assert(enContent.includes(key), `en.ts missing key: ${key}`);
  }
  passedTestsCount++;

  // 16. es.ts possui todas as novas chaves
  for (const key of requiredKeys) {
    assert(esContent.includes(key), `es.ts missing key: ${key}`);
  }
  passedTestsCount++;

  // 17. a mensagem portuguesa contém “não por pessoa”
  assert(
    ptContent.includes('não por pessoa'),
    'pt.ts must contain "não por pessoa"'
  );
  passedTestsCount++;

  // 18. a mensagem portuguesa contém “sem cobrança individual”
  assert(
    ptContent.includes('sem cobrança individual'),
    'pt.ts must contain "sem cobrança individual"'
  );
  passedTestsCount++;

  // 19. os lookupKeys atuais permanecem
  const expectedLookupKeys = [
    'musicscale_starter_monthly',
    'musicscale_starter_yearly',
    'musicscale_advanced_monthly',
    'musicscale_advanced_yearly',
    'musicscale_pro_monthly',
    'musicscale_pro_yearly'
  ];
  for (const lkey of expectedLookupKeys) {
    assert(pricingContent.includes(lkey), `Pricing.tsx missing lookupKey: ${lkey}`);
  }
  passedTestsCount++;

  // 20. os planos Starter, Advanced e Pro permanecem
  assert(pricingContent.includes('Starter'), 'Pricing.tsx missing Starter plan');
  assert(pricingContent.includes('Advanced'), 'Pricing.tsx missing Advanced plan');
  assert(pricingContent.includes('Pro'), 'Pricing.tsx missing Pro plan');
  passedTestsCount++;

  // 21. o teste gratuito permanece
  assert(
    pricingContent.toLowerCase().includes('7 dias') || pricingContent.toLowerCase().includes('grátis'),
    'Pricing.tsx must retain free trial mention'
  );
  passedTestsCount++;

  // 22. nenhuma lógica de Stripe foi adicionada aos componentes comerciais
  assert(!flagshipContent.includes('stripe.com'), 'Flagship.tsx must not contain Stripe SDK calls');
  assert(!pricingContent.includes('stripe.com'), 'Pricing.tsx must not contain Stripe SDK calls');
  assert(!faqContent.includes('stripe.com'), 'FAQ.tsx must not contain Stripe SDK calls');
  assert(!salesChatContent.includes('stripe.com'), 'SalesChat.tsx must not contain Stripe SDK calls');
  passedTestsCount++;

  // 23. nenhum endpoint foi modificado
  assert(!flagshipContent.includes('/api/v1/stripe'), 'Commercial components must not call stripe endpoints');
  passedTestsCount++;

  // 24. nenhum preço foi transformado em preço por usuário
  assert(!pricingContent.includes('/usuário/mês'), 'Pricing must not introduce per-user price badges');
  assert(!pricingContent.includes('/membro/mês'), 'Pricing must not introduce per-member price badges');
  passedTestsCount++;

  // 25. nenhum arquivo temporário ou relatório foi criado
  const forbiddenFiles = ['temp_report.txt', 'report.json', 'tmp.ts'];
  for (const forbidden of forbiddenFiles) {
    assert(!fs.existsSync(path.join(rootDir, forbidden)), `Forbidden temp file found: ${forbidden}`);
  }
  passedTestsCount++;

  console.log(`[Test SUCCESS] All ${passedTestsCount} contract assertions passed cleanly.`);
}

runContractTests();
