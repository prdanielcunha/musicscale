import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const hookPath = path.join(process.cwd(), 'hooks/useMusicData.ts');
const sourceText = fs.readFileSync(hookPath, 'utf8');
const sourceFile = ts.createSourceFile(hookPath, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

const descendants = <T extends ts.Node>(predicate: (node: ts.Node) => node is T): T[] => {
  const matches: T[] = [];
  const visit = (node: ts.Node) => {
    if (predicate(node)) matches.push(node);
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return matches;
};

describe('MusicData first-operational structural contract', () => {
  it('gates on exactly the five operational resources', () => {
    const declaration = descendants((node): node is ts.VariableDeclaration =>
      ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === 'criticalPromises',
    )[0];
    expect(declaration).toBeDefined();
    expect(ts.isArrayLiteralExpression(declaration.initializer!)).toBe(true);

    const names = (declaration.initializer as ts.ArrayLiteralExpression).elements.map(element => {
      expect(ts.isCallExpression(element)).toBe(true);
      return (element as ts.CallExpression).arguments[0].getText(sourceFile).replaceAll("'", '');
    });
    expect(names).toEqual(['songs', 'scales', 'bandScales', 'eventTypes', 'locations']);
  });

  it.each([
    ['eventNamesPromise', 'eventNames'],
    ['tagsPromise', 'tags'],
  ])('starts one %s request independently during each generation', (promiseName, apiName) => {
    const declarations = descendants((node): node is ts.VariableDeclaration =>
      ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === promiseName,
    );
    expect(declarations).toHaveLength(1);
    expect(declarations[0].initializer?.getText(sourceFile)).toContain(`api.${apiName}.list()`);

    const listCalls = descendants((node): node is ts.CallExpression =>
      ts.isCallExpression(node) && node.expression.getText(sourceFile) === `api.${apiName}.list`,
    );
    expect(listCalls).toHaveLength(1);
  });
});
