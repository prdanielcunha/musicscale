import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

const recovery=fs.readFileSync('components/premium/MissingSubscriptionScreen.tsx','utf8');
const selector=fs.readFileSync('components/billing/CanonicalPlanSelector.tsx','utf8');

describe('Hub trial expiry to trusted MusicScale plan selection',()=>{
  it('keeps an expired new trial in the UI without unlocking the workspace',()=>{
    expect(recovery).toContain("isExpiredTrial &&");
    expect(recovery).toContain("VITE_NEW_PLANS_UI_PRESENTATION === 'true'");
    expect(recovery).toContain('showPlanSelection');
    expect(recovery).toContain('<CanonicalPlanSelector');
    expect(recovery).toContain('ms-trial-recovery-plan-selection');
    expect(recovery).toContain('setShowPlanSelection(false)');
  });
  it('keeps technical errors and regularization at the correct Hub route',()=>{
    expect(recovery).toContain('!technicalError && canManageBilling && isExpiredTrial');
    expect(recovery).toContain('/dashboard/billing');
    expect(selector).toContain("['active','trialing','past_due','canceled']");
    expect(selector).toContain("new URLSearchParams({app:'musicscale',plan:selectedProduct.lookupKey})");
  });
  it('has parity for all languages on recovery navigation',()=>{
    for (const lang of ['pt','en','es']){
      const x=JSON.parse(fs.readFileSync(`locales/${lang}.json`,'utf8'));
      expect(x.premium.recovery.backToRecovery).toBeTruthy();
    }
  });
});