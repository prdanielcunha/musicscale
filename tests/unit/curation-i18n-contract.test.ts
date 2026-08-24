import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { curationTranslations } from '../../locales/curation';
import { curationModalTranslations } from '../../locales/curationModals';

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
  const modalSources = [
    readSource('components/curation/CandidateDetailsModal.tsx'),
    readSource('components/curation/OrganizationScannerModal.tsx'),
    readSource('components/curation/InboxAnalysisModal.tsx'),
    readSource('components/curation/ImportCandidatesModal.tsx')
  ];

  it('keeps PT, EN, and ES page resource keys synchronized', () => {
    const ptKeys = flattenKeys(curationTranslations.pt).sort();
    expect(flattenKeys(curationTranslations.en).sort()).toEqual(ptKeys);
    expect(flattenKeys(curationTranslations.es).sort()).toEqual(ptKeys);
  });

  it('keeps PT, EN, and ES modal resource keys synchronized', () => {
    const ptKeys = flattenKeys(curationModalTranslations.pt).sort();
    expect(flattenKeys(curationModalTranslations.en).sort()).toEqual(ptKeys);
    expect(flattenKeys(curationModalTranslations.es).sort()).toEqual(ptKeys);
  });

  it('registers curation page and modal resources in the existing i18next bootstrap', () => {
    expect(i18nSource).toContain('curationTranslations');
    expect(i18nSource).toContain('curationModalTranslations');
    expect(i18nSource).toContain('modals: curationModalTranslations.pt');
    expect(i18nSource).toContain('modals: curationModalTranslations.en');
    expect(i18nSource).toContain('modals: curationModalTranslations.es');
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

  it('localizes every curation modal through the shared curation.modals resource', () => {
    for (const source of modalSources) {
      expect(source).toContain('useTranslation');
      expect(source).toContain('curation.modals.');
    }

    expect(modalSources[0]).toContain("t('curation.modals.candidate.title')");
    expect(modalSources[1]).toContain("t('curation.modals.scanner.title')");
    expect(modalSources[2]).toContain("t('curation.modals.inbox.title')");
    expect(modalSources[3]).toContain("t('curation.modals.import.title')");
  });
});