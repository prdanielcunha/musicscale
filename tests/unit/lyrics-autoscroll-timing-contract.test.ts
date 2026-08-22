import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

function readLyricsViewer() {
  const filePath = path.resolve(
    process.cwd(),
    'components/songs/LyricsViewerModal.tsx',
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

describe('P3 lyrics autoscroll timing contract', () => {
  const viewer = readLyricsViewer();

  it('uses elapsed time instead of adding pixels once per rendered frame', () => {
    expect(viewer.sourceText).toContain(
      'const autoScroll = useCallback((timestamp: number) =>',
    );
    expect(viewer.sourceText).toContain('const pixelsPerSecond = scrollSpeed * AUTOSCROLL_BASELINE_FPS;');
    expect(viewer.sourceText).toContain(
      'content.scrollTop += (pixelsPerSecond / 1000) * elapsedMs;',
    );
    expect(viewer.sourceText).not.toContain(
      'contentRef.current.scrollTop += scrollSpeed;',
    );
  });

  it('bounds a suspended-frame delta so foreground resume cannot jump through the song', () => {
    expect(viewer.sourceText).toContain(
      'const MAX_AUTOSCROLL_FRAME_DELTA_MS = 100;',
    );
    expect(viewer.sourceText).toMatch(
      /Math\.min\([\s\S]*?Math\.max\(timestamp - previousTimestamp, 0\),[\s\S]*?MAX_AUTOSCROLL_FRAME_DELTA_MS/,
    );
  });

  it('invalidates the animation clock whenever page visibility changes', () => {
    const visibilityEffect = useEffectTexts(viewer.sourceFile).find(
      (effect) =>
        effect.includes('visibilitychange') &&
        effect.includes('lastFrameTimeRef.current = null'),
    );

    expect(visibilityEffect).toBeDefined();
    expect(visibilityEffect).toContain('removeEventListener');
  });

  it('stops scheduling frames after the content reaches the bottom', () => {
    expect(viewer.sourceText).toContain(
      'content.scrollTop + content.clientHeight >= content.scrollHeight - 1',
    );
    expect(viewer.sourceText).toContain('setIsAutoScrolling(false);');
  });
});
