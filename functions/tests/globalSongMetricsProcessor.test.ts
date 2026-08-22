import assert from 'assert';
import fs from 'node:fs';
import path from 'node:path';
import { processGlobalSongContentMetricsWritten } from '../src/globalSongMetricsProcessor.js';
import { deriveGlobalSongContentMetrics } from '../../utils/globalSongContentMetrics.js';
import { buildGlobalSongSearchFields, GLOBAL_SEARCH_VERSION } from '../../utils/searchEngine.js';

function createSnapshot(initialData: Record<string, unknown>) {
  let currentData = { ...initialData };
  const updates: Record<string, unknown>[] = [];

  const snapshot = {
    data: () => currentData,
    ref: {
      update: async (payload: Record<string, unknown>) => {
        updates.push({ ...payload });
        currentData = { ...currentData, ...payload };
      }
    }
  };

  return {
    snapshot,
    updates,
    current: () => currentData
  };
}

function canonicalDerived(song: Record<string, unknown>) {
  return {
    ...deriveGlobalSongContentMetrics({ chords: song.chords, lyrics: song.lyrics }),
    ...buildGlobalSongSearchFields(song),
  };
}

async function runGlobalSongMetricsProcessorTests() {
  console.log('Running Global Song derived-fields processor tests...');

  // A. Um documento legado converge métricas + Search v3 em uma única escrita.
  {
    const source = {
      title: 'Graça Infinita',
      artist: 'Banda Esperança',
      key: 'C',
      chords: 'C G\nGraça me alcançou\nAm F',
      lyrics: 'Eu vivo pela fé',
    };
    const { snapshot, updates, current } = createSnapshot(source);
    await processGlobalSongContentMetricsWritten(snapshot as any);

    assert.strictEqual(updates.length, 1);
    assert.strictEqual(updates[0].hasChords, true);
    assert.strictEqual(updates[0].hasLyrics, true);
    assert.strictEqual(updates[0].isComplete, true);
    assert.strictEqual(updates[0].searchVersion, GLOBAL_SEARCH_VERSION);
    assert((updates[0].searchTokens as string[]).includes('graca'));
    assert((updates[0].searchContentTokens as string[]).includes('fe'));
    assert((updates[0].searchContentTokens as string[]).includes('alcancou'));
    assert.strictEqual(current().title, source.title);
    assert.strictEqual(current().artist, source.artist);
  }

  // B. A segunda invocação sobre o documento já convergido é zero-write.
  {
    const source = {
      title: 'Canção Estável',
      artist: 'Coletivo Um',
      chords: 'C\nTua graça basta',
      lyrics: 'Tua graça basta',
    };
    const { snapshot, updates } = createSnapshot(source);
    await processGlobalSongContentMetricsWritten(snapshot as any);
    assert.strictEqual(updates.length, 1);
    await processGlobalSongContentMetricsWritten(snapshot as any);
    assert.strictEqual(updates.length, 1);
  }

  // C. Mudança de título/artista repara apenas os índices derivados que divergiram.
  {
    const oldSong = {
      title: 'Nome Antigo',
      artist: 'Grupo Antigo',
      chords: '',
      lyrics: 'Letra preservada',
    };
    const changedSong = {
      ...oldSong,
      ...canonicalDerived(oldSong),
      title: 'Nova Canção',
      artist: 'Coletivo Renovado',
    };
    const { snapshot, updates } = createSnapshot(changedSong);
    await processGlobalSongContentMetricsWritten(snapshot as any);

    assert.strictEqual(updates.length, 1);
    assert((updates[0].searchTokens as string[]).includes('nova'));
    assert((updates[0].searchTokens as string[]).includes('coletivo'));
    assert((updates[0].searchTitlePrefixes as string[]).includes('nov'));
    assert((updates[0].searchArtistPrefixes as string[]).includes('col'));
    assert.strictEqual('hasChords' in updates[0], false);
    assert.strictEqual('hasLyrics' in updates[0], false);
    assert.strictEqual('isComplete' in updates[0], false);
  }

  // D. Mudança de letra/cifra mantém métricas e conteúdo pesquisável no mesmo write.
  {
    const oldSong = {
      title: 'Transformação',
      artist: 'Banda Dois',
      chords: '',
      lyrics: 'Primeira versão',
    };
    const changedSong = {
      ...oldSong,
      ...canonicalDerived(oldSong),
      chords: 'D A\nMuralhas vão cair\nBm G',
      lyrics: 'Uma nova história começou',
    };
    const { snapshot, updates } = createSnapshot(changedSong);
    await processGlobalSongContentMetricsWritten(snapshot as any);

    assert.strictEqual(updates.length, 1);
    assert.strictEqual(updates[0].hasChords, true);
    assert((updates[0].searchContentTokens as string[]).includes('muralhas'));
    assert((updates[0].searchContentTokens as string[]).includes('historia'));
  }

  // E. Símbolos de acordes puros não entram em searchContentTokens.
  {
    const source = {
      title: 'Cântico',
      artist: 'Banda Três',
      chords: 'C G\nGraça me alcançou\nAm F',
      lyrics: '',
    };
    const { snapshot, updates } = createSnapshot(source);
    await processGlobalSongContentMetricsWritten(snapshot as any);
    const contentTokens = updates[0].searchContentTokens as string[];
    assert(contentTokens.includes('graca'));
    assert(contentTokens.includes('alcancou'));
    assert(!contentTokens.includes('c'));
    assert(!contentTokens.includes('g'));
    assert(!contentTokens.includes('am'));
    assert(!contentTokens.includes('f'));
  }

  // F. Se apenas métricas estão erradas, o payload não reescreve índices já corretos.
  {
    const source = {
      title: 'Somente Métricas',
      artist: 'Banda Quatro',
      chords: 'C\nCantarei',
      lyrics: 'Cantarei',
    };
    const data = {
      ...source,
      ...buildGlobalSongSearchFields(source),
      hasChords: false,
      hasLyrics: false,
      isComplete: false,
    };
    const { snapshot, updates } = createSnapshot(data);
    await processGlobalSongContentMetricsWritten(snapshot as any);
    assert.deepStrictEqual(updates, [{ hasChords: true, hasLyrics: true, isComplete: true }]);
  }

  // G. Se apenas Search v3 diverge, métricas corretas não são reescritas.
  {
    const source = {
      title: 'Somente Busca',
      artist: 'Banda Cinco',
      chords: '',
      lyrics: 'Esperança permanece',
    };
    const data = {
      ...source,
      ...canonicalDerived(source),
      searchVersion: 2,
      searchContentTokens: ['legado'],
    };
    const { snapshot, updates } = createSnapshot(data);
    await processGlobalSongContentMetricsWritten(snapshot as any);
    assert.strictEqual(updates.length, 1);
    assert.deepStrictEqual(Object.keys(updates[0]).sort(), ['searchContentTokens', 'searchVersion']);
    assert.strictEqual(updates[0].searchVersion, GLOBAL_SEARCH_VERSION);
    assert.deepStrictEqual(updates[0].searchContentTokens, ['esperanca', 'permanece']);
  }

  // H. Alteração irrelevante com todos os derivados canônicos é zero-write.
  {
    const source = {
      title: 'Documento Canônico',
      artist: 'Banda Seis',
      chords: 'C\nFiel és',
      lyrics: 'Fiel és',
    };
    const data = { ...source, ...canonicalDerived(source), importCount: 42 };
    const { snapshot, updates } = createSnapshot(data);
    await processGlobalSongContentMetricsWritten(snapshot as any);
    assert.strictEqual(updates.length, 0);
  }

  // I. DELETE / after inexistente é no-op.
  {
    await processGlobalSongContentMetricsWritten(undefined);
  }

  // J. O processor reutiliza os helpers canônicos; não duplica normalização/indexação.
  {
    const processorSource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/globalSongMetricsProcessor.ts'),
      'utf8'
    );
    assert(processorSource.includes('../../utils/globalSongContentMetrics.js'));
    assert(processorSource.includes('deriveGlobalSongContentMetrics'));
    assert(processorSource.includes('../../utils/searchEngine.js'));
    assert(processorSource.includes('buildGlobalSongSearchFields'));
    assert(!processorSource.includes('.normalize('));
    assert(!processorSource.includes('buildTrigrams('));
  }

  console.log('Global Song derived-fields processor tests passed!');
}

runGlobalSongMetricsProcessorTests().catch(error => {
  console.error('Global Song derived-fields processor tests failed:', error);
  process.exit(1);
});
