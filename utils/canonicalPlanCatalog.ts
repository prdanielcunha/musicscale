import type { MusicScalePlan } from '../services/entitlementsConstants';

export type CatalogCycle = 'monthly' | 'yearly';
export type CatalogProduct = {
  lookupKey: string;
  app: string;
  type: string;
  price: number;
  currency: string;
  interval: string;
  invalidConfiguration?: boolean;
};
export type CatalogPriceMap = Partial<Record<MusicScalePlan, Partial<Record<CatalogCycle, CatalogProduct>>>>;

export function toMusicScalePlanCatalog(raw: unknown): CatalogPriceMap {
  const result: CatalogPriceMap = {};
  if (!raw || typeof raw !== 'object' || !Array.isArray((raw as any).plans)) return result;
  for (const row of (raw as any).plans as unknown[]) {
    if (!row || typeof row !== 'object') continue;
    const product = row as CatalogProduct;
    const match = /^musicscale_(starter|advanced|pro)_(monthly|yearly)$/.exec(String(product.lookupKey || ''));
    if (!match || product.app !== 'musicscale' || product.type !== 'plan' ||
        !Number.isFinite(product.price) || product.price <= 0 ||
        !/^[A-Z]{3}$/i.test(String(product.currency || '')) ||
        product.interval !== (match[2] === 'yearly' ? 'year' : 'month') ||
        product.invalidConfiguration === true) continue;
    const tier = match[1] as MusicScalePlan, cycle = match[2] as CatalogCycle;
    if (!result[tier]) result[tier] = {};
    result[tier]![cycle] = product;
  }
  return result;
}

export function catalogAnnualSavings(monthly: number, yearly: number): number {
  if (![monthly, yearly].every(Number.isFinite) || monthly <= 0 || yearly <= 0) return 0;
  return Math.max(0, Math.round(100 * (1 - yearly / (monthly * 12))));
}
