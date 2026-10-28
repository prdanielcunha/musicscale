import { afterEach, describe, expect, it, vi } from 'vitest';

// Exercise the real initialization/backend contract rather than the UI t() stub.
vi.unmock('react-i18next');

afterEach(() => { localStorage.removeItem('millionsnest_i18n_lng'); });

describe('on-demand language catalogs', () => {
  it.each([
    ['pt-BR', 'pt', 'Aplicar correção'],
    ['en-US', 'en', 'Apply correction'],
    ['es-ES', 'es', 'Aplicar corrección'],
  ])('awaits the selected catalog for %s and preserves runtime language switching', async (selected, base, expected) => {
    vi.resetModules();
    localStorage.setItem('millionsnest_i18n_lng', selected);
    const { default: i18n, i18nReady } = await import('../../lib/i18n');
    await i18nReady;
    expect(i18n.resolvedLanguage).toBe(base);
    expect(document.documentElement.lang).toBe(base);
    expect(i18n.t('chordKeyRepair.apply')).toBe(expected);
    expect(i18n.hasResourceBundle('pt', 'translation')).toBe(true);
    await i18n.changeLanguage('en');
    expect(i18n.t('chordKeyRepair.apply')).toBe('Apply correction');
    await i18n.changeLanguage('es');
    expect(i18n.t('chordKeyRepair.apply')).toBe('Aplicar corrección');
    expect(document.documentElement.lang).toBe('es');
  });
});
