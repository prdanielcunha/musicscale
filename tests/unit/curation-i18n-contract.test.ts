import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { curationTranslations } from '../../locales/curation';

function readSource(relativePath: string) {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

function flattenKeys(value: unknown, prefix = ''): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [prefix];

  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) => {
    const next = prefix ? `${prefix}.${key}` : key;
    if (child && typeof child === 'object' && !Array.isArray(child)) {
      return flattenKeys(child, next);
    }
    return [next];
  });
}

describe('curation i18n contract', () => {
  const pageSource = readSource('pages/CurationPage.tsx');
  const i18nSource = readSource('lib/i18n.ts');

  it('keeps PT, EN, and ES resource keys synchronized', () => {
    const ptKeys = flattenKeys(curationTranslations.pt).sort();
    expect(flattenKeys(curationTranslations.en).sort()).toEqual(ptKeys);
    expect(flattenKeys(curationTranslations.es).sort()).toEqual(ptKeys);
  });

  it('registers curation resources in the existing i18next bootstrap', () => {
    expect(i18nSource).toContain('curationTranslations');
    expect(i18nSource).toContain('curation: curationTranslations.pt');
    expect(i18nSource).toContain('curation: curationTranslations.en');
    expect(i18nSource).toContain('curation: curationTranslations.es');
  });

  it('localizes the page while preserving the eligibility and reconciliation contracts', () => {
    expect(pageSource).toContain('useTranslation');
    expect(pageSource).toContain("t('curation.title')");
    expect(pageSource).toContain("t('curation.bulk.selectPage')");
    expect(pageSource).toContain("t('curation.errors.retry')");
    expect(pageSource).toContain('.filter(isBulkImportEligibleCandidate)');
    expect(pageSource).toContain('setSelectedCandidateIds(prev => prev.filter(candidateId => candidateId !== id))');
    expect(pageSource).toContain('prev.filter(candidate => candidate.candidateId !== id)');
  });
});
