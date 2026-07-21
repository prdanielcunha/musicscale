const fs = require('fs');
let code = fs.readFileSync('tests/server/curation-approval-service.test.ts', 'utf8');

const regexMock = /get get\(\) \{ return this\._get\.bind\(this\); \}\s*get set\(\) \{ return this\._set\.bind\(this\); \}\s*get update\(\) \{ return this\._update\.bind\(this\); \}/;
const replacementMock = `get get() { return this._get.bind(this); }
    set get(val: any) { throw new Error("OVERRIDE_FORBIDDEN"); }
    get set() { return this._set.bind(this); }
    set set(val: any) { throw new Error("OVERRIDE_FORBIDDEN"); }
    get update() { return this._update.bind(this); }
    set update(val: any) { throw new Error("OVERRIDE_FORBIDDEN"); }`;
code = code.replace(regexMock, replacementMock);
fs.writeFileSync('tests/server/curation-approval-service.test.ts', code);
