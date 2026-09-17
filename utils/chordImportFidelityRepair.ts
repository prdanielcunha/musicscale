/**
 * Plain text has no layout evidence with which to reconstruct split rows.
 * Repeated lyrics and consecutive chord rows are legitimate musical content.
 * Preserve them; rich clipboard extraction is responsible for retaining the
 * original row/column positions before this compatibility hook is reached.
 */
export function repairChordImportFidelity(input: string): string {
  return typeof input === 'string' ? input.replace(/\r\n?/g, '\n') : '';
}
