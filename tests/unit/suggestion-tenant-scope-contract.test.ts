import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const hookPath = path.join(process.cwd(), 'hooks/useSuggestions.ts');
const sourceText = fs.readFileSync(hookPath, 'utf8');
const sourceFile = ts.createSourceFile(hookPath, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

const descendants = (predicate: (node: ts.Node) => boolean) => {
  const matches: ts.Node[] = [];
  const visit = (node: ts.Node) => {
    if (predicate(node)) matches.push(node);
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return matches;
};

describe('suggestion canonical tenant structural contract', () => {
  it('consumes effectiveOrganizationId without profile-based tenant access', () => {
    const authBindings = descendants(node =>
      ts.isVariableDeclaration(node)
      && ts.isObjectBindingPattern(node.name)
      && node.initializer !== undefined
      && ts.isCallExpression(node.initializer)
      && node.initializer.expression.getText(sourceFile) === 'useAuth',
    );
    expect(authBindings).toHaveLength(1);
    expect(authBindings[0].getText(sourceFile)).toContain('effectiveOrganizationId');

    const profileTenantAccess = descendants(node =>
      ts.isPropertyAccessExpression(node)
      && node.expression.getText(sourceFile) === 'userProfile'
      && node.name.text === 'organizationId',
    );
    expect(profileTenantAccess).toHaveLength(0);
  });

  it('passes the canonical tenant to the listener and keys lifecycle to it', () => {
    const listenerCalls = descendants(node =>
      ts.isCallExpression(node)
      && node.expression.getText(sourceFile) === 'suggestionApi.onSuggestionsUpdate',
    ) as ts.CallExpression[];
    expect(listenerCalls).toHaveLength(1);
    expect(listenerCalls[0].arguments[0].getText(sourceFile)).toBe('effectiveOrganizationId');

    const effects = descendants(node =>
      ts.isCallExpression(node) && node.expression.getText(sourceFile) === 'useEffect',
    ) as ts.CallExpression[];
    expect(effects).toHaveLength(1);
    const dependencies = effects[0].arguments[1];
    expect(ts.isArrayLiteralExpression(dependencies)).toBe(true);
    expect((dependencies as ts.ArrayLiteralExpression).elements.map(element => element.getText(sourceFile)))
      .toContain('effectiveOrganizationId');
  });

  it('guards listener callbacks with a local generation ref', () => {
    const generationRefDeclarations = descendants(node =>
      ts.isVariableDeclaration(node)
      && ts.isIdentifier(node.name)
      && node.name.text === 'generationRef'
      && node.initializer !== undefined
      && ts.isCallExpression(node.initializer)
      && node.initializer.expression.getText(sourceFile) === 'useRef',
    );
    expect(generationRefDeclarations).toHaveLength(1);

    const generationComparisons = descendants(node =>
      ts.isBinaryExpression(node)
      && node.operatorToken.kind === ts.SyntaxKind.ExclamationEqualsEqualsToken
      && node.left.getText(sourceFile) === 'generationRef.current'
      && node.right.getText(sourceFile) === 'currentGeneration',
    );
    expect(generationComparisons.length).toBeGreaterThanOrEqual(2);
  });
});
