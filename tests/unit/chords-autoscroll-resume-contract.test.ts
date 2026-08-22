import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

function readChordsViewer() {
  const filePath = path.resolve(
    process.cwd(),
    'components/songs/ChordsViewerModal.tsx',
  );
  const sourceText = fs.readFileSync(filePath, 'utf8');
  const sourceFile = ts.createSourceFile(
    filePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
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

describe('P3 chords autoscroll resume contract', () => {
  const viewer = readChordsViewer();

  it('caps frame delta so a suspended tab cannot jump through the chart on resume', () => {
    expect(viewer.sourceText).toContain(
      'const MAX_AUTOSCROLL_FRAME_DELTA_MS = 100;',
    );
    expect(viewer.sourceText).toMatch(
      /const elapsed = Math\.min\([\s\S]*?Math\.max\(timestamp - lastTimeRef\.current, 0\),[\s\S]*?MAX_AUTOSCROLL_FRAME_DELTA_MS/,
    );
  });

  it('invalidates the animation clock and realigns the fractional position on visibility changes', () => {
    const visibilityEffect = useEffectTexts(viewer.sourceFile).find(
      (effect) =>
        effect.includes('resetAutoScrollClock') &&
        effect.includes('visibilitychange'),
    );

    expect(visibilityEffect).toBeDefined();
    expect(visibilityEffect).toContain('lastTimeRef.current = undefined');
    expect(visibilityEffect).toContain(
      'scrollPosRef.current = scrollContainerRef.current.scrollTop',
    );
    expect(visibilityEffect).toContain('removeEventListener');
  });

  it('continues to calculate movement from elapsed time at the selected speed', () => {
    expect(viewer.sourceText).toContain(
      'const scrollDelta = (pxPerSecond / 1000) * elapsed;',
    );
    expect(viewer.sourceText).toContain(
      'scrollAnimationRef.current = requestAnimationFrame(scrollStep);',
    );
  });
});
