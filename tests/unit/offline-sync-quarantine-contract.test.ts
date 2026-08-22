import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

function parse(filePath: string) {
  const sourceText = fs.readFileSync(filePath, 'utf8');
  return {
    sourceText,
    sourceFile: ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true, filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS),
  };
}

function collect(sourceFile: ts.SourceFile) {
  const imports: string[] = [];
  const functions: string[] = [];
  const stringLiterals: string[] = [];
  const identifiers: string[] = [];

  const visit = (node: ts.Node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      imports.push(node.moduleSpecifier.text);
    }
    if (ts.isFunctionDeclaration(node) && node.name) {
      functions.push(node.name.text);
    }
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      stringLiterals.push(node.text);
    }
    if (ts.isIdentifier(node)) {
      identifiers.push(node.text);
    }
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return { imports, functions, stringLiterals, identifiers };
}

describe('P3.2 legacy offline queue quarantine contract', () => {
  const root = process.cwd();
  const databasePath = path.resolve(root, 'services/offline/database.ts');
  const syncManagerPath = path.resolve(root, 'services/offline/syncManager.ts');
  const offlineContextPath = path.resolve(root, 'contexts/OfflineContext.tsx');
  const firebasePath = path.resolve(root, 'services/firebase.ts');
  const baseRepositoryPath = path.resolve(root, 'lib/BaseRepository.ts');

  it('keeps the legacy IndexedDB table but exposes no custom queue producer or replay trigger', () => {
    const { sourceText, sourceFile } = parse(databasePath);
    const collected = collect(sourceFile);

    expect(collected.imports).toEqual(['dexie']);
    expect(collected.functions).not.toContain('queueSyncOperation');
    expect(collected.functions).not.toContain('triggerBackgroundSync');
    expect(collected.stringLiterals).not.toContain('sync-musicscale');
    expect(collected.stringLiterals).not.toContain('musicscale:sync');
    expect(collected.identifiers).toContain('syncQueue');
    expect(sourceText).toContain("syncQueue: 'id, entity, status, timestamp'");
    expect(collected.functions).toEqual(expect.arrayContaining([
      'savePerformanceState',
      'getPerformanceState',
      'clearPerformanceState',
    ]));
  });

  it('removes the dangerous replay implementation and all runtime coupling from OfflineContext', () => {
    expect(fs.existsSync(syncManagerPath)).toBe(false);

    const { sourceFile } = parse(offlineContextPath);
    const collected = collect(sourceFile);

    expect(collected.imports).not.toContain('../services/offline/syncManager');
    expect(collected.imports).not.toContain('./AuthContext');
    expect(collected.imports).not.toContain('./ToastContext');
    expect(collected.identifiers).not.toContain('processSyncQueue');
    expect(collected.identifiers).not.toContain('triggerBackgroundSync');
    expect(collected.stringLiterals).not.toContain('musicscale:sync');
    expect(collected.stringLiterals).toEqual(expect.arrayContaining(['online', 'offline', 'change']));
    expect(collected.identifiers).toEqual(expect.arrayContaining(['isOffline', 'syncPending', 'isSlowConnection']));
  });

  it('preserves native Firestore persistence and canonical top-level repository writes', () => {
    const firebase = parse(firebasePath).sourceText;
    const repository = parse(baseRepositoryPath).sourceText;

    expect(firebase).toContain('persistentLocalCache');
    expect(firebase).toContain('persistentMultipleTabManager');
    expect(repository).toContain('collection(db, this.collectionName)');
    expect(repository).toContain('doc(db, this.collectionName, id)');
    expect(repository).toContain('organizationId: this.orgId');
    expect(repository).not.toContain('organizations/${this.orgId}/');
  });
});
