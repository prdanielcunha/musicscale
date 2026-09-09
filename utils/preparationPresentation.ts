import type { PreparationChange } from './preparationIntelligence';

type Translate = (
  key: string,
  defaultValueOrOptions?: string | Record<string, unknown>,
  options?: Record<string, unknown>
) => string;

export function describePreparationChange(
  change: PreparationChange,
  t: Translate
): string {
  switch (change.code) {
    case 'song-added':
      return t(
        'dashboard.preparation.changes.songAdded',
        '“{{song}}” foi adicionada.',
        { song: change.label }
      );
    case 'song-removed':
      return t(
        'dashboard.preparation.changes.songRemoved',
        '“{{song}}” foi removida.',
        { song: change.label }
      );
    case 'song-key-changed':
      return t(
        'dashboard.preparation.changes.songKeyChanged',
        '“{{song}}”: tom {{from}} → {{to}}.',
        {
          song: change.label,
          from: change.from || '—',
          to: change.to || '—',
        }
      );
    case 'song-order-changed':
      return t(
        'dashboard.preparation.changes.songOrderChanged',
        '“{{song}}”: posição {{from}} → {{to}}.',
        {
          song: change.label,
          from: change.from,
          to: change.to,
        }
      );
    case 'time-changed':
      return t(
        'dashboard.preparation.changes.timeChanged',
        'Horário: {{from}} → {{to}}.',
        {
          from: change.from || '—',
          to: change.to || '—',
        }
      );
    case 'location-changed':
      return t(
        'dashboard.preparation.changes.locationChanged',
        'Local: {{from}} → {{to}}.',
        {
          from: change.from || '—',
          to: change.to || '—',
        }
      );
    case 'role-changed':
      return t(
        'dashboard.preparation.changes.roleChanged',
        'Sua função: {{from}} → {{to}}.',
        {
          from: change.from || '—',
          to: change.to || '—',
        }
      );
    default:
      return change.label;
  }
}
