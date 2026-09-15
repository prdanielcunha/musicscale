import { describe, expect, it } from 'vitest';
import { composeSpecialtyCatalog, defaultSpecialtyRecords, toggleSpecialtySelection } from '../../utils/specialtyCatalog';
import pt from '../../locales/pt.json';
import en from '../../locales/en.json';
import es from '../../locales/es.json';

describe('canonical specialty composition', () => {
  const records = [
    { id: 'legacy-a', name: 'Teclado', category: 'Instrumento' as const },
    { id: 'legacy-b', name: 'Teclado', category: 'Instrumento' as const },
    { id: 'minister-a', name: 'Ministro 1', category: 'Ministro' as const },
    { id: 'minister-b', name: 'Ministro 2', category: 'Ministro' as const },
    { id: 'custom-1', name: 'Synth bass', category: 'Instrumento' as const },
    { id: 'custom-2', name: 'Synth bass', category: 'Instrumento' as const },
  ];
  it('deduplicates known legacy aliases by canonical key while keeping both custom IDs', () => {
    const options = composeSpecialtyCatalog(records);
    expect(options.map(option => option.key)).toEqual(['instrument.keyboard', 'role.minister', 'custom.custom-1', 'custom.custom-2']);
    expect(options[0].aliasIds).toEqual(['legacy-a', 'legacy-b']);
    expect(records).toHaveLength(6);
  });
  it('preserves selected legacy IDs until an explicit selection change', () => {
    const option = composeSpecialtyCatalog(records)[0];
    const selected = ['legacy-b', 'custom-1', 'unknown-legacy'];
    expect(option.aliasIds.some(id => selected.includes(id))).toBe(true);
    expect(toggleSpecialtySelection(selected, option)).toEqual(['custom-1', 'unknown-legacy']);
    expect(selected).toEqual(['legacy-b', 'custom-1', 'unknown-legacy']);
  });
  it.each([pt, en, es])('translates a single stable catalog without composing by display text', locale => {
    const defaults = defaultSpecialtyRecords();
    expect(new Set(defaults.map(item => item.key)).size).toBe(defaults.length);
    for (const item of defaults) {
      const [group, key] = item.key.split('.');
      expect((locale.refinement.specialties as any)[group][key]).toBeTruthy();
    }
    expect(composeSpecialtyCatalog(records)).toHaveLength(4);
  });
});
