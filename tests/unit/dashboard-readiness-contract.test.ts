import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const dashboardPath = path.join(process.cwd(), 'pages/DashboardPage.tsx');
const sourceText = fs.readFileSync(dashboardPath, 'utf8');
const sourceFile = ts.createSourceFile(
  dashboardPath,
  sourceText,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);

const descendants = (predicate: (node: ts.Node) => boolean) => {
  const matches: ts.Node[] = [];
  const visit = (node: ts.Node) => {
    if (predicate(node)) matches.push(node);
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return matches;
};

describe('dashboard first-screen readiness contract', () => {
  it('keeps Music/Home loading as the full-page readiness gate without suggestionsLoading', () => {
    const loadingIfs = descendants(node =>
      ts.isIfStatement(node)
      && node.expression.getText(sourceFile).includes('experienceLoading')
      && node.expression.getText(sourceFile).includes('musicLoading'),
    ) as ts.IfStatement[];

    expect(loadingIfs).toHaveLength(1);
    const expression = loadingIfs[0].expression.getText(sourceFile);
    expect(expression).toContain('experienceLoading');
    expect(expression).toContain('musicLoading');
    expect(expression).not.toContain('suggestionsLoading');
  });

  it('still consumes suggestions and their loading state for local secondary-content readiness', () => {
    const suggestionBindings = descendants(node =>
      ts.isVariableDeclaration(node)
      && ts.isObjectBindingPattern(node.name)
      && node.initializer !== undefined
      && ts.isCallExpression(node.initializer)
      && node.initializer.expression.getText(sourceFile) === 'useSuggestionsContext',
    );

    expect(suggestionBindings).toHaveLength(1);
    const bindingText = suggestionBindings[0].getText(sourceFile);
    expect(bindingText).toContain('suggestions');
    expect(bindingText).toContain('suggestionsLoading');

    const unreadSuggestionDeclarations = descendants(node =>
      ts.isVariableDeclaration(node)
      && ts.isIdentifier(node.name)
      && node.name.text === 'unreadSuggestions',
    );

    expect(unreadSuggestionDeclarations).toHaveLength(1);
    expect(unreadSuggestionDeclarations[0].getText(sourceFile)).toContain('suggestionsLoading');
  });
});
