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

function findWakeLockEffect(sourceFile: ts.SourceFile): string | undefined {
  let effect: string | undefined;

  const visit = (node: ts.Node) => {
    if (
      !effect &&
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'useEffect'
    ) {
      const text = node.getText(sourceFile);
      if (text.includes('wakeLock') && text.includes('requestWakeLock')) {
        effect = text;
        return;
      }
    }
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return effect;
}

describe('P3 wake lock lifecycle contract', () => {
  const viewer = readChordsViewer();
  const wakeLockEffect = findWakeLockEffect(viewer.sourceFile);

  it('guards the async request with disposed and in-flight state', () => {
    expect(wakeLockEffect).toBeDefined();
    expect(wakeLockEffect).toContain('let disposed = false');
    expect(wakeLockEffect).toContain('let requestInFlight = false');
    expect(wakeLockEffect).toContain('disposed ||');
    expect(wakeLockEffect).toContain('requestInFlight ||');
    expect(wakeLockEffect).toContain('requestInFlight = true');
    expect(wakeLockEffect).toContain('requestInFlight = false');
  });

  it('releases a sentinel that resolves after the viewer has already closed', () => {
    expect(wakeLockEffect).toMatch(
      /const sentinel = await[\s\S]*?if \(disposed\) \{[\s\S]*?releaseWakeLock\(sentinel\);[\s\S]*?return;/,
    );
  });

  it('requests again only when the document is visible and avoids overlap', () => {
    expect(wakeLockEffect).toContain(
      'document.visibilityState !== "visible"',
    );
    expect(wakeLockEffect).toMatch(
      /const handleVisibilityChange = \(\) => \{[\s\S]*?document\.visibilityState === "visible"[\s\S]*?void requestWakeLock\(\);/,
    );
  });

  it('marks the effect disposed, releases the current sentinel and removes the listener on cleanup', () => {
    expect(wakeLockEffect).toMatch(
      /return \(\) => \{[\s\S]*?disposed = true;[\s\S]*?const currentWakeLock = wakeLock;[\s\S]*?wakeLock = null;[\s\S]*?releaseWakeLock\(currentWakeLock\);[\s\S]*?removeEventListener\("visibilitychange", handleVisibilityChange\);/,
    );
  });
});
