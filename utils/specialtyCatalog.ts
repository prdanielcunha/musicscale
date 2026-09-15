import type { Instrument, InstrumentCategory } from '../types';

// Persisted legacy tokens, never translated display labels. Unknown/custom IDs
// remain independent. Aliases are retained so existing assignments can be read.
export const DEFAULT_SPECIALTIES = [
  ['role.leader', 'Líder', 'Ministro'],
  ['role.minister', 'Ministro', 'Ministro'],
  ['voice.vocal', 'Vocal', 'Voz'],
  ['voice.backing', 'Backing Vocal', 'Voz'],
  ['voice.soprano', 'Soprano', 'Voz'],
  ['voice.alto', 'Contralto', 'Voz'],
  ['voice.tenor', 'Tenor', 'Voz'],
  ['instrument.player', 'Instrumentista', 'Instrumento'],
  ['instrument.acoustic', 'Violão', 'Instrumento'],
  ['instrument.guitar', 'Guitarra', 'Instrumento'],
  ['instrument.keyboard', 'Teclado', 'Instrumento'],
  ['instrument.piano', 'Piano', 'Instrumento'],
  ['instrument.bass', 'Baixo', 'Instrumento'],
  ['instrument.drums', 'Bateria', 'Instrumento'],
  ['instrument.percussion', 'Percussão', 'Instrumento'],
] as const;

export interface SpecialtyOption extends Instrument {
  key: string;
  aliasIds: string[];
}

export function specialtyKey(instrument: Instrument): string {
  if (instrument.key && typeof instrument.key === 'string') return instrument.key;
  const seeded = DEFAULT_SPECIALTIES.find(([key]) => instrument.id.endsWith(`__${key}`));
  if (seeded) return seeded[0];
  const legacy = DEFAULT_SPECIALTIES.find(([, name, category]) =>
    instrument.name === name && instrument.category === category);
  // Numbered slots in the legacy catalog describe one skill, not new skills.
  if (instrument.category === 'Ministro' && ['Ministro 1', 'Ministro 2'].includes(instrument.name)) return 'role.minister';
  if (instrument.category === 'Voz' && ['BV - 1', 'BV - 2', 'BV - 3'].includes(instrument.name)) return 'voice.backing';
  return legacy?.[0] || `custom.${instrument.id}`;
}

export function composeSpecialtyCatalog(instruments: Instrument[]): SpecialtyOption[] {
  const byKey = new Map<string, SpecialtyOption>();
  for (const instrument of instruments) {
    const key = specialtyKey(instrument);
    const existing = byKey.get(key);
    if (existing) {
      if (!existing.aliasIds.includes(instrument.id)) existing.aliasIds.push(instrument.id);
    } else {
      byKey.set(key, { ...instrument, key, aliasIds: [instrument.id] });
    }
  }
  return [...byKey.values()];
}

export function toggleSpecialtySelection(ids: string[], option: SpecialtyOption): string[] {
  return option.aliasIds.some(id => ids.includes(id))
    ? ids.filter(id => !option.aliasIds.includes(id))
    : [...ids, option.id];
}

export function defaultSpecialtyRecords() {
  return DEFAULT_SPECIALTIES.map(([key, name, category]) => ({ key, name, category: category as InstrumentCategory }));
}
