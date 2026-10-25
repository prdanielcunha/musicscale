import { nestAiProtectedHeaders } from './nestAiBrowser';

export async function requestChordRepair(input: {
  organizationId: string; chords: string; instructions: string;
}): Promise<string> {
  const response = await fetch('/api/fix-chords', {
    method: 'POST', headers: await nestAiProtectedHeaders(), body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error(response.status === 429 ? 'aiLimitError'
      : response.status === 401 || response.status === 403 ? 'aiAccessError' : 'aiFixError');
  }
  const data = await response.json();
  if (typeof data.fixedChords !== 'string' || !data.fixedChords.trim() || data.fixedChords.length > 60000) {
    throw new Error('aiFixError');
  }
  return data.fixedChords;
}
