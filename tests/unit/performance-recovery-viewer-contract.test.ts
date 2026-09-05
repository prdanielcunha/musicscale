import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

function readSource(relativePath: string) {
  const filePath = path.resolve(process.cwd(), relativePath);
  const sourceText = fs.readFileSync(filePath, 'utf8');
  const sourceFile = ts.createSourceFile(
    filePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    relativePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  return { sourceText, sourceFile };
}

function useEffectTexts(sourceFile: ts.SourceFile): string[] {
  const effects: string[] = [];
  const visit = (node: ts.Node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'useEffect'
    ) {
      effects.push(node.getText(sourceFile));
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return effects;
}

describe('P3.3 stage recovery viewer contract', () => {
  const viewer = readSource('components/songs/ChordsViewerModal.tsx');
  const songDetail = readSource('components/songs/SongDetailModal.tsx');
  const database = readSource('services/offline/database.ts');

  it('persists recovery with canonical organization, song and scale scope', () => {
    expect(viewer.sourceText).toContain('getSafeRecoveryScrollPosition');
    expect(viewer.sourceText).toMatch(
      /savePerformanceState\(\{[\s\S]*?organizationId,[\s\S]*?songId,[\s\S]*?scaleId,[\s\S]*?scrollPosition:/,
    );
    expect(viewer.sourceText).toContain(
      '[activeSectionIndex, effectiveOrganizationId, song?.id, scaleContext?.scaleId]',
    );
  });

  it('cancels a delayed save whenever tenant, song or scale context changes', () => {
    const cleanupEffect = useEffectTexts(viewer.sourceFile).find(
      (effect) =>
        effect.includes('saveScrollTimeoutRef.current') &&
        effect.includes('window.clearTimeout') &&
        effect.includes('effectiveOrganizationId') &&
        effect.includes('scaleContext?.scaleId'),
    );

    expect(cleanupEffect).toBeDefined();
    expect(cleanupEffect).toContain('song?.id');
  });

  it('guards asynchronous restore work and matches the exact active context', () => {
    const recoveryEffect = useEffectTexts(viewer.sourceFile).find((effect) =>
      effect.includes('getPerformanceState()'),
    );

    expect(recoveryEffect).toBeDefined();
    expect(recoveryEffect).toContain('getSafeRecoveryScrollPosition');
    expect(recoveryEffect).toContain('organizationId');
    expect(recoveryEffect).toContain('songId');
    expect(recoveryEffect).toContain('scaleId');
    expect(recoveryEffect).toContain('cancelled = true');
    expect(recoveryEffect).toContain('cancelAnimationFrame');
    expect(recoveryEffect).not.toContain('setTranspose(0)');
  });

  it('leaves Live Worship key override/reset as the sole transpose synchronization effect', () => {
    const transposeEffects = useEffectTexts(viewer.sourceFile).filter((effect) =>
      effect.includes('setTranspose('),
    );

    expect(transposeEffects).toHaveLength(1);
    expect(transposeEffects[0]).toContain('liveSession?.keyOverrides?.[song.id]');
    expect(transposeEffects[0]).toContain('getKeyDifference');
  });

  it('preserves explicit-exit clearing and avoids an IndexedDB schema migration', () => {
    expect(songDetail.sourceText).toContain('clearPerformanceState().catch');
    expect(database.sourceText).toContain("this.version(1).stores({");
    expect(database.sourceText).toContain("performanceState: 'id'");
    expect(database.sourceText).toContain('organizationId?: string;');
  });
});
