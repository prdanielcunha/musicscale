import { areKeysEnharmonicallyEquivalent } from './chordEngine';

const KEY_ROOTS = [
  ['C'], ['C#', 'Db'], ['D'], ['Eb', 'D#'], ['E'], ['F'],
  ['F#', 'Gb'], ['G'], ['Ab', 'G#'], ['A'], ['Bb', 'A#'], ['B'],
];

/** One option per pitch and mode; retain the selected spelling without rewriting music. */
export function getMusicalKeyOptions(selectedKey = '') {
  return ['', 'm'].flatMap(mode => KEY_ROOTS.map(roots => {
    const aliases = roots.map(root => `${root}${mode}`);
    const value = aliases.some(key => areKeysEnharmonicallyEquivalent(key, selectedKey))
      ? selectedKey
      : aliases[0];
    return { value, label: aliases.join(' / ') };
  }));
}
