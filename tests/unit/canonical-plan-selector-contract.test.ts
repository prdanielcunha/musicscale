import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { catalogAnnualSavings, toMusicScalePlanCatalog } from '../../components/billing/CanonicalPlanSelector';

describe('MillionsNest canonical MusicScale plan selector', () => {
  it('maps exactly the 6 server-catalog MusicScale plan lookup keys', () => {
    const plans = ['starter','advanced','pro'].flatMap((tier, i) => [
      { lookupKey:`musicscale_${tier}_monthly`,app:'musicscale',type:'plan',price:[19.90,29.90,34.90][i],currency:'brl',interval:'month' },
      { lookupKey:`musicscale_${tier}_yearly`,app:'musicscale',type:'plan',price:[191.04,287.04,335.04][i],currency:'brl',interval:'year' },
    ]);
    const map = toMusicScalePlanCatalog({plans});
    expect(map.starter?.monthly?.price).toBe(19.90);
    expect(map.advanced?.yearly?.price).toBe(287.04);
    expect(map.pro?.monthly?.price).toBe(34.90);
    expect(map.pro?.yearly?.price).toBe(335.04);
    expect(catalogAnnualSavings(map.pro!.monthly!.price,map.pro!.yearly!.price)).toBe(20);
  });

  it('ignores other applications, unsupported products, wrong periods and invalid prices', () => {
    const map=toMusicScalePlanCatalog({plans:[
      {lookupKey:'musicscale_starter_monthly',app:'nestlocal',type:'plan',price:19.9,currency:'brl',interval:'month'},
      {lookupKey:'musicscale_pro_monthly',app:'musicscale',type:'plan',price:34.9,currency:'brl',interval:'year'},
      {lookupKey:'musicscale_advanced_monthly',app:'musicscale',type:'plan',price:-5,currency:'brl',interval:'month'},
      {lookupKey:'musicscale_starter_yearly',app:'musicscale',type:'plan',price:10,currency:'brl',interval:'year',invalidConfiguration:true},
      {lookupKey:'musicscale_worship_100',app:'musicscale',type:'addon',price:40,currency:'brl',interval:'one_time'},
    ]});
    expect(map).toEqual({});
    expect(toMusicScalePlanCatalog(null)).toEqual({});
    expect(catalogAnnualSavings(19.9,300)).toBe(0);
  });

  it('routes through authenticated Hub Checkout and retains separate manager path', () => {
    const source=fs.readFileSync('components/billing/CanonicalPlanSelector.tsx','utf8');
    expect(source).toContain("new URLSearchParams({app:'musicscale',plan:selectedProduct.lookupKey})");
    expect(source).toContain('/dashboard/billing');
    expect(fs.readFileSync('pages/PlansPage.tsx','utf8')).toContain('VITE_NEW_PLANS_UI_PRESENTATION');
    expect(source).not.toContain('trial_period_days');
  });
});
