const fs = require('fs');
let code = fs.readFileSync('tests/unit/apiAiImport.test.ts', 'utf8');
code = code.replace("expect(res.body.song.metadata.declaredKey).toBe(\"Am\");", "console.log(JSON.stringify(res.body, null, 2));\n    expect(res.body.song.metadata.declaredKey).toBe(\"Am\");");
fs.writeFileSync('tests/unit/apiAiImport.test.ts', code);
