import assert from 'assert';
import fs from 'node:fs';
import path from 'node:path';
import { processGlobalSongContentMetricsWritten } from '../src/globalSongMetricsProcessor.js';

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

async function runGlobalSongMetricsProcessorTests() {
  console.log('Running Global Song Metrics Processor tests...');

  // A. CREATE com cifra + letra.
  {
    const { snapshot, updates } = createSnapshot({ chords: 'C G', lyrics: 'Letra' });
    await processGlobalSongContentMetricsWritten(snapshot as any);
    assert.deepStrictEqual(updates, [{ hasChords: true, hasLyrics: true, isComplete: true }]);
  }

  // B. Somente cifra.
  {
    const { snapshot, updates } = createSnapshot({ chords: 'C G' });
    await processGlobalSongContentMetricsWritten(snapshot as any);
    assert.deepStrictEqual(updates, [{ hasChords: true, hasLyrics: false, isComplete: false }]);
  }

  // C. Vazio e whitespace.
  {
    const { snapshot, updates } = createSnapshot({ chords: '   ', lyrics: '\n\t ' });
    await processGlobalSongContentMetricsWritten(snapshot as any);
    assert.deepStrictEqual(updates, [{ hasChords: false, hasLyrics: false, isComplete: false }]);
  }

  // D. Valores legados inválidos seguem o helper canônico.
  {
    const { snapshot, updates } = createSnapshot({ chords: 123, lyrics: ['Letra'] });
    await processGlobalSongContentMetricsWritten(snapshot as any);
    assert.deepStrictEqual(updates, [{ hasChords: false, hasLyrics: false, isComplete: false }]);
  }

  // E. Campos derivados ausentes são gravados.
  {
    const { snapshot, updates } = createSnapshot({ chords: 'C', lyrics: '' });
    await processGlobalSongContentMetricsWritten(snapshot as any);
    assert.strictEqual(updates.length, 1);
  }

  // F. Campos derivados incorretos são corrigidos.
  {
    const { snapshot, updates } = createSnapshot({
      chords: 'C',
      lyrics: 'L',
      hasChords: false,
      hasLyrics: false,
      isComplete: false
    });
    await processGlobalSongContentMetricsWritten(snapshot as any);
    assert.deepStrictEqual(updates, [{ hasChords: true, hasLyrics: true, isComplete: true }]);
  }

  // G. Estado já correto produz zero writes.
  {
    const { snapshot, updates } = createSnapshot({
      chords: 'C',
      lyrics: 'L',
      hasChords: true,
      hasLyrics: true,
      isComplete: true
    });
    await processGlobalSongContentMetricsWritten(snapshot as any);
    assert.strictEqual(updates.length, 0);
  }

  // H. Segunda invocação depois da correção produz zero writes.
  {
    const { snapshot, updates, current } = createSnapshot({ chords: 'C', lyrics: 'L' });
    await processGlobalSongContentMetricsWritten(snapshot as any);
    assert.strictEqual(updates.length, 1);
    assert.deepStrictEqual(current(), {
      chords: 'C',
      lyrics: 'L',
      hasChords: true,
      hasLyrics: true,
      isComplete: true
    });
    await processGlobalSongContentMetricsWritten(snapshot as any);
    assert.strictEqual(updates.length, 1);
  }

  // I. Alteração irrelevante com derivados corretos não escreve.
  {
    const { snapshot, updates } = createSnapshot({
      title: 'Título alterado',
      chords: 'C',
      lyrics: '',
      hasChords: true,
      hasLyrics: false,
      isComplete: false
    });
    await processGlobalSongContentMetricsWritten(snapshot as any);
    assert.strictEqual(updates.length, 0);
  }

  // J. DELETE / after inexistente é no-op.
  {
    await processGlobalSongContentMetricsWritten(undefined);
  }

  // K. O payload contém somente os três campos derivados.
  {
    const { snapshot, updates } = createSnapshot({ chords: 'C', lyrics: 'L', keepMe: 'yes' });
    await processGlobalSongContentMetricsWritten(snapshot as any);
    assert.deepStrictEqual(Object.keys(updates[0]).sort(), ['hasChords', 'hasLyrics', 'isComplete']);
  }

  // L. O processor reutiliza o helper canônico e não duplica normalização.
  {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/globalSongMetricsProcessor.ts'),
      'utf8'
    );
    assert(source.includes("../../utils/globalSongContentMetrics.js"));
    assert(source.includes('deriveGlobalSongContentMetrics'));
    assert(!source.includes('.trim('));
    assert(!source.includes('hasMeaningfulText'));
  }

  console.log('Global Song Metrics Processor tests passed!');
}

runGlobalSongMetricsProcessorTests().catch(error => {
  console.error('Global Song Metrics Processor tests failed:', error);
  process.exit(1);
});
