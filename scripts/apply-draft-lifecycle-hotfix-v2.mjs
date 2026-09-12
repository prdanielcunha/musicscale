import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

const legacyPath = 'scripts/apply-draft-lifecycle-hotfix.mjs';
let legacy = fs.readFileSync(legacyPath, 'utf8');
legacy = legacy.replace(
  /patch\('contexts\/ModalContext\.tsx', \[[\s\S]*?\n\]\);\n\nconsole\.log\('Draft lifecycle hotfix transformations applied successfully\.'\);/,
  "console.log('Core draft lifecycle hotfix transformations applied successfully.');"
);
const tempPath = '/tmp/apply-draft-lifecycle-hotfix-core.mjs';
fs.writeFileSync(tempPath, legacy);
await import(pathToFileURL(tempPath).href + `?v=${Date.now()}`);

const modalPath = 'contexts/ModalContext.tsx';
let modal = fs.readFileSync(modalPath, 'utf8');
const needle = `    if (scaleData.time !== undefined) {\n        scalePatch.time = scaleData.time;\n    }\n    if (scaleData.eventTypeId !== undefined) {`;
const replacement = `    if (scaleData.time !== undefined) {\n        scalePatch.time = scaleData.time;\n    }\n    if (scaleData.timeZone !== undefined) {\n        scalePatch.timeZone = scaleData.timeZone;\n    }\n    if (scaleData.eventTypeId !== undefined) {`;
if (!modal.includes(needle)) throw new Error('Missing ModalContext publish payload anchor');
if (modal.indexOf(needle) !== modal.lastIndexOf(needle)) throw new Error('ModalContext publish payload anchor not unique');
modal = modal.replace(needle, replacement);
fs.writeFileSync(modalPath, modal);

console.log('Publish payload now preserves timeZone.');
