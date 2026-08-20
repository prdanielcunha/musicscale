import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  records: [] as Array<Record<string, unknown>>,
  toArray: vi.fn(),
  bulkDelete: vi.fn(),
  publishEvent: vi.fn(),
}));

vi.mock('../../services/offline/database', () => ({
  offlineDB: {
    cachedScales: {
      toArray: mocks.toArray,
      bulkDelete: mocks.bulkDelete,
    },
  },
}));

vi.mock('../../services/ecosystem/EcosystemBridge', () => ({
  ecosystemBridge: { publishEvent: mocks.publishEvent },
}));

import { scaleRetentionService } from '../../services/offline/ScaleRetentionService';

describe('ScaleRetentionService local-only cleanup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-20T12:00:00.000Z'));
    mocks.records = [];
    mocks.toArray.mockImplementation(async () => [...mocks.records]);
    mocks.bulkDelete.mockImplementation(async (ids: string[]) => {
      mocks.records = mocks.records.filter((record) => !ids.includes(record.id as string));
    });
    mocks.publishEvent.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('removes only old, valid cache entries proven to belong to the active organization', async () => {
    mocks.records = [
      { id: 'old-org-a', organizationId: 'org-A', date: '2025-01-01' },
      { id: 'recent-org-a', organizationId: 'org-A', date: '2026-08-01' },
      { id: 'old-org-b', organizationId: 'org-B', date: '2025-01-01' },
      { id: 'legacy-no-org', date: '2025-01-01' },
      { id: 'malformed-tenant', organizationId: 42, date: '2025-01-01' },
      { id: 'malformed-date', organizationId: 'org-A', date: '2025-99-99' },
      { id: 'unknown-date', organizationId: 'org-A' },
    ];

    await scaleRetentionService.runRetentionCleanup('org-A');

    expect(mocks.bulkDelete).toHaveBeenCalledOnce();
    expect(mocks.bulkDelete).toHaveBeenCalledWith(['old-org-a']);
    expect(mocks.records.map((record) => record.id)).toEqual([
      'recent-org-a',
      'old-org-b',
      'legacy-no-org',
      'malformed-tenant',
      'malformed-date',
      'unknown-date',
    ]);
    expect(mocks.publishEvent).toHaveBeenCalledWith(expect.objectContaining({
      type: 'telemetry',
      payload: expect.objectContaining({ cachedScalesDeleted: 1, orgId: 'org-A' }),
    }));
  });

  it('continues local cleanup when the browser is offline', async () => {
    vi.stubGlobal('navigator', { onLine: false });
    mocks.records = [{ id: 'offline-old', organizationId: 'org-A', date: '2025-01-01' }];

    await scaleRetentionService.runRetentionCleanup('org-A');

    expect(mocks.bulkDelete).toHaveBeenCalledWith(['offline-old']);
    expect(mocks.records).toEqual([]);
  });
});

describe('ScaleRetentionService structural safety contract', () => {
  const servicePath = path.resolve(process.cwd(), 'services/offline/ScaleRetentionService.ts');
  const sourceText = fs.readFileSync(servicePath, 'utf8');
  const sourceFile = ts.createSourceFile(servicePath, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

  it('keeps runRetentionCleanup and contains no Firestore retention access or mutation', () => {
    const imports: string[] = [];
    const calledIdentifiers: string[] = [];
    const calledProperties: string[] = [];
    let runRetentionCleanupFound = false;

    const visit = (node: ts.Node) => {
      if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
        imports.push(node.moduleSpecifier.text);
      }
      if (ts.isMethodDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === 'runRetentionCleanup') {
        runRetentionCleanupFound = true;
      }
      if (ts.isCallExpression(node)) {
        if (ts.isIdentifier(node.expression)) {
          calledIdentifiers.push(node.expression.text);
        }
        if (ts.isPropertyAccessExpression(node.expression)) {
          calledProperties.push(node.expression.name.text);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);

    expect(runRetentionCleanupFound).toBe(true);
    expect(imports).not.toContain('firebase/firestore');
    expect(calledIdentifiers).not.toEqual(expect.arrayContaining([
      'collection',
      'query',
      'getDocs',
      'writeBatch',
      'deleteDoc',
    ]));
    expect(calledProperties).not.toContain('delete');
    expect(imports).toEqual([
      './database',
      '../ecosystem/EcosystemBridge',
    ]);
  });
});
