import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

function source(path: string, kind = ts.ScriptKind.TSX) {
  return ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true, kind);
}

function staticRuntimeImports(file: ts.SourceFile) {
  return file.statements
    .filter(ts.isImportDeclaration)
    .filter(node => node.importClause?.isTypeOnly !== true)
    .map(node => (node.moduleSpecifier as ts.StringLiteral).text);
}

function dynamicImports(file: ts.SourceFile) {
  const modules: string[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && ts.isStringLiteral(node.arguments[0])) {
      modules.push(node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return modules;
}

function jsxCount(file: ts.SourceFile, tag: string) {
  let count = 0;
  const visit = (node: ts.Node) => {
    if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && node.tagName.getText(file) === tag) count++;
    ts.forEachChild(node, visit);
  };
  visit(file);
  return count;
}

const login = source('pages/LoginPage.tsx');
const app = source('App.tsx');
const formatter = source('utils/firebaseAuthErrorMessage.ts', ts.ScriptKind.TS);
const forbiddenLoginImports = [
  '../services/authService',
  '../services/firebase',
  '../services/firestoreService',
  'firebase/auth',
  'firebase/firestore',
];

for (const moduleName of forbiddenLoginImports) {
  assert(!staticRuntimeImports(login).includes(moduleName), `LoginPage must not statically import ${moduleName}`);
}
assert(dynamicImports(login).includes('../services/authService'), 'LoginPage auth actions must dynamically import authService');
assert(
  staticRuntimeImports(login).includes('../utils/firebaseAuthErrorMessage'),
  'LoginPage must use the lightweight error formatter',
);
assert.equal(staticRuntimeImports(formatter).length, 0, 'the error formatter must contain no runtime imports');
assert(!staticRuntimeImports(app).includes('./PrivateApp'), 'App must not statically import PrivateApp');
assert(dynamicImports(app).includes('./PrivateApp'), 'App must dynamically import PrivateApp');
assert.equal(jsxCount(app, 'LoginPage'), 1, '/login must remain in the public shell');
for (const provider of ['EcosystemProvider', 'AuthProvider', 'NotificationProvider', 'MusicDataProvider']) {
  assert.equal(jsxCount(app, provider), 0, `${provider} must remain outside the public /login shell`);
}

console.log('MS-PERF-LOGIN-DEFERRAL passed (auth runtime, formatter, and public shell contracts)');
