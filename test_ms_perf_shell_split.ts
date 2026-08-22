import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

function source(path: string) {
  return ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}

function imports(file: ts.SourceFile) {
  return file.statements.filter(ts.isImportDeclaration).map(node => (node.moduleSpecifier as ts.StringLiteral).text);
}

function dynamicImports(file: ts.SourceFile) {
  const modules: string[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) {
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

const app = source('App.tsx');
const privateApp = source('PrivateApp.tsx');
const start = source('pages/StartGateway.tsx');
const index = readFileSync('index.tsx', 'utf8');
const privateProviders = ['EcosystemProvider', 'AuthProvider', 'ToastProvider', 'OfflineProvider', 'ApiProvider', 'NotificationProvider', 'MusicDataProvider', 'SuggestionProvider', 'ModalProvider'];

assert(!imports(app).includes('./PrivateApp'), 'public shell must not statically import PrivateApp');
assert(dynamicImports(app).includes('./PrivateApp'), 'public shell must dynamically import PrivateApp');
for (const provider of privateProviders) {
  assert.equal(jsxCount(app, provider), 0, `${provider} must remain outside the public shell`);
  assert.equal(jsxCount(privateApp, provider), 1, `${provider} must occur exactly once in PrivateApp`);
}
assert.equal(jsxCount(app, 'LoginPage'), 1, '/login must remain in the public shell');
assert(!imports(start).includes('./TenantOnboarding'), 'StartGateway must not statically import TenantOnboarding');
assert(dynamicImports(start).includes('./TenantOnboarding'), 'StartGateway must dynamically import TenantOnboarding');
assert(index.includes("const RELOAD_FLAG = 'musicscale_chunk_reloaded'"), 'chunk reload guard must remain present');
assert(index.includes("window.addEventListener('vite:preloadError', handleChunkError)"), 'Vite preload recovery must remain present');

console.log('MS-PERF-SHELL-SPLIT passed (public/private, onboarding, provider, and recovery contracts)');
