import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PLAN_LIMITS } from '../services/entitlementsConstants.js';
import { PLAN_PRICING_DETAILS } from '../lib/limits.js';

const plansPage = fs.readFileSync('pages/PlansPage.tsx', 'utf8');
const legacyPricing = fs.readFileSync('src/components/Pricing.tsx', 'utf8');
const legacyFaq = fs.readFileSync('src/components/FAQ.tsx', 'utf8');
const legacySalesChat = fs.readFileSync('src/components/SalesChat.tsx', 'utf8');
const legacyCheckout = fs.readFileSync('src/pages/Checkout.tsx', 'utf8');
const pt = JSON.parse(fs.readFileSync('locales/pt.json', 'utf8'));
const en = JSON.parse(fs.readFileSync('locales/en.json', 'utf8'));
const es = JSON.parse(fs.readFileSync('locales/es.json', 'utf8'));

assert.equal(PLAN_LIMITS.starter.users, 10);
assert.equal(PLAN_LIMITS.advanced.users, 20);
assert.equal(PLAN_LIMITS.pro.users, -1);
assert.equal(PLAN_LIMITS.starter.libraryImportsPerMonth, 0);
assert.equal(PLAN_LIMITS.advanced.libraryImportsPerMonth, 10);
assert.equal(PLAN_LIMITS.pro.libraryImportsPerMonth, -1);
assert.equal(PLAN_PRICING_DETAILS.starter.price, 'R$ 19,90');
assert.equal(PLAN_PRICING_DETAILS.advanced.price, 'R$ 29,90');
assert.equal(PLAN_PRICING_DETAILS.pro.price, 'R$ 34,90');
assert.equal(PLAN_PRICING_DETAILS.pro.badge, 'Lançamento');

assert.match(plansPage, /\/api\/v1\/billing\/products/);
assert.match(plansPage, /musicscale_\$\{planId\}_monthly/);
assert.match(plansPage, /pro_highlight/);
assert.equal(plansPage.includes('RECOMENDADO E MAIS VENDIDO'), false);
assert.equal(plansPage.includes('pro_original_price'), false);
assert.equal(plansPage.includes('De R$ 39,90'), false);

for (const [lang, locale] of [['pt', pt], ['en', en], ['es', es]] as const) {
  assert.ok(locale.plans?.pro_highlight, `${lang} plans.pro_highlight missing`);
  assert.ok(locale.plans?.features?.advanced?.['4'], `${lang} Advanced import translation missing`);
  assert.ok(locale.plans?.features?.pro?.['5'], `${lang} Pro AI translation missing`);
  assert.ok(locale.plans?.limits?.starter?.['1'], `${lang} Starter limit translation missing`);
}

const commercialLegacy = [legacyPricing, legacyFaq, legacySalesChat, legacyCheckout].join('\n');
for (const stale of [
  'R$ 49,90','R$ 89,90','R$ 149,90','R$ 69,90',
  'Até 30 usuários','Até 100 usuários','Mais Popular',
  'Gerente de conta dedicado','PIX na contratação de planos anuais',
  '7 dias de acesso completo sem compromisso'
]) {
  assert.equal(commercialLegacy.includes(stale), false, `stale commercial claim must not return: ${stale}`);
}

console.log('PASS MusicScale sales truth, pricing authority, and i18n contract');
