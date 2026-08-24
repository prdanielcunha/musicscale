import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function readSource(relativePath: string) {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

describe('document language i18n contract', () => {
  const htmlSource = readSource('index.html');
  const i18nSource = readSource('lib/i18n.ts');

  it('starts with the same Portuguese fallback used by i18next', () => {
    expect(htmlSource).toContain('<html lang="pt">');
    expect(i18nSource).toContain('fallbackLng: "pt"');
  });

  it('keeps the document language synchronized after detection and language changes', () => {
    expect(i18nSource).toContain('document.documentElement.lang = resolveDocumentLanguage(language)');
    expect(i18nSource).toContain('i18n.on("languageChanged", syncDocumentLanguage)');
    expect(i18nSource).toContain('i18n.on("initialized", () =>');
  });

  it('limits document language values to PT, EN, and ES with a Portuguese fallback', () => {
    expect(i18nSource).toContain('new Set(["pt", "en", "es"])');
    expect(i18nSource).toContain('language?.toLowerCase().split("-")[0]');
    expect(i18nSource).toContain('? baseLanguage : "pt"');
  });

  it('does not require a browser document during server or test initialization', () => {
    expect(i18nSource).toContain('if (typeof document === "undefined") return');
  });
});
